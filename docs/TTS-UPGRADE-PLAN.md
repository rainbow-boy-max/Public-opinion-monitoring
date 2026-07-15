# TTS 语音合成服务升级方案

## 一、MiniMax TTS 国内服务切换

### 当前问题
当前代码使用海外 endpoint `https://api.minimax.io/v1/t2a_v2`，国内用户访问延迟高，且国内版不支持声音克隆功能。

### 整改方案

| 项目 | 当前 | 整改后 |
|------|------|--------|
| API 地址 | `api.minimax.io/v1/t2a_v2` | `api.minimax.chat/v1/t2a_v2`（国内） |
| 鉴权方式 | Bearer Token | Bearer Token + GroupId Header |
| 模型 | `speech-2.8-hd` | `speech-02-hd`（国内优化版） |
| 音色列表 | 海外音色 | 国内中文音色（20+ 系统音色） |
| 配置项 | apiKey | apiKey + groupId + endpoint 可选 |

### 国内 endpoint 关键差异
- **URL**: `https://api.minimax.chat/v1/t2a_v2`
- **GroupId**: 需拼接在 URL 末尾或通过 Header 传递
- **国内可用模型**: `speech-01`（仅中文）、`speech-02`（中文/英文/日文/韩文）
- **国内音色**: `male-qn-qingse`（青涩青年）、`male-qn-jingying`（精英青年）、`female-shaonv`（少女）、`female-yujie`（御姐）等

---

## 二、小米 MiMo-V2.5-TTS 接入方案

### 服务概述
小米 2026 年 3 月发布的 MiMo-V2.5-TTS 语音合成大模型，支持三种模型：

| Model ID | 功能 | 说明 |
|----------|------|------|
| `mimo-v2.5-tts` | 预置音色语音合成 | 8 种精品音色，支持唱歌模式 |
| `mimo-v2.5-tts-voicedesign` | 文本描述定制音色 | 用自然语言描述生成音色 |
| `mimo-v2.5-tts-voiceclone` | 音频样本复刻音色 | 上传样本克隆任意声音 |

### 核心能力
- 多风格切换：同一段语音内完成播报→低语→嘶吼的风格转场
- 多情绪混合："压抑的愤怒"、"带着哽咽的笑意"等复合情绪
- 多粒度控制：段落级→句子级→词级→字粒度的精细控制
- 方言支持：东北话、四川话、河南话、粤语、台湾腔
- 标签控制：通过 `(风格)` 和 `[音频标签]` 精细调节
- 角色扮演：支持孙悟空、林黛玉等角色人设
- 歌声合成：`(唱歌)` 标签触发

### 接入方式

**API 端点**: `https://api.xiaomimimo.com/v1/chat/completions`
**认证**: `api-key` 请求头（非 Bearer Token）
**格式**: OpenAI 兼容的 Chat Completions 格式

**请求示例**:
```json
{
  "model": "mimo-v2.5-tts",
  "messages": [
    {
      "role": "user",
      "content": "请用沉稳专业的语调，语速适中"
    },
    {
      "role": "assistant",
      "content": "今日舆情报告：品牌声量较昨日上升15%，负面占比下降至3.2%。"
    }
  ],
  "audio": {
    "format": "mp3",
    "voice": "冰糖"
  }
}
```

**响应示例**:
```json
{
  "choices": [{
    "message": {
      "audio": {
        "data": "<base64 编码的音频数据>",
        "expires_at": 1718400000
      }
    }
  }]
}
```

### 预置音色列表

| 音色名 | Voice ID | 语言 | 性别 |
|--------|----------|------|------|
| MiMo-默认 | mimo_default | 中/英 | 冰糖/Mia |
| 冰糖 | 冰糖 | 中文 | 女性 |
| 茉莉 | 茉莉 | 中文 | 女性 |
| 苏打 | 苏打 | 中文 | 男性 |
| 白桦 | 白桦 | 中文 | 男性 |
| Mia | Mia | 英文 | 女性 |
| Chloe | Chloe | 英文 | 女性 |
| Milo | Milo | 英文 | 男性 |
| Dean | Dean | 英文 | 男性 |

---

## 三、架构设计

```
┌─────────────────────────────────────────────────────────┐
│                    TtsService (策略模式)                  │
├──────────────────┬──────────────────┬───────────────────┤
│  MiniMaxProvider  │  XiaomiProvider   │  (预留扩展点)      │
│  minimax.chat     │  xiaomimimo.com   │                   │
│  T2A V2协议       │  ChatCompletions  │                   │
│  Bearer Token     │  api-key          │                   │
│  GroupId          │  (无需GroupId)    │                   │
├──────────────────┴──────────────────┴───────────────────┤
│                  统一返回: TtsResult                      │
│            { audioBase64, durationMs, format }           │
└─────────────────────────────────────────────────────────┘
```

### 多供应商抽象接口

```typescript
interface TtsProvider {
  readonly name: string;
  readonly displayName: string;
  readonly endpoint: string;

  synthesize(text: string, options: TtsOptions): Promise<TtsResult>;
  getVoices(): Promise<TtsVoice[]>;
  validateConfig(config: Record<string, string>): Promise<boolean>;
}

interface TtsOptions {
  voiceId: string;
  speed?: number;
  format?: 'mp3' | 'wav';
  volume?: number;
  // 小米特有
  styleDescription?: string;  // user message 中的风格描述
  // MiniMax 特有
  groupId?: string;
}

interface TtsResult {
  audioBase64: string;
  durationMs: number;
  format: 'mp3' | 'wav';
  provider: string;
}

interface TtsVoice {
  id: string;
  name: string;
  gender?: 'male' | 'female';
  language?: string;
  description?: string;
  provider: string;
}
```

---

## 四、后端变更清单

| 文件 | 改动 |
|------|------|
| `backend/src/modules/tts/tts.service.ts` | 重构为策略模式，抽离 `TtsProvider` 接口 |
| `backend/src/modules/tts/providers/minimax.provider.ts` | MiniMax 国内版 Provider |
| `backend/src/modules/tts/providers/xiaomi.provider.ts` | 小米 MiMo-V2.5-TTS Provider |
| `backend/src/modules/tts/tts.controller.ts` | 新增 `GET /tts/providers`，`POST /tts/synthesize` 接受 provider 参数 |
| `backend/src/modules/tts/tts.module.ts` | 注册多 Provider |
| `backend/src/modules/admin/admin.controller.ts` | TTS 配置支持多供应商 |
| `backend/.env` | 新增 `MIMO_TTS_API_KEY=` |

---

## 五、前端变更清单

| 文件 | 改动 |
|------|------|
| `frontend-admin/src/pages/TtsConfigPage.vue` | 供应商下拉选择 + 动态配置表单（不同供应商显示不同参数） |
| `frontend-user/src/pages/PrReportsPage.vue` | 语音播报支持供应商选择 |
| `frontend-admin/src/router/index.ts` | 无需变更 |

### TtsConfigPage 改版

```
┌─────────────────────────────────────────────┐
│  TTS 语音合成配置                             │
├─────────────────────────────────────────────┤
│  供应商: [MiniMax TTS ▼]  [小米语音合成 ▼]   │
├─────────────────────────────────────────────┤
│  MiniMax 配置:                              │
│  ├─ API Key: [________________________]     │
│  ├─ GroupId: [________________________]     │
│  └─ Endpoint: [api.minimax.chat/v1/... ]   │
│                                             │
│  小米配置:                                   │
│  └─ API Key: [________________________]     │
├─────────────────────────────────────────────┤
│  语音试听                                     │
│  ├─ 文字: [________________________]        │
│  ├─ 音色: [冰糖 ▼]                          │
│  ├─ 语速: [====o=========] 1.0             │
│  └─ [试听] [播放中...]                       │
├─────────────────────────────────────────────┤
│  可用音色列表                                 │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
│  │ 冰糖  │ │ 茉莉  │ │ 苏打  │ │ 白桦  │      │
│  │ 女性  │ │ 女性  │ │ 男性  │ │ 男性  │      │
│  └──────┘ └──────┘ └──────┘ └──────┘      │
└─────────────────────────────────────────────┘
```

---

## 六、实施步骤

1. 重构 `TtsService` 为策略模式，定义 `TtsProvider` 接口
2. 实现 `MiniMaxProvider`：国内 endpoint + GroupId
3. 实现 `XiaomiProvider`：Chat Completions + api-key 认证
4. 更新 `TtsController`：多供应商路由 + 语音列表动态返回
5. 更新 `TtsConfigPage.vue`：供应商切换 + 动态表单
6. 更新 `PrReportsPage.vue`：语音播报兼容供应商选择
7. 更新 `.env` 配置项
8. 端到端测试

---

## 七、价格对比

| 供应商 | 模型 | 计费方式 | 当前状态 |
|--------|------|----------|----------|
| MiniMax TTS | speech-02 | 按字符计费 | 正式商用 |
| 小米 MiMo TTS | mimo-v2.5-tts | 按 Token 计费 | 限时免费中 |

> 注意：小米 MiMo-V2.5-TTS 当前限时免费，请关注官方定价页面获取正式商用价格。

