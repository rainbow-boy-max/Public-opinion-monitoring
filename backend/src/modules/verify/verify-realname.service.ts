import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import * as OpenApi from '@alicloud/openapi-client';
import { AliyunConfigEntity } from '../../database/entities';
import { CryptoUtil } from '../../utils/crypto.util';

const ENDPOINTS = [
  'cloudauth.aliyuncs.com',
  'cloudauth.cn-beijing.aliyuncs.com',
  'cloudauth.cn-shanghai.aliyuncs.com',
];

export interface RealNameVerifyInput {
  name: string;
  idCard: string;
  phone: string;
}

export interface RealNameVerifyResult {
  pass: boolean;
  bizCode: '1' | '2' | '3';
  subCode: string;
  isp?: string;
  message: string;
  recordId: string;
  attempts: number;
}

@Injectable()
export class VerifyRealnameService {
  private readonly logger = new Logger(VerifyRealnameService.name);

  constructor(
    @InjectRepository(AliyunConfigEntity)
    private configRepo: Repository<AliyunConfigEntity>,
  ) {}

  private async getConfig(): Promise<{ accessKey: string; secretKey: string }> {
    const config = await this.configRepo.findOne({
      where: { configType: 'real_name_verify' },
    });
    if (!config) {
      throw new BadRequestException('三要素认证服务未配置，请联系管理员');
    }
    if (!config.accessKey || !config.secretKey) {
      throw new BadRequestException('三要素认证 AccessKey/Secret 未配置');
    }
    return {
      accessKey: CryptoUtil.decrypt(config.accessKey),
      secretKey: CryptoUtil.decrypt(config.secretKey),
    };
  }

  private md5Lower(s: string): string {
    return createHash('md5').update(s).digest('hex').toLowerCase();
  }

  async verify(input: RealNameVerifyInput): Promise<RealNameVerifyResult> {
    if (!input.name || !input.idCard || !input.phone) {
      throw new BadRequestException('姓名、身份证号、手机号均不能为空');
    }
    if (!/^\d{17}[\dX]$/.test(input.idCard)) {
      throw new BadRequestException('身份证号格式不正确');
    }
    if (!/^1[3-9]\d{9}$/.test(input.phone)) {
      throw new BadRequestException('手机号格式不正确');
    }

    const cfg = await this.getConfig();
    const idCardMd5 = this.md5Lower(input.idCard);
    const phoneMd5 = this.md5Lower(input.phone);
    const nameMd5 = this.md5Lower(input.name);

    const params = {
      ParamType: 'md5',
      IdentifyNum: idCardMd5,
      UserName: nameMd5,
      Mobile: phoneMd5,
    };

    let lastError: any = null;
    for (let attempt = 0; attempt < ENDPOINTS.length; attempt++) {
      const endpoint = ENDPOINTS[attempt];
      try {
        const openApiConfig = new OpenApi.Config({
          accessKeyId: cfg.accessKey,
          accessKeySecret: cfg.secretKey,
        });
        openApiConfig.endpoint = endpoint;

        const Client = (OpenApi as any).default;
        const client = new Client(openApiConfig);
        const reqParams: any = {
          ParamType: 'md5',
          IdentifyNum: idCardMd5,
          UserName: nameMd5,
          Mobile: phoneMd5,
        };
        const openApiRequest = new (OpenApi as any).OpenApiRequest({
          queryParams: reqParams,
          action: 'Mobile3MetaDetailVerify',
          version: '2019-03-15',
          protocol: 'HTTPS',
          method: 'POST',
          authType: 'AK',
          bodyType: 'json',
          responseHeaders: ['Date', 'x-acs-request-id'],
          resultModel: 'JSON',
          body: '',
        });
        const Util = await import('@alicloud/tea-util');
        const runtime = new Util.RuntimeOptions({});
        const response = await client.doRPCRequest(
          'Mobile3MetaDetailVerify',
          '2019-03-15',
          'HTTPS',
          'POST',
          'AK',
          'json',
          openApiRequest,
          runtime,
        );

        const reqId = response?.headers?.['x-acs-request-id'] || `local-${Date.now()}`;
        const code = response?.body?.Code;

        if (code !== '200' && code !== 200) {
          lastError = new Error(response?.body?.Message || `阿里云 API code=${code}`);
          this.logger.warn(
            `Real-name attempt ${attempt + 1} (${endpoint}) code=${code} message=${response?.body?.Message}`,
          );
          continue;
        }

        const resultObj = response?.body?.ResultObject || {};
        const bizCodeRaw = resultObj.BizCode;
        const bizCode = (bizCodeRaw === '1' || bizCodeRaw === 1 ? '1' :
                        bizCodeRaw === '2' || bizCodeRaw === 2 ? '2' : '3') as '1' | '2' | '3';
        const subCode = resultObj.SubCode || '';
        const isp = resultObj.IspName;
        const pass = bizCode === '1' && subCode === '101';

        return {
          pass,
          bizCode,
          subCode,
          isp,
          message: this.translateAliyunResponse(bizCode, subCode),
          recordId: reqId,
          attempts: attempt + 1,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        lastError = err;
        this.logger.warn(`Real-name verify attempt ${attempt + 1} (${endpoint}) failed: ${msg}`);
      }
    }

    throw new ServiceUnavailableException(
      `三要素认证服务暂不可用 (${lastError?.message || '所有 endpoint 失败'})`,
    );
  }

  private translateAliyunResponse(bizCode: string, subCode: string): string {
    if (bizCode === '1') return '认证一致';
    if (bizCode === '3') return '查无记录';
    if (bizCode === '2') {
      switch (subCode) {
        case '201': return '姓名/身份证/手机号 不一致';
        case '202': return '姓名一致但身份证号不一致';
        case '203': return '姓名不一致但身份证号一致';
        case '204': return '姓名/身份证不匹配';
        default: return '实名信息不一致';
      }
    }
    return '认证失败';
  }
}
