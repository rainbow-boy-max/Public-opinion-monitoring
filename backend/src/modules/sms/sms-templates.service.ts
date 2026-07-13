import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as OpenApi from '@alicloud/openapi-client';
import Dysmsapi20170525 from '@alicloud/dysmsapi20170525';
import * as Util from '@alicloud/tea-util';
import { AliyunConfigEntity, SmsTemplateEntity, SmsTemplateScene, SmsTemplateStatus } from '../../database/entities';
import { CryptoUtil } from '../../utils/crypto.util';

const DEFAULT_TEMPLATES: Record<string, { name: string; content: string }> = {
  login: { name: '登录验证码', content: '您的登录验证码：${code}，5分钟内有效，请勿泄露。' },
  register: { name: '注册验证码', content: '您的注册验证码：${code}，5分钟内有效。' },
  reset_password: { name: '密码重置', content: '您的密码重置验证码：${code}，5分钟内有效。' },
  opinion_alert: { name: '舆情预警', content: '舆情预警：检测到与关键词【${keyword}】相关的高传播内容（阅读 ${readCount}），请登录系统查看详情。' },
  ban_notify: { name: '账号封禁通知', content: '尊敬的 ${username}，您的账号因违规被暂时封禁，请联系管理员。' },
  unban_notify: { name: '账号解封通知', content: '尊敬的 ${username}，您的账号已恢复正常使用，感谢您的配合。' },
  generic: { name: '通用通知', content: '您的验证码：${code}，5分钟内有效。' },
};

@Injectable()
export class SmsTemplatesService {
  private readonly logger = new Logger(SmsTemplatesService.name);

  constructor(
    @InjectRepository(SmsTemplateEntity)
    private repo: Repository<SmsTemplateEntity>,
    @InjectRepository(AliyunConfigEntity)
    private configRepo: Repository<AliyunConfigEntity>,
  ) {}

  async listAll(): Promise<SmsTemplateEntity[]> {
    return this.repo.find({ order: { id: 'ASC' } });
  }

  async listByScene(scene: SmsTemplateScene): Promise<SmsTemplateEntity[]> {
    return this.repo.find({ where: { scene }, order: { isDefault: 'DESC' } });
  }

  async getDefault(scene: SmsTemplateScene): Promise<SmsTemplateEntity | null> {
    return this.repo.findOne({
      where: { scene, isDefault: 1, status: SmsTemplateStatus.APPROVED },
    });
  }

  async getById(id: number): Promise<SmsTemplateEntity> {
    const t = await this.repo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('短信模板不存在');
    return t;
  }

  async create(payload: {
    scene: SmsTemplateScene;
    name: string;
    signName?: string;
    content: string;
    remark?: string;
    setDefault?: boolean;
  }): Promise<SmsTemplateEntity> {
    if (!payload.content) throw new BadRequestException('模板内容必填');
    const variables = this.extractVariables(payload.content);
    if (variables.length === 0) {
      throw new BadRequestException('模板必须至少包含 1 个变量，例如 ${code}');
    }
    const entity = this.repo.create({
      scene: payload.scene,
      name: payload.name,
      signName: payload.signName || '舆情监测',
      templateContent: payload.content,
      variables,
      isDefault: payload.setDefault ? 1 : 0,
      remark: payload.remark || null,
      status: SmsTemplateStatus.DRAFT,
      templateCode: null,
    });
    if (payload.setDefault) {
      await this.unsetOthersDefault(payload.scene);
    }
    const saved = await this.repo.save(entity);
    this.logger.log(`Template created: scene=${payload.scene} id=${saved.id}`);
    return saved;
  }

  async update(
    id: number,
    payload: {
      name?: string;
      signName?: string;
      content?: string;
      remark?: string;
      setDefault?: boolean;
      status?: SmsTemplateStatus;
    },
  ): Promise<SmsTemplateEntity> {
    const t = await this.getById(id);
    if (payload.name !== undefined) t.name = payload.name;
    if (payload.signName !== undefined) t.signName = payload.signName;
    if (payload.content !== undefined) {
      t.templateContent = payload.content;
      t.variables = this.extractVariables(payload.content);
    }
    if (payload.remark !== undefined) t.remark = payload.remark;
    if (payload.status !== undefined) t.status = payload.status;
    if (payload.setDefault !== undefined && payload.setDefault) {
      await this.unsetOthersDefault(t.scene);
      t.isDefault = 1;
    }
    return this.repo.save(t);
  }

  async delete(id: number): Promise<void> {
    const t = await this.getById(id);
    if (t.isDefault === 1) {
      throw new BadRequestException('默认模板不可删除，可先取消默认或创建替代默认模板');
    }
    await this.repo.remove(t);
  }

  async setDefault(id: number): Promise<SmsTemplateEntity> {
    const t = await this.getById(id);
    await this.unsetOthersDefault(t.scene);
    t.isDefault = 1;
    return this.repo.save(t);
  }

  async initDefaults(): Promise<{ created: number }> {
    let created = 0;
    for (const [scene, def] of Object.entries(DEFAULT_TEMPLATES)) {
      const exists = await this.repo.findOne({ where: { scene: scene as SmsTemplateScene, name: def.name } });
      if (exists) continue;
      await this.repo.save(
        this.repo.create({
          scene: scene as SmsTemplateScene,
          name: def.name,
          signName: '舆情监测',
          templateContent: def.content,
          variables: this.extractVariables(def.content),
          isDefault: 1,
          status: SmsTemplateStatus.DRAFT,
          remark: '初始化默认模板',
        }),
      );
      created++;
    }
    return { created };
  }

  async submitForReview(id: number): Promise<SmsTemplateEntity> {
    const t = await this.getById(id);
    if (!t.templateContent) throw new BadRequestException('模板内容不能为空');
    if (!t.signName) throw new BadRequestException('签名不能为空');

    const result = await this.callAliyunCreateTemplate(t);
    t.status = SmsTemplateStatus.PENDING_REVIEW;
    t.templateCode = result.templateCode;
    t.submittedAt = new Date();
    await this.repo.save(t);
    return t;
  }

  async syncReviewStatus(id: number): Promise<SmsTemplateEntity> {
    const t = await this.getById(id);
    if (!t.templateCode) throw new BadRequestException('尚未提交审核');

    const cfg = await this.getSmsConfig();
    const api = this.buildClient(cfg);
    const runtime = new Util.RuntimeOptions({});
    const request = new api.QuerySmsTemplateRequest({
      templateCode: t.templateCode,
    });

    try {
      const resp = await api.querySmsTemplateWithOptions(request, runtime);
      const status = resp?.body?.templateStatus;
      const reason = resp?.body?.reason;
      if (status === 'AUDIT_PASSED' || status === 'PASS') {
        t.status = SmsTemplateStatus.APPROVED;
        t.approvedAt = new Date();
        t.rejectReason = null;
      } else if (status === 'AUDIT_NOT_PASS' || status === 'FAIL') {
        t.status = SmsTemplateStatus.REJECTED;
        t.rejectReason = reason || '审核未通过';
      }
      await this.repo.save(t);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Sync template status failed: ${msg}`);
      throw new BadRequestException(`查询审核状态失败: ${msg}`);
    }
    return t;
  }

  private async unsetOthersDefault(scene: SmsTemplateScene): Promise<void> {
    await this.repo.update({ scene, isDefault: 1 }, { isDefault: 0 });
  }

  private extractVariables(content: string): string[] {
    const re = /\$\{([^}]+)\}/g;
    const set = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = re.exec(content))) set.add(m[1].trim());
    return Array.from(set);
  }

  private async getSmsConfig(): Promise<AliyunConfigEntity> {
    const cfg = await this.configRepo.findOne({ where: { configType: 'sms' } });
    if (!cfg) throw new BadRequestException('阿里云短信服务未配置');
    cfg.accessKey = CryptoUtil.decrypt(cfg.accessKey);
    cfg.secretKey = CryptoUtil.decrypt(cfg.secretKey);
    return cfg;
  }

  private buildClient(cfg: AliyunConfigEntity): any {
    const openApiConfig = new OpenApi.Config({
      accessKeyId: cfg.accessKey,
      accessKeySecret: cfg.secretKey,
    });
    openApiConfig.endpoint = 'dysmsapi.aliyuncs.com';
    return new Dysmsapi20170525(openApiConfig);
  }

  private async callAliyunCreateTemplate(
    t: SmsTemplateEntity,
  ): Promise<{ templateCode: string }> {
    const cfg = await this.getSmsConfig();
    const api = this.buildClient(cfg);
    const runtime = new Util.RuntimeOptions({});

    const request = new api.AddSmsTemplateRequest({
      templateType: '0',
      templateName: t.name,
      templateContent: t.templateContent,
      remark: t.remark || t.name,
      signName: t.signName,
    });

    try {
      const resp = await api.addSmsTemplateWithOptions(request, runtime);
      const code = resp?.body?.templateCode;
      const status = resp?.body?.templateStatus;
      if (!code) {
        throw new BadRequestException(
          `阿里云未返回 templateCode: ${JSON.stringify(resp?.body)}`,
        );
      }
      return { templateCode: code };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`提交阿里云审核失败: ${msg}`);
    }
  }
}
