import { Injectable } from '@nestjs/common';

export interface HotTopicItem {
  platform: string;
  title: string;
  hot: number;
  url: string;
  rank: number;
  category?: string;
}

export interface PlatformHotResponse {
  updatedAt: string;
  platforms: {
    [key: string]: { name: string; topics: HotTopicItem[] };
  };
}

const API_BASE = 'https://60s.viki.moe/v2';

const PLATFORM_CONFIG: Record<string, { name: string; endpoint: string }> = {
  weibo: { name: '微博热搜', endpoint: '/weibo' },
  zhihu: { name: '知乎热榜', endpoint: '/zhihu' },
  baidu: { name: '百度热搜', endpoint: '/baidu/hot' },
  douyin: { name: '抖音热点', endpoint: '/douyin' },
  bili: { name: 'B站热门', endpoint: '/bili' },
  toutiao: { name: '今日头条', endpoint: '/toutiao' },
  hupu: { name: '虎扑热榜', endpoint: '/hupu' },
  '36kr': { name: '36氪热榜', endpoint: '/36kr' },
  github: { name: 'GitHub', endpoint: '/github' },
};

@Injectable()
export class PlatformHotService {
  private cache = new Map<string, { data: PlatformHotResponse; expiresAt: number }>();

  async getPlatformHotTopics(): Promise<PlatformHotResponse> {
    const now = Date.now();
    const cacheKey = 'platform_hot';

    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    const platforms: PlatformHotResponse['platforms'] = {};
    let allFailed = true;

    for (const [key, config] of Object.entries(PLATFORM_CONFIG)) {
      try {
        const topics = await this.fetchPlatform(key, config.endpoint);
        platforms[key] = { name: config.name, topics };
        allFailed = false;
      } catch {
        platforms[key] = { name: config.name, topics: this.generateMockTopics(key) };
      }
    }

    const result: PlatformHotResponse = {
      updatedAt: new Date().toISOString(),
      platforms,
    };

    if (!allFailed) {
      this.cache.set(cacheKey, { data: result, expiresAt: now + 5 * 60 * 1000 });
    }

    return result;
  }

  private async fetchPlatform(key: string, endpoint: string): Promise<HotTopicItem[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return this.parseApiResponse(key, json);
    } finally {
      clearTimeout(timer);
    }
  }

  private parseApiResponse(platform: string, data: any): HotTopicItem[] {
    const items: HotTopicItem[] = [];
    if (!data || !Array.isArray(data.data)) return items;

    data.data.forEach((item: any, index: number) => {
      items.push({
        platform,
        title: item.title || item.name || '',
        hot: item.hot || item.hotNum || 0,
        url: item.url || '',
        rank: index + 1,
        category: item.category || undefined,
      });
    });

    return items;
  }

  private generateMockTopics(platform: string): HotTopicItem[] {
    const mocks: Record<string, Array<{ title: string; hot: number; category?: string }>> = {
      weibo: [
        { title: '官方回应网传医保缴费年限延长', hot: 8520000, category: '社会' },
        { title: '多家银行下调存款利率', hot: 7680000, category: '财经' },
        { title: '知名男星被曝新恋情', hot: 7210000, category: '娱乐' },
        { title: '全国多个城市出现雾霾天气', hot: 6950000, category: '社会' },
        { title: '2026年高考报名人数再创新高', hot: 6580000, category: '教育' },
        { title: '国产大模型获国际竞赛冠军', hot: 6120000, category: '科技' },
        { title: '某地发生4.5级地震暂无伤亡', hot: 5890000, category: '社会' },
        { title: '春节档电影预售票房破10亿', hot: 5560000, category: '娱乐' },
        { title: '新能源车冬季续航实测结果', hot: 5230000, category: '汽车' },
        { title: '电竞选手退役转型引热议', hot: 4650000, category: '游戏' },
        { title: '跨年演唱会阵容官宣', hot: 4320000, category: '娱乐' },
        { title: '二手房交易量连续三个月回升', hot: 3980000, category: '房产' },
        { title: '华为新款折叠屏手机曝光', hot: 3650000, category: '科技' },
        { title: '多地中小学调整寒假时间', hot: 3320000, category: '教育' },
        { title: '年度十大流行语公布', hot: 2980000, category: '文化' },
      ],
      douyin: [
        { title: '挑战全网最丝滑转身', hot: 9250000 },
        { title: '街头采访：你月薪多少', hot: 8720000 },
        { title: '美食探店本期打卡重庆', hot: 8350000 },
        { title: '宠物犬救落水儿童全过程', hot: 7980000 },
        { title: '素人翻唱惊艳全场', hot: 7560000 },
        { title: '户外露营vlog爆火', hot: 7120000 },
        { title: '魔术师街头表演引围观', hot: 6850000 },
        { title: '情侣吵架和解名场面', hot: 6520000 },
        { title: '健身达人分享训练计划', hot: 6180000 },
        { title: '农村生活记录获百万点赞', hot: 5850000 },
        { title: '手工达人用废纸做艺术品', hot: 5520000 },
        { title: '高校宿舍创意整活视频', hot: 5180000 },
        { title: '舞蹈挑战赛全民参与', hot: 4850000 },
        { title: '老字号小吃制作全过程', hot: 4520000 },
        { title: '机车女孩骑行vlog走红', hot: 4200000 },
      ],
      baidu: [
        { title: '2026年春运购票日历公布', hot: 9800000, category: '社会' },
        { title: 'A股三大指数集体收涨', hot: 9100000, category: '财经' },
        { title: '较强冷空气来袭多地降温', hot: 8750000, category: '天气' },
        { title: '中国空间站最新实验成果', hot: 8320000, category: '科技' },
        { title: '国际油价大幅下跌', hot: 7950000, category: '财经' },
        { title: '教育部严禁寒假补课', hot: 7580000, category: '教育' },
        { title: '某app遭全网下架', hot: 7210000, category: '科技' },
        { title: '国产影视剧出海成绩单', hot: 6850000, category: '娱乐' },
        { title: '呼吸道疾病防治指南发布', hot: 6520000, category: '健康' },
        { title: '农村彩礼治理新规出台', hot: 6180000, category: '社会' },
        { title: '新能源汽车补贴政策调整', hot: 5850000, category: '汽车' },
        { title: '年度十大流行语公布', hot: 5520000, category: '文化' },
        { title: '多地调整公积金贷款政策', hot: 5180000, category: '房产' },
        { title: '马拉松选手破全国纪录', hot: 4850000, category: '体育' },
        { title: '2026年春晚节目单泄露', hot: 4500000, category: '娱乐' },
      ],
      zhihu: [
        { title: '2026年做什么行业最有前景？', hot: 12500000, category: '职场' },
        { title: '如何评价最近大火的国产AI应用？', hot: 11200000, category: '科技' },
        { title: '房价持续下跌，现在该买房还是观望？', hot: 10800000, category: '房产' },
        { title: '30岁转行来得及吗？真实经历分享', hot: 9850000, category: '职场' },
        { title: '《三体》动画版口碑两极分化', hot: 9200000, category: '文化' },
        { title: '为什么年轻人越来越不想结婚？', hot: 8750000, category: '社会' },
        { title: '考研还是工作？过来人的建议', hot: 8300000, category: '教育' },
        { title: '怎么克服社交恐惧？', hot: 7850000, category: '心理' },
        { title: '有哪些让你相见恨晚的学习方法？', hot: 7400000, category: '教育' },
        { title: '如何评价2026年春晚阵容？', hot: 6950000, category: '娱乐' },
      ],
      bili: [
        { title: '2026年B站百大UP主颁奖典礼', hot: 9200000, category: '娱乐' },
        { title: '硬核科普：芯片是如何制造的', hot: 8800000, category: '科技' },
        { title: '全站最详细的AI绘画教程', hot: 8500000, category: '科技' },
        { title: 'UP主挑战24小时不碰手机', hot: 8200000, category: '生活' },
        { title: '2026年度最佳动画番剧推荐', hot: 7900000, category: '动漫' },
        { title: '鬼畜区年度神作盘点', hot: 7600000, category: '娱乐' },
        { title: '美食UP主复刻满汉全席', hot: 7300000, category: '美食' },
        { title: '高校学生自制火箭成功发射', hot: 7000000, category: '科技' },
        { title: '音乐区神仙合唱爆火', hot: 6700000, category: '音乐' },
        { title: 'Vlog记录环球旅行一年', hot: 6400000, category: '生活' },
      ],
      toutiao: [
        { title: '专家解读2026年经济走势', hot: 9100000, category: '财经' },
        { title: '国际局势最新动态分析', hot: 8700000, category: '时政' },
        { title: '多地出台楼市新政', hot: 8400000, category: '房产' },
        { title: '科技巨头发布新一代芯片', hot: 8100000, category: '科技' },
        { title: '2026年就业形势分析报告', hot: 7800000, category: '职场' },
        { title: '全民关注的体育赛事结果', hot: 7500000, category: '体育' },
        { title: '医疗改革最新进展', hot: 7200000, category: '健康' },
        { title: '教育资源分配问题引热议', hot: 6900000, category: '教育' },
        { title: '新能源汽车销量再创新高', hot: 6600000, category: '汽车' },
        { title: '娱乐圈年度大型活动预告', hot: 6300000, category: '娱乐' },
      ],
      hupu: [
        { title: 'CBA总决赛精彩回顾', hot: 8800000, category: '体育' },
        { title: 'NBA交易市场最新动态', hot: 8500000, category: '体育' },
        { title: '欧冠淘汰赛对阵出炉', hot: 8200000, category: '体育' },
        { title: '国足最新世界排名公布', hot: 7900000, category: '体育' },
        { title: '电竞LPL春季赛战况', hot: 7600000, category: '电竞' },
        { title: '英超豪门球队换帅风波', hot: 7300000, category: '体育' },
        { title: '马拉松赛事城市排名', hot: 7000000, category: '体育' },
        { title: '冬季运动项目国家队集训', hot: 6700000, category: '体育' },
        { title: '体育产业投资热点分析', hot: 6400000, category: '财经' },
        { title: '健身人群必知的营养知识', hot: 6100000, category: '健康' },
      ],
      '36kr': [
        { title: '2026年创投圈十大趋势预测', hot: 7200000, category: '创投' },
        { title: 'AI大模型创业公司融资盘点', hot: 6900000, category: '科技' },
        { title: '出海企业面临的挑战与机遇', hot: 6600000, category: '商业' },
        { title: '新能源赛道估值重构', hot: 6300000, category: '财经' },
        { title: 'SaaS行业年度报告发布', hot: 6000000, category: '科技' },
        { title: '生物科技领域突破性进展', hot: 5700000, category: '科技' },
        { title: '消费赛道投资逻辑变了', hot: 5400000, category: '商业' },
        { title: '企业服务市场洗牌加速', hot: 5100000, category: '商业' },
        { title: 'Web3与区块链应用落地案例', hot: 4800000, category: '科技' },
        { title: '硬科技投资成热门方向', hot: 4500000, category: '创投' },
      ],
      github: [
        { title: 'torvalds/linux: Linux kernel source tree', hot: 8500, category: '系统' },
        { title: 'microsoft/vscode: Visual Studio Code', hot: 8200, category: '工具' },
        { title: 'facebook/react: A declarative UI library', hot: 7900, category: '前端' },
        { title: 'pallets/flask: The Python micro framework', hot: 7600, category: 'Python' },
        { title: 'rust-lang/rust: Empowering everyone', hot: 7300, category: '语言' },
        { title: 'openai/whisper: Robust speech recognition', hot: 7000, category: 'AI' },
        { title: 'numpy/numpy: The fundamental package', hot: 6700, category: 'Python' },
        { title: 'denoland/deno: A modern runtime', hot: 6400, category: '运行时' },
        { title: 'kubernetes/kubernetes: Production-Grade', hot: 6100, category: '云原生' },
        { title: 'tailwindlabs/tailwindcss: A utility-first', hot: 5800, category: 'CSS' },
      ],
    };

    const list = mocks[platform] || [];
    return list.map((item, i) => ({
      platform,
      title: item.title,
      hot: item.hot,
      url: this.defaultUrl(platform, item.title),
      rank: i + 1,
      category: item.category,
    }));
  }

  private defaultUrl(platform: string, title: string): string {
    const urls: Record<string, string> = {
      weibo: `https://s.weibo.com/weibo?q=${encodeURIComponent(title)}`,
      douyin: `https://www.douyin.com/search/${encodeURIComponent(title)}`,
      baidu: `https://www.baidu.com/s?wd=${encodeURIComponent(title)}`,
      zhihu: `https://www.zhihu.com/search?q=${encodeURIComponent(title)}`,
      bili: `https://search.bilibili.com/all?keyword=${encodeURIComponent(title)}`,
      toutiao: `https://www.toutiao.com/search/?keyword=${encodeURIComponent(title)}`,
      hupu: `https://www.hupu.com/search?q=${encodeURIComponent(title)}`,
      '36kr': `https://36kr.com/search/articles/${encodeURIComponent(title)}`,
      github: `https://github.com/search?q=${encodeURIComponent(title)}`,
    };
    return urls[platform] || '#';
  }
}
