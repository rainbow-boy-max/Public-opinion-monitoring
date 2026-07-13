import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, createHmac } from 'crypto';
import { AliyunConfigEntity } from '../../database/entities';
import { CryptoUtil } from '../../utils/crypto.util';

const ENDPOINT_HOST = {
  common: 'cloudauth.aliyuncs.com',
  beijing: 'cloudauth.cn-beijing.aliyuncs.com',
  shanghai: 'cloudauth.cn-shanghai.aliyuncs.com',
} as const;

const ENDPOINT_LABEL = {
  common: '通用 (推荐)',
  beijing: '北京',
  shanghai: '上海',
} as const;

const API_VERSION = '2019-03-15';
const API_ACTION_VERIFY = 'Mobile3MetaDetailVerify';
const API_ACTION_TEST = 'GetUser';

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
  endpointUsed: string;
}

@Injectable()
export class VerifyRealnameService {
  private readonly logger = new Logger(VerifyRealnameService.name);

  constructor(
    @InjectRepository(AliyunConfigEntity)
    private configRepo: Repository<AliyunConfigEntity>,
  ) {}

  private async loadConfig(): Promise<{
    accessKey: string;
    secretKey: string;
    endpoint: 'common' | 'beijing' | 'shanghai';
    paramType: 'normal' | 'md5' | 'sm2';
  }> {
    const cfg = await this.configRepo.findOne({ where: { configType: 'real_name_verify' } });
    if (!cfg) throw new BadRequestException('三要素认证服务未配置');
    if (!cfg.accessKey || !cfg.secretKey) {
      throw new BadRequestException('AccessKey/Secret 未配置');
    }
    return {
      accessKey: CryptoUtil.decrypt(cfg.accessKey),
      secretKey: CryptoUtil.decrypt(cfg.secretKey),
      endpoint: (cfg.endpointType || 'common') as 'common' | 'beijing' | 'shanghai',
      paramType: (cfg.paramType || 'md5') as 'normal' | 'md5' | 'sm2',
    };
  }

  private md5Lower(s: string): string {
    return createHash('md5').update(s).digest('hex').toLowerCase();
  }

  /**
   * 阿里云 V3 签名
   * https://help.aliyun.com/document_detail/315526.html
   */
  private signV3(
    method: 'GET' | 'POST',
    action: string,
    queryParams: Record<string, string>,
    payload: Record<string, string>,
    accessKey: string,
    secretKey: string,
    host: string,
  ): { url: string; headers: Record<string, string>; timestamp: string } {
    const date = new Date().toISOString().replace(/\.\d{3}/, '');
    const timestamp = date;

    const headers: Record<string, string> = {
      host,
      'x-acs-date': timestamp,
      'x-acs-version': API_VERSION,
      'x-acs-action': action,
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      accept: 'application/json',
    };

    const allParams = { ...queryParams, ...payload };
    const sortedKeys = Object.keys(allParams).sort();
    const queryString = sortedKeys
      .map(
        (k) =>
          `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k]).replace(/%20/g, '+')}`,
      )
      .join('&');

    const bodyString = sortedKeys
      .map(
        (k) =>
          `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k]).replace(/%20/g, '+')}`,
      )
      .join('&');

    const canonicalRequest = [
      method,
      '/',
      queryString,
      'host:' + host,
      'x-acs-action:' + action,
      'x-acs-date:' + timestamp,
      'x-acs-version:' + API_VERSION,
      'content-type:' + headers['content-type'],
      '',
      'host;x-acs-action;x-acs-date;x-acs-version;content-type',
    ].join('\n');

    const hash = createHash('sha256').update(canonicalRequest).digest('hex');
    const stringToSign = `ACS3-HMAC-SHA256\n${timestamp}\n${hash}`;

    const signature = createHmac('sha256', secretKey).update(stringToSign).digest('hex');

    const authHeader = `ACS3-HMAC-SHA256 Credential=${accessKey},SignedHeaders=host;x-acs-action;x-acs-date;x-acs-version;content-type,Signature=${signature}`;

    const finalHeaders = {
      ...headers,
      accept: 'application/json',
      authorization: authHeader,
    };

    const url = `https://${host}/${queryString ? '?' + queryString : ''}`;
    return { url: `https://${host}/`, headers: finalHeaders, timestamp };
  }

  private async callAliyun(
    action: string,
    params: Record<string, string>,
    cfg: Awaited<ReturnType<typeof this.loadConfig>>,
    extraHeaders: Record<string, string> = {},
  ): Promise<any> {
    const host = ENDPOINT_HOST[cfg.endpoint];
    const timestamp = new Date().toISOString().replace(/\.\d{3}/, '');
    const bodyString = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v).replace(/%20/g, '+')}`)
      .sort()
      .join('&');

    const headers: Record<string, string> = {
      host,
      'x-acs-date': timestamp,
      'x-acs-action': action,
      'x-acs-version': API_VERSION,
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      ...extraHeaders,
    };

    const canonicalRequest = [
      'POST',
      '/',
      '',
      ...Object.keys(headers)
        .sort()
        .map((k) => `${k}:${headers[k]}`)
        .join('\n'),
      '',
      Object.keys(headers).sort().join(';'),
    ].join('\n');

    void bodyString;

    const hash = createHash('sha256').update(canonicalRequest).digest('hex');
    const stringToSign = `ACS3-HMAC-SHA256\n${timestamp}\n${hash}`;
    const signature = createHmac('sha256', cfg.secretKey).update(stringToSign).digest('hex');

    const authHeader = `ACS3-HMAC-SHA256 Credential=${cfg.accessKey},SignedHeaders=${Object.keys(headers).sort().join(';')},Signature=${signature}`;

    const response = await fetch(`https://${host}/`, {
      method: 'POST',
      headers: {
        ...headers,
        authorization: authHeader,
      },
      body: bodyString,
    });

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return { _raw: text, _status: response.status };
    }
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

    const cfg = await this.loadConfig();
    const idCard = cfg.paramType === 'md5' ? this.md5Lower(input.idCard) : input.idCard;
    const phone = cfg.paramType === 'md5' ? this.md5Lower(input.phone) : input.phone;
    const name = cfg.paramType === 'md5' ? this.md5Lower(input.name) : input.name;

    const params = {
      ParamType: cfg.paramType,
      IdentifyNum: idCard,
      UserName: name,
      Mobile: phone,
    };

    const endpoints: Array<'common' | 'beijing' | 'shanghai'> = [cfg.endpoint];
    for (const e of ['common', 'beijing', 'shanghai'] as const) {
      if (e !== cfg.endpoint) endpoints.push(e);
    }

    let lastError: any = null;
    for (let attempt = 0; attempt < endpoints.length; attempt++) {
      const endpoint = endpoints[attempt];
      try {
        const localCfg = { ...cfg, endpoint };
        const result = await this.callAliyun(API_ACTION_VERIFY, params, localCfg);
        const reqId = result?.RequestId || `local-${Date.now()}`;
        const code = result?.Code;
        const mainMsg = result?.Message || '';

        if (code !== '200' && code !== 200) {
          lastError = new Error(mainMsg || `阿里云返回 code=${code}`);
          this.logger.warn(
            `Real-name attempt ${attempt + 1} endpoint=${endpoint} code=${code} message=${mainMsg}`,
          );
          continue;
        }

        const resultObj = result?.ResultObject || {};
        const bizCodeRaw = resultObj.BizCode;
        const bizCode = bizCodeRaw === '1' || bizCodeRaw === 1 ? '1' :
                        bizCodeRaw === '2' || bizCodeRaw === 2 ? '2' : '3';
        const subCode = resultObj.SubCode || '';
        const isp = resultObj.IspName;
        const pass = bizCode === '1' && subCode === '101';

        return {
          pass,
          bizCode,
          subCode,
          isp,
          message: this.translateResponse(bizCode, subCode),
          recordId: reqId,
          attempts: attempt + 1,
          endpointUsed: ENDPOINT_LABEL[endpoint],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        lastError = err;
        this.logger.warn(`Real-name attempt ${attempt + 1} (${endpoint}) failed: ${msg}`);
      }
    }

    throw new ServiceUnavailableException(
      `三要素认证服务暂不可用 (${lastError?.message || '所有 endpoint 失败'})`,
    );
  }

  async testConnection(): Promise<{
    ok: boolean;
    message: string;
    latencyMs: number;
    endpointUsed?: string;
  }> {
    const cfg = await this.loadConfig();
    const startTime = Date.now();
    const params = {
      UserName: 'sdk-test-' + Date.now(),
    };

    try {
      const result = await this.callAliyun(API_ACTION_TEST, params, cfg);
      const latency = Date.now() - startTime;
      const code = result?.Code;
      const msg = result?.Message || '';

      if (code === '200' || code === 200) {
        return {
          ok: true,
          message: 'AccessKey 验证通过，可以调用三要素认证接口',
          latencyMs: latency,
          endpointUsed: ENDPOINT_LABEL[cfg.endpoint],
        };
      }
      if (code === 'InvalidAccessKeyId.NotFound' || msg.toLowerCase().includes('invalidaccesskeyid')) {
        return {
          ok: false,
          message: `AccessKey ID 无效: ${msg}`,
          latencyMs: latency,
          endpointUsed: ENDPOINT_LABEL[cfg.endpoint],
        };
      }
      if (code === 'SignatureDoesNotMatch' || msg.toLowerCase().includes('signaturedoesnotmatch')) {
        return {
          ok: false,
          message: `AccessKey Secret 签名验证失败: ${msg}`,
          latencyMs: latency,
          endpointUsed: ENDPOINT_LABEL[cfg.endpoint],
        };
      }

      return {
        ok: msg.toLowerCase().includes('usernotfound') || msg.toLowerCase().includes('usernamenotfound'),
        message: msg || `服务端返回 code=${code}`,
        latencyMs: latency,
        endpointUsed: ENDPOINT_LABEL[cfg.endpoint],
      };
    } catch (err) {
      return {
        ok: false,
        message: `请求失败: ${(err as Error).message}`,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  private translateResponse(bizCode: string, subCode: string): string {
    if (bizCode === '1') return '认证一致';
    if (bizCode === '3') return '查无记录';
    if (bizCode === '2') {
      switch (subCode) {
        case '201': return '姓名/身份证/手机号 三要素均不一致';
        case '202': return '姓名与手机号一致，但身份证不一致';
        case '203': return '姓名不一致，但手机号与身份证一致';
        case '204': return '其他不一致情况';
        default: return '实名信息不一致';
      }
    }
    return '认证失败';
  }
}
