# Phase 7.2 实施指南 - 短视频监测完整实现

## 实施说明

Phase 7.2 需要对接第三方平台 API 和云服务，涉及以下外部依赖：

### 必需的第三方服务

1. **抖音开放平台**
   - 申请地址：https://developer.open-douyin.com/
   - 审核周期：1-2 周
   - 所需资质：企业营业执照
   - 所需权限：视频搜索、视频详情

2. **快手开放平台**
   - 申请地址：https://open.kuaishou.com/
   - 审核周期：1-2 周
   - 所需资质：企业营业执照

3. **阿里云 OSS**
   - 用途：视频和抽帧图片存储
   - 费用：约 ¥0.12/GB/月

4. **阿里云视频内容理解**
   - 用途：视频 OCR（画面文字识别）
   - 费用：约 ¥0.5/次

5. **阿里云语音识别**
   - 用途：视频 ASR（语音转文字）
   - 费用：约 ¥0.3/分钟

### 当前交付内容

由于上述服务需要企业资质申请，当前交付：
- ✅ 完整的代码实现框架
- ✅ Mock 数据模拟真实场景
- ✅ 详细的集成步骤文档
- ✅ 配置清单与测试用例

后续只需：
1. 申请上述服务账号
2. 填入环境变量
3. 替换 mock 代码为真实 API 调用

---

## 环境变量配置清单

```env
# ========== 抖音开放平台 ==========
DOUYIN_APP_KEY=your-app-key-here
DOUYIN_APP_SECRET=your-app-secret-here
DOUYIN_API_BASE_URL=https://open.douyin.com

# ========== 快手开放平台 ==========
KUAISHOU_APP_KEY=your-app-key-here
KUAISHOU_APP_SECRET=your-app-secret-here
KUAISHOU_API_BASE_URL=https://open.kuaishou.com

# ========== 阿里云配置 ==========
ALIYUN_ACCESS_KEY_ID=your-access-key-id
ALIYUN_ACCESS_KEY_SECRET=your-access-key-secret
ALIYUN_REGION_ID=cn-hangzhou

# OSS 存储
ALIYUN_OSS_BUCKET=your-bucket-name
ALIYUN_OSS_ENDPOINT=oss-cn-hangzhou.aliyuncs.com

# 视频内容理解（OCR）
ALIYUN_VCA_ENDPOINT=vca.cn-hangzhou.aliyuncs.com

# 语音识别（ASR）
ALIYUN_ASR_APP_KEY=your-asr-app-key
ALIYUN_ASR_ENDPOINT=nls-gateway-cn-shanghai.aliyuncs.com

# ========== 功能开关 ==========
# 是否启用真实 API（false 使用 mock 数据）
ENABLE_REAL_API=false

# 是否自动触发 OCR/ASR（false 需手动触发）
AUTO_TRIGGER_OCR=true
AUTO_TRIGGER_ASR=true
```

---

## 抖音开放平台集成步骤

### 1. 申请开发者账号

1. 访问 https://developer.open-douyin.com/
2. 注册企业开发者账号
3. 完成企业认证（需营业执照）

### 2. 创建应用

1. 进入「应用管理」
2. 创建「服务端应用」
3. 填写应用信息：
   - 应用名称：全网舆情监测系统
   - 应用简介：短视频内容监测与分析
   - 应用类型：数据服务

### 3. 申请接口权限

在应用详情中申请以下权限：
- `video.search`：视频搜索
- `video.data`：视频详情
- `user.info`：用户信息

提交材料：
- 使用场景说明（舆情监测）
- 数据安全承诺书

### 4. 获取密钥

审核通过后，在「密钥管理」中获取：
- App Key
- App Secret

### 5. SDK 安装（可选）

```bash
npm install @douyin/openapi-sdk
```

### 6. 代码集成示例

```typescript
import { DouyinClient } from '@douyin/openapi-sdk';

const client = new DouyinClient({
  appKey: process.env.DOUYIN_APP_KEY,
  appSecret: process.env.DOUYIN_APP_SECRET,
});

// 搜索视频
const result = await client.video.search({
  keyword: '关键词',
  count: 20,
  cursor: 0,
});

// 获取视频详情
const video = await client.video.getDetail({
  itemId: 'video_id',
});
```

---

## 阿里云 OCR 集成步骤

### 1. 开通服务

1. 登录阿里云控制台
2. 搜索「视频内容理解」
3. 开通服务并完成实名认证

### 2. 创建 AccessKey

1. 进入「AccessKey 管理」
2. 创建 AccessKey（记录 ID 和 Secret）
3. 配置 RAM 权限：`AliyunVCAFullAccess`

### 3. SDK 安装

```bash
npm install @alicloud/vca20220516
npm install @alicloud/openapi-client
```

### 4. 代码集成示例

```typescript
import VCA from '@alicloud/vca20220516';
import * as $OpenApi from '@alicloud/openapi-client';

const config = new $OpenApi.Config({
  accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
  accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
  endpoint: process.env.ALIYUN_VCA_ENDPOINT,
});

const client = new VCA(config);

// 提交视频 OCR 任务
const request = new VCA.SubmitVideoOCRJobRequest({
  videoUrl: 'https://your-video-url.mp4',
  frameInterval: 1, // 每秒抽一帧
});

const response = await client.submitVideoOCRJob(request);
const jobId = response.body.data.jobId;

// 查询任务结果
const queryRequest = new VCA.GetVideoOCRResultRequest({
  jobId: jobId,
});

const result = await client.getVideoOCRResult(queryRequest);
console.log(result.body.data.ocrResults);
```

---

## 阿里云 ASR 集成步骤

### 1. 开通服务

1. 搜索「智能语音交互」
2. 开通「录音文件识别」服务

### 2. 创建项目

1. 进入「项目管理」
2. 创建项目并获取 AppKey

### 3. SDK 安装

```bash
npm install alibabacloud-nls-node-sdk
```

### 4. 代码集成示例

```typescript
import { NlsClient } from 'alibabacloud-nls-node-sdk';

const client = new NlsClient({
  accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
  accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
  appKey: process.env.ALIYUN_ASR_APP_KEY,
});

// 提交音频识别任务
const taskId = await client.submitRecognitionTask({
  fileUrl: 'https://your-audio-url.mp3',
  enablePunctuation: true,
  enableSentenceDetection: true,
});

// 查询任务结果
const result = await client.getRecognitionResult({
  taskId: taskId,
});

console.log(result.sentences); // 识别文本数组
```

---

## FFmpeg 安装与使用

### 1. 安装 FFmpeg

**Ubuntu/Debian:**
```bash
apt-get update
apt-get install -y ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

**验证安装:**
```bash
ffmpeg -version
```

### 2. Node.js 集成

```bash
npm install fluent-ffmpeg
npm install @types/fluent-ffmpeg --save-dev
```

### 3. 视频抽帧示例

```typescript
import ffmpeg from 'fluent-ffmpeg';
import { promisify } from 'util';

async function extractFrames(videoPath: string, outputDir: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const frames: string[] = [];
    
    ffmpeg(videoPath)
      .on('filenames', (filenames) => {
        frames.push(...filenames.map(f => `${outputDir}/${f}`));
      })
      .on('end', () => resolve(frames))
      .on('error', reject)
      .screenshots({
        count: 10, // 抽取 10 帧
        folder: outputDir,
        filename: 'frame_%i.jpg',
      });
  });
}
```

### 4. 音频提取示例

```typescript
async function extractAudio(videoPath: string, outputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioCodec('pcm_s16le')
      .audioChannels(1)
      .audioFrequency(16000)
      .format('wav')
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .save(outputPath);
  });
}
```

---

## 费用估算

### 按月 10,000 个视频计算

| 服务 | 单价 | 用量 | 月费用 |
|------|------|------|--------|
| 阿里云 OSS 存储 | ¥0.12/GB/月 | 100GB | ¥12 |
| 视频 OCR | ¥0.5/次 | 10,000 次 | ¥5,000 |
| 语音识别（5min/视频） | ¥0.3/分钟 | 50,000 分钟 | ¥15,000 |
| **合计** | - | - | **¥20,012** |

### 成本优化建议

1. **仅对重点视频进行 OCR/ASR**
   - 设置优先级规则（播放量 > 10万）
   - 预估节省 70% 成本

2. **使用本地 Whisper 模型替代云 ASR**
   - 一次性成本：GPU 服务器
   - 月度成本：¥0
   - 适合大规模场景

3. **OSS 生命周期管理**
   - 30 天后转归档存储
   - 节省 60% 存储费用

---

## 测试清单

### 功能测试

- [ ] 视频采集服务（mock 模式）
- [ ] 视频 OCR 队列任务
- [ ] 视频 ASR 队列任务
- [ ] 语义分析队列任务
- [ ] 视频列表查询（分页、筛选）
- [ ] 视频详情查询（含帧、转录）
- [ ] 事件关联功能

### 性能测试

- [ ] 单次采集 100 个视频耗时
- [ ] OCR 队列并发处理能力
- [ ] ASR 队列并发处理能力
- [ ] 数据库查询性能（10万+ 视频）

### 集成测试

- [ ] 端到端流程：采集 → OCR → ASR → 分析 → 关联
- [ ] 错误处理与重试机制
- [ ] 队列任务失败恢复

---

## 后续优化方向

1. **本地化 ASR 方案**
   - 部署 Whisper 模型
   - 降低云服务成本

2. **智能抽帧算法**
   - 场景切换检测
   - 关键帧提取
   - 减少 OCR 调用次数

3. **分布式采集**
   - 多账号轮询
   - IP 代理池
   - 避免平台限流

4. **实时监测**
   - WebSocket 推送
   - 热点视频实时预警

---

**文档版本**：v1.0  
**更新日期**：2026-07-22  
**负责人**：MonkeyCode AI 团队
