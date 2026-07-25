# 短视频监测模块 (Short Video Monitoring)

## Phase 7.1 - 核心架构与可扩展框架

本模块为 Phase 7 升级计划的第一阶段交付，提供短视频监测的完整数据模型、服务架构与队列任务框架。

---

## 已实现组件

### 1. 数据模型

#### ShortVideoEntity (short_videos)
- 平台类型：抖音、快手、微信视频号、B站
- 视频元数据：标题、描述、作者、发布时间
- 互动数据：点赞、评论、分享、播放数
- 处理状态：pending → ocr_processing → asr_processing → analyzing → completed
- 分析结果：OCR 文本、ASR 文本、语义摘要、情感、标签
- 事件关联：关联到 OpinionEventEntity

#### VideoFrameEntity (video_frames)
- 视频抽帧记录
- 帧序号、时间戳、图片 URL
- OCR 识别文本与置信度

#### VideoTranscriptEntity (video_transcripts)
- 视频语音转录记录
- 时间段（start_time, end_time）
- ASR 识别文本与置信度
- 说话人标识

### 2. 服务层

#### ShortVideoService
- `createVideo()`: 创建视频记录并触发 OCR/ASR 队列
- `findAll()`: 分页查询，支持平台、关键词过滤
- `findOne()`: 查询视频详情（含关联事件）
- `updateProcessStatus()`: 更新处理状态
- `updateOcrText()` / `updateAsrText()`: 更新识别文本
- `updateSemanticAnalysis()`: 更新语义分析结果
- `saveFrame()` / `saveTranscript()`: 保存帧/转录记录
- `getFrames()` / `getTranscripts()`: 查询帧/转录记录

#### VideoCollectorService (待实现)
- 抖音开放平台 API 集成
- 快手开放平台 API 集成
- 微信视频号爬虫（需合规评估）
- B站 API 集成

### 3. 队列任务（Bull Queue）

#### video-ocr 队列
- Job: `extract-frames`
- Processor: `VideoOcrProcessor`
- 功能：视频抽帧 → OCR 识别 → 保存帧记录 → 更新视频 OCR 文本

#### video-asr 队列
- Job: `transcribe-audio`
- Processor: `VideoAsrProcessor`
- 功能：提取音频 → ASR 识别 → 保存转录记录 → 更新视频 ASR 文本

#### video-analysis 队列
- Job: `analyze-content`
- Processor: `VideoAnalysisProcessor`
- 功能：整合 OCR + ASR → LLM 语义分析 → 情感识别 → 事件关联

---

## Phase 7.2 - 后续开发任务

### 任务 1: 实现视频采集服务 (VideoCollectorService)

**目标**：对接抖音、快手开放平台 API，采集视频元数据。

**技术方案**：
1. 申请抖音开放平台账号，获取 App Key 和 Secret
   - 文档：https://developer.open-douyin.com/
   - 所需权限：视频搜索、视频详情、用户信息

2. 申请快手开放平台账号
   - 文档：https://open.kuaishou.com/

3. 实现 API 调用封装
   ```typescript
   class DouyinApiClient {
     async searchVideos(keyword: string, page: number): Promise<DouyinVideo[]>
     async getVideoDetail(videoId: string): Promise<DouyinVideoDetail>
   }
   ```

4. 定时任务采集
   ```typescript
   @Cron('0 */30 * * * *') // 每 30 分钟
   async collectVideos() {
     const keywords = await this.getMonitorKeywords();
     for (const keyword of keywords) {
       const videos = await this.douyinClient.searchVideos(keyword);
       for (const video of videos) {
         await this.shortVideoService.createVideo(video);
       }
     }
   }
   ```

**预计工期**：2 周

---

### 任务 2: 实现视频 OCR 识别 (VideoOcrProcessor)

**目标**：视频抽帧 + OCR 提取画面文字。

**技术方案**：
1. 选择 OCR 服务商
   - 阿里云视频内容理解：https://help.aliyun.com/product/99925.html
   - 腾讯云视频内容识别：https://cloud.tencent.com/product/vca

2. 视频抽帧
   - 使用 FFmpeg：`ffmpeg -i video.mp4 -vf fps=1 frame_%04d.jpg`
   - 或使用阿里云视频抽帧 API

3. OCR 识别
   ```typescript
   import OSS from 'ali-oss';
   import { VideoContentUnderstandingClient } from '@alicloud/vca20220516';

   async process(job: Job<{ videoId: number }>) {
     const video = await this.shortVideoService.findOne(job.data.videoId);
     
     // 1. 提交视频抽帧任务
     const frames = await this.extractFrames(video.videoUrl);
     
     // 2. 对每一帧进行 OCR
     const ocrResults = [];
     for (const frame of frames) {
       const text = await this.ocrClient.recognizeText(frame.url);
       await this.shortVideoService.saveFrame({
         videoId: video.id,
         frameIndex: frame.index,
         timestamp: frame.timestamp,
         frameUrl: frame.url,
         ocrText: text,
       });
       ocrResults.push(text);
     }
     
     // 3. 合并去重文本
     const ocrText = [...new Set(ocrResults.flat())].join(' ');
     await this.shortVideoService.updateOcrText(video.id, ocrText);
   }
   ```

**预计工期**：2 周

---

### 任务 3: 实现语音识别 (VideoAsrProcessor)

**目标**：提取视频音频 + ASR 转文字。

**技术方案**：
1. 选择 ASR 服务商
   - 阿里云语音识别：https://ai.aliyun.com/nls/asr
   - 腾讯云语音识别：https://cloud.tencent.com/product/asr

2. 提取音频
   - 使用 FFmpeg：`ffmpeg -i video.mp4 -vn -acodec pcm_s16le audio.wav`

3. ASR 识别
   ```typescript
   import NlsClient from 'nls-client';

   async process(job: Job<{ videoId: number }>) {
     const video = await this.shortVideoService.findOne(job.data.videoId);
     
     // 1. 提取音频
     const audioUrl = await this.extractAudio(video.videoUrl);
     
     // 2. 提交 ASR 任务
     const transcripts = await this.asrClient.transcribe(audioUrl);
     
     // 3. 保存转录记录
     for (const transcript of transcripts) {
       await this.shortVideoService.saveTranscript({
         videoId: video.id,
         startTime: transcript.begin_time,
         endTime: transcript.end_time,
         text: transcript.text,
         confidence: transcript.confidence,
       });
     }
     
     // 4. 合并完整文本
     const asrText = transcripts.map(t => t.text).join(' ');
     await this.shortVideoService.updateAsrText(video.id, asrText);
   }
   ```

**预计工期**：2 周

---

### 任务 4: 实现语义分析 (VideoAnalysisProcessor)

**目标**：整合 OCR + ASR → LLM 语义理解 → 事件关联。

**技术方案**：
1. 整合多模态内容
   ```typescript
   const content = `
   视频标题: ${video.title}
   视频描述: ${video.description}
   画面文字(OCR): ${video.ocrText}
   口播内容(ASR): ${video.asrText}
   `;
   ```

2. LLM 语义分析
   ```typescript
   const prompt = `
   请分析以下短视频内容，提取关键信息：
   
   ${content}
   
   请以 JSON 格式输出：
   {
     "summary": "视频内容摘要（50字内）",
     "sentiment": "positive/negative/neutral",
     "tags": ["标签1", "标签2"],
     "mainTopic": "主要话题",
     "entities": ["实体1", "实体2"]
   }
   `;
   
   const result = await this.llmService.complete(prompt);
   await this.shortVideoService.updateSemanticAnalysis(video.id, {
     semanticSummary: result.summary,
     sentiment: result.sentiment,
     tags: result.tags,
   });
   ```

3. 事件关联
   ```typescript
   // 基于关键词匹配或向量相似度，关联到现有舆情事件
   const relatedEvent = await this.findRelatedEvent(result.mainTopic, result.entities);
   if (relatedEvent) {
     await this.shortVideoService.updateSemanticAnalysis(video.id, {
       relatedEventId: relatedEvent.id,
     });
   }
   ```

**预计工期**：1.5 周

---

### 任务 5: 实现前端页面

**目标**：短视频监测配置 + 视频列表 + 视频详情页。

**页面结构**：
1. 短视频监测配置
   - 监测关键词管理
   - 平台选择（抖音、快手、视频号）
   - 采集频率设置

2. 短视频列表
   - 表格展示：封面、标题、作者、平台、发布时间、互动数据
   - 筛选：平台、关键词、发布时间范围
   - 排序：播放量、点赞数、发布时间

3. 视频详情页
   - 视频播放器
   - 元数据展示
   - OCR 文本展示
   - ASR 文本展示（带时间戳）
   - 语义分析结果
   - 关联舆情事件

**预计工期**：1.5 周

---

## 技术依赖

### 后端依赖
```json
{
  "@alicloud/vca20220516": "^1.0.0",
  "@alicloud/dysmsapi20170525": "^2.0.0",
  "ali-oss": "^6.18.0",
  "nls-client": "^1.0.0",
  "fluent-ffmpeg": "^2.1.2"
}
```

### 云服务账号
- 阿里云 OSS（视频存储）
- 阿里云视频内容理解（OCR）
- 阿里云语音识别（ASR）
- 抖音开放平台
- 快手开放平台

### 环境变量
```env
# 抖音开放平台
DOUYIN_APP_KEY=your-app-key
DOUYIN_APP_SECRET=your-app-secret

# 快手开放平台
KUAISHOU_APP_KEY=your-app-key
KUAISHOU_APP_SECRET=your-app-secret

# 阿里云
ALIYUN_ACCESS_KEY_ID=your-access-key
ALIYUN_ACCESS_KEY_SECRET=your-secret
ALIYUN_OSS_BUCKET=your-bucket
ALIYUN_VCA_ENDPOINT=your-endpoint
ALIYUN_ASR_APPKEY=your-appkey
```

---

## 性能优化建议

1. **OCR 并发优化**
   - 使用 Bull 队列并发处理多个帧
   - 限制并发数避免 API 限流

2. **ASR 成本优化**
   - 仅对关键视频进行 ASR
   - 使用低成本 ASR 服务（如本地 Whisper 模型）

3. **存储优化**
   - 视频帧图片存储到 OSS
   - 定期清理历史帧数据

4. **缓存优化**
   - Redis 缓存视频列表
   - 缓存 LLM 分析结果

---

## 测试清单

- [ ] 视频创建与队列触发
- [ ] OCR 队列任务执行
- [ ] ASR 队列任务执行
- [ ] 语义分析任务执行
- [ ] 视频列表查询（分页、筛选）
- [ ] 视频详情查询
- [ ] 事件关联功能
- [ ] 错误处理与重试机制

---

## 集成到主模块

在 `app.module.ts` 中导入：

```typescript
import { ShortVideoModule } from './modules/short-video/short-video.module';

@Module({
  imports: [
    // ... 其他模块
    ShortVideoModule,
  ],
})
export class AppModule {}
```

---

**当前状态**：Phase 7.1 核心架构已完成  
**下一步**：实施 Phase 7.2 完整开发（需 6 周）  
**负责人**：后端团队  
**文档更新**：2026-07-22
