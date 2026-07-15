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
    weibo: { name: string; topics: HotTopicItem[] };
    douyin: { name: string; topics: HotTopicItem[] };
    baidu: { name: string; topics: HotTopicItem[] };
    zhihu: { name: string; topics: HotTopicItem[] };
    xiaohongshu: { name: string; topics: HotTopicItem[] };
  };
}

@Injectable()
export class PlatformHotService {
  getPlatformHotTopics(): Promise<PlatformHotResponse> {
    const now = new Date().toISOString();
    return Promise.resolve({
      updatedAt: now,
      platforms: {
        weibo: { name: '微博热搜', topics: this.generateWeiboTopics() },
        douyin: { name: '抖音热榜', topics: this.generateDouyinTopics() },
        baidu: { name: '百度热搜', topics: this.generateBaiduTopics() },
        zhihu: { name: '知乎热榜', topics: this.generateZhihuTopics() },
        xiaohongshu: { name: '小红书热门', topics: this.generateXiaohongshuTopics() },
      },
    });
  }

  private generateWeiboTopics(): HotTopicItem[] {
    const list = [
      { title: '官方回应网传医保缴费年限延长', hot: 8520000, category: '社会' },
      { title: '多家银行下调存款利率', hot: 7680000, category: '财经' },
      { title: '知名男星被曝新恋情', hot: 7210000, category: '娱乐' },
      { title: '全国多个城市出现雾霾天气', hot: 6950000, category: '社会' },
      { title: '2026年高考报名人数再创新高', hot: 6580000, category: '教育' },
      { title: '国产大模型获国际竞赛冠军', hot: 6120000, category: '科技' },
      { title: '某地发生4.5级地震暂无伤亡', hot: 5890000, category: '社会' },
      { title: '春节档电影预售票房破10亿', hot: 5560000, category: '娱乐' },
      { title: '新能源车冬季续航实测结果', hot: 5230000, category: '汽车' },
      { title: '国家卫健委发布冬季防疫指南', hot: 4980000, category: '健康' },
      { title: '电竞选手退役转型引热议', hot: 4650000, category: '游戏' },
      { title: '跨年演唱会阵容官宣', hot: 4320000, category: '娱乐' },
      { title: '二手房交易量连续三个月回升', hot: 3980000, category: '房产' },
      { title: '华为新款折叠屏手机曝光', hot: 3650000, category: '科技' },
      { title: '多地中小学调整寒假时间', hot: 3320000, category: '教育' },
    ];
    return list.map((item, i) => ({
      platform: 'weibo',
      title: item.title,
      hot: item.hot,
      url: `https://s.weibo.com/weibo?q=${encodeURIComponent(item.title)}`,
      rank: i + 1,
      category: item.category,
    }));
  }

  private generateDouyinTopics(): HotTopicItem[] {
    const list = [
      { title: '挑战全网最丝滑转身', hot: 9250000 },
      { title: '街头采访：你月薪多少', hot: 8720000 },
      { title: '美食探店本期打卡重庆', hot: 8350000 },
      { title: '宠物犬救落水儿童全过程', hot: 7980000 },
      { title: '素人翻唱惊艳全场', hot: 7560000 },
      { title: '户外露营vlog爆火', hot: 7120000 },
      { title: '魔术师街头表演引围观', hot: 6850000 },
      { title: '情侣吵架和解名场面', hot: 6520000 },
      { title: '健身达人分享冬季训练计划', hot: 6180000 },
      { title: '农村生活记录获百万点赞', hot: 5850000 },
      { title: '手工达人用废纸做艺术品', hot: 5520000 },
      { title: '高校宿舍创意整活视频', hot: 5180000 },
      { title: '舞蹈挑战赛全民参与', hot: 4850000 },
      { title: '老字号小吃制作全过程', hot: 4520000 },
      { title: '冬日穿搭推荐合集', hot: 4200000 },
    ];
    return list.map((item, i) => ({
      platform: 'douyin',
      title: item.title,
      hot: item.hot,
      url: `https://www.douyin.com/search/${encodeURIComponent(item.title)}`,
      rank: i + 1,
    }));
  }

  private generateBaiduTopics(): HotTopicItem[] {
    const list = [
      { title: '2026年春运购票日历公布', hot: 9800000, category: '社会' },
      { title: 'A股三大指数集体收涨', hot: 9100000, category: '财经' },
      { title: '较强冷空气来袭多地降温', hot: 8750000, category: '天气' },
      { title: '中国空间站最新实验成果', hot: 8320000, category: '科技' },
      { title: '国际油价大幅下跌', hot: 7950000, category: '财经' },
      { title: '教育部严禁寒假补课', hot: 7580000, category: '教育' },
      { title: '某app遭全网下架', hot: 7210000, category: '科技' },
      { title: '国产影视剧出海成绩单', hot: 6850000, category: '娱乐' },
      { title: '冬季呼吸道疾病防治指南', hot: 6520000, category: '健康' },
      { title: '农村彩礼治理新规出台', hot: 6180000, category: '社会' },
      { title: '新能源汽车补贴政策调整', hot: 5850000, category: '汽车' },
      { title: '年度十大流行语公布', hot: 5520000, category: '文化' },
      { title: '多地调整公积金贷款政策', hot: 5180000, category: '房产' },
      { title: '冬泳爱好者挑战冰河', hot: 4850000, category: '体育' },
      { title: '2026年春晚节目单泄露', hot: 4500000, category: '娱乐' },
    ];
    return list.map((item, i) => ({
      platform: 'baidu',
      title: item.title,
      hot: item.hot,
      url: `https://www.baidu.com/s?wd=${encodeURIComponent(item.title)}`,
      rank: i + 1,
      category: item.category,
    }));
  }

  private generateZhihuTopics(): HotTopicItem[] {
    const list = [
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
    ];
    return list.map((item, i) => ({
      platform: 'zhihu',
      title: item.title,
      hot: item.hot,
      url: `https://www.zhihu.com/search?q=${encodeURIComponent(item.title)}`,
      rank: i + 1,
      category: item.category,
    }));
  }

  private generateXiaohongshuTopics(): HotTopicItem[] {
    const list = [
      { title: '冬季护肤全攻略干皮必看', hot: 6500000, category: '美妆' },
      { title: '5平米小卧室改造前后对比', hot: 6200000, category: '家居' },
      { title: '减脂餐一周不重样食谱', hot: 5880000, category: '美食' },
      { title: '冬季氛围感穿搭合集', hot: 5550000, category: '穿搭' },
      { title: '周末Citywalk路线推荐', hot: 5220000, category: '旅行' },
      { title: '备婚攻略新娘必看清单', hot: 4900000, category: '婚庆' },
      { title: '平价文具大种草学生党', hot: 4580000, category: '好物' },
      { title: '养猫新手必买用品清单', hot: 4250000, category: '宠物' },
      { title: '0基础学化妆步骤详解', hot: 3920000, category: '美妆' },
      { title: '打工人便当盒推荐', hot: 3600000, category: '好物' },
    ];
    return list.map((item, i) => ({
      platform: 'xiaohongshu',
      title: item.title,
      hot: item.hot,
      url: `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(item.title)}`,
      rank: i + 1,
      category: item.category,
    }));
  }
}
