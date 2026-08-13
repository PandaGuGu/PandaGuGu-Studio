import type { Blueprint, BlueprintElement, SemanticType } from './blueprint'

export interface Template {
  id: string
  labelKey: string
  device: 'mobile' | 'desktop'
  build: () => Blueprint
}

function mk(
  type: SemanticType,
  x: number, y: number, w: number, h: number,
  props: Record<string, any> = {},
  children: BlueprintElement[] = []
): BlueprintElement {
  return { type, x, y, w, h, angle: 0, layout: 'column', zIndex: 0, props, children }
}

const c = (x: number, y: number, w: number, h: number, children: BlueprintElement[], props: Record<string, any> = {}) =>
  mk('container', x, y, w, h, props, children)

const h1 = (x: number, y: number, w: number, content: string) =>
  mk('heading', x, y, w, 44, { content, level: 1, fontSize: 32, fontWeight: 700 })

const h2 = (x: number, y: number, w: number, content: string) =>
  mk('heading', x, y, w, 32, { content, level: 2, fontSize: 22, fontWeight: 600 })

const txt = (x: number, y: number, w: number, content: string) =>
  mk('text', x, y, w, 22, { content, fontSize: 14 })

const btn = (x: number, y: number, w: number, label: string) =>
  mk('button', x, y, w, 40, { label, bg: '#4a9e8e', radius: 8 })

const input = (x: number, y: number, w: number, placeholder: string) =>
  mk('input', x, y, w, 38, { placeholder, radius: 6 })

const link = (x: number, y: number, w: number, label: string) =>
  mk('link', x, y, w, 20, { label, href: '#' })

const card = (x: number, y: number, w: number, h: number, title: string, body: string) =>
  mk('card', x, y, w, h, { label: title, radius: 12, shadow: 'md' }, [
    mk('heading', x + 16, y + 14, w - 32, 24, { content: title, level: 3, fontSize: 16, fontWeight: 600 }),
    mk('text', x + 16, y + 46, w - 32, 40, { content: body, fontSize: 12 }),
  ])

// Root container for templates (avoids Excalidraw frame-render crash).
const root = (x: number, y: number, w: number, h: number, label: string, children: BlueprintElement[]) =>
  mk('section', x, y, w, h, { label }, children)

// ── Mobile templates ──

function mobileAppHome(): Blueprint {
  const W = 375, H = 667
  return {
    elements: [root(40, 40, W, H, '1', [
      c(60, 60, W - 40, 44, [
        mk('heading', 60, 60, 120, 36, { content: '我的 App', level: 3, fontSize: 18, fontWeight: 700 }),
        input(250, 62, 105, '搜索'),
      ]),
      c(60, 120, W - 40, 120, [
        h1(80, 134, 200, '夏日上新'),
        txt(80, 182, 240, '全场 8 折起，新人立减 20'),
        btn(80, 208, 120, '立即抢购'),
      ], { bg: '#e8f4f1', radius: 12, padding: 16 }),
      c(60, 256, W - 40, 96, [
        btn(60, 270, 60, '美食'), btn(150, 270, 60, '出行'),
        btn(240, 270, 60, '购物'), btn(330, 270, 60, '更多'),
      ], { layout: 'row' }),
      c(60, 368, W - 40, 200, [
        h2(60, 368, 160, '为你推荐'),
        card(60, 408, (W - 52) / 2, 160, '爆款耳机', '降噪无线，仅 299'),
        card(60 + (W - 52) / 2 + 12, 408, (W - 52) / 2, 160, '智能手表', '健康监测新升级'),
      ], { layout: 'row' }),
      c(60, 620, W - 40, 44, [
        txt(60, 630, 50, '首页'), txt(140, 630, 50, '分类'),
        txt(220, 630, 50, '购物车'), txt(300, 630, 50, '我的'),
      ], { layout: 'row' }),
    ])],
  }
}

function mobileLogin(): Blueprint {
  const W = 375, H = 667
  return {
    elements: [root(40, 40, W, H, '2', [
      h1(60, 110, 200, '欢迎回来'),
      txt(60, 160, 260, '登录你的账户，继续创作之旅'),
      input(60, 210, W - 40, '手机号 / 邮箱'),
      input(60, 262, W - 40, '密码'),
      btn(60, 324, W - 40, '登 录'),
      link(170, 384, 100, '忘记密码？'),
      txt(60, 440, 200, '还没有账户？'),
      link(190, 440, 120, '立即注册'),
    ])],
  }
}

// ── Desktop templates ──

function saasLanding(): Blueprint {
  const W = 1360, H = 860
  return {
    elements: [root(40, 40, W, H, '1', [
      c(40, 40, W, 56, [
        mk('heading', 40, 50, 160, 36, { content: 'Nova', level: 3, fontSize: 20, fontWeight: 700 }),
        link(240, 56, 80, '产品'), link(340, 56, 80, '定价'),
        link(440, 56, 80, '文档'), btn(1240, 44, 120, '免费试用'),
      ], { layout: 'row' }),
      c(40, 120, W, 280, [
        h1(160, 150, 700, '让团队效率翻倍的协作平台'),
        txt(160, 210, 560, 'Nova 把任务、文档、沟通整合在一个工作区，AI 自动排期，团队少开会、多产出。'),
        btn(160, 260, 140, '开始免费试用'),
        link(330, 268, 120, '观看演示 →'),
      ], { bg: '#f4f7fb', radius: 16, padding: 32 }),
      c(40, 420, W, 280, [
        h2(40, 420, 200, '核心特性'),
        card(40, 464, 420, 200, 'AI 自动化', '重复工作交给 AI，专注真正重要的事'),
        card(480, 464, 420, 200, '实时协作', '多人同屏编辑，改动即时同步'),
        card(920, 464, 420, 200, '数据洞察', '仪表盘实时掌握团队进度'),
      ], { layout: 'row' }),
      c(40, 720, W, 140, [
        h2(400, 740, 400, '准备好提升效率了吗？'),
        btn(580, 790, 160, '立即开始'),
      ], { bg: '#1c2130', radius: 16, padding: 32 }),
    ])],
  }
}

function dashboard(): Blueprint {
  const W = 1360, H = 860
  return {
    elements: [root(40, 40, W, H, '2', [
      c(40, 40, 220, H - 80, [
        mk('heading', 60, 60, 160, 36, { content: '控制台', level: 3, fontSize: 18, fontWeight: 700 }),
        txt(60, 120, 160, '总览'), txt(60, 160, 160, '用户'),
        txt(60, 200, 160, '订单'), txt(60, 240, 160, '营收'),
        txt(60, 280, 160, '设置'),
      ], { bg: '#f4f7fb', radius: 12, padding: 16 }),
      c(280, 40, 1120, 100, [
        card(280, 40, 260, 100, '今日访问', '12,480'),
        card(560, 40, 260, 100, '新增用户', '1,204'),
        card(840, 40, 260, 100, '销售额', '¥86,320'),
        card(1120, 40, 260, 100, '转化率', '3.2%'),
      ], { layout: 'row' }),
      c(280, 160, 700, 340, [
        h2(300, 180, 200, '访问趋势'),
        txt(300, 220, 600, '近 30 天访问量走势图（图表占位）'),
        txt(300, 260, 600, '……折线区域……'),
        txt(300, 300, 600, '……柱状区域……'),
      ], { bg: '#ffffff', radius: 12, padding: 16 }),
      c(1000, 160, 400, 340, [
        h2(1020, 180, 200, '最新订单'),
        txt(1020, 220, 360, '#1024 张三 ¥199'),
        txt(1020, 250, 360, '#1025 李四 ¥89'),
        txt(1020, 280, 360, '#1026 王五 ¥560'),
        txt(1020, 310, 360, '#1027 赵六 ¥45'),
      ], { bg: '#ffffff', radius: 12, padding: 16 }),
      c(280, 520, 1120, 320, [
        h2(300, 540, 200, '实时动态'),
        txt(300, 580, 1060, '14:20 新订单来自上海 · 14:15 用户「林夕」完成注册 · 14:02 销售额突破 8 万 · 13:58 新增 3 条评论'),
        txt(300, 620, 1060, '13:40 系统自动生成周报 · 13:21 完成数据备份 · 12:58 邀请链接被分享 12 次'),
      ], { bg: '#f4f7fb', radius: 12, padding: 16 }),
    ])],
  }
}

function ecommerceHome(): Blueprint {
  const W = 1360, H = 920
  return {
    elements: [root(40, 40, W, H, '3', [
      c(40, 40, W, 56, [
        mk('heading', 40, 50, 140, 36, { content: '潮集', level: 3, fontSize: 20, fontWeight: 700 }),
        input(220, 48, 320, '搜索商品'),
        link(580, 56, 80, '全部商品'), link(680, 56, 80, '新品'),
        link(780, 56, 80, '优惠'), btn(1240, 44, 120, '购物车'),
      ], { layout: 'row' }),
      c(40, 116, W, 220, [
        h1(160, 146, 600, '秋季大促 · 低至 5 折'),
        txt(160, 206, 500, '全场满 299 减 60，叠加会员券更划算'),
        btn(160, 256, 140, '去逛逛'),
      ], { bg: '#e8f4f1', radius: 16, padding: 32 }),
      c(40, 356, W, 440, [
        h2(40, 356, 200, '热卖商品'),
        card(40, 400, 310, 380, '无线耳机', '¥299  ¥499'),
        card(370, 400, 310, 380, '智能手表', '¥899  ¥1299'),
        card(700, 400, 310, 380, '机械键盘', '¥459  ¥599'),
        card(1030, 400, 310, 380, '便携音箱', '¥329  ¥459'),
      ], { layout: 'row' }),
      c(40, 816, W, 100, [
        h2(160, 836, 300, '新人专享 100 元礼包'),
        btn(1180, 830, 160, '立即领取'),
      ], { bg: '#fdf3e3', radius: 16, padding: 24 }),
    ])],
  }
}

function portfolio(): Blueprint {
  const W = 1360, H = 920
  return {
    elements: [root(40, 40, W, H, '4', [
      c(40, 40, W, 56, [
        mk('heading', 40, 50, 160, 36, { content: '林夕设计', level: 3, fontSize: 20, fontWeight: 700 }),
        link(1100, 56, 60, '作品'), link(1180, 56, 60, '关于'),
        link(1260, 56, 60, '联系'),
      ], { layout: 'row' }),
      c(40, 116, W, 280, [
        h1(160, 156, 700, '设计有温度，产品有灵魂'),
        txt(160, 216, 600, '我是一名独立产品设计师，专注 Web 与移动端体验设计，服务过 30+ 创业团队。'),
        btn(160, 266, 140, '查看作品'),
        link(330, 274, 140, '给我留言 →'),
      ], { bg: '#f8f6f3', radius: 16, padding: 32 }),
      c(40, 416, W, 380, [
        h2(40, 416, 200, '精选作品'),
        card(40, 460, 310, 320, '旅行 App', '2026 · 移动端'),
        card(370, 460, 310, 320, '电商官网', '2026 · Web'),
        card(700, 460, 310, 320, '数据平台', '2025 · Web'),
        card(1030, 460, 310, 320, '品牌设计', '2025 · 品牌'),
      ], { layout: 'row' }),
      c(40, 816, W, 84, [
        txt(160, 830, 600, '© 2026 林夕设计 · 让我帮你把想法变成产品'),
        link(1160, 830, 160, 'hi@linxi.design'),
      ], { layout: 'row' }),
    ])],
  }
}

export const TEMPLATES: Template[] = [
  { id: 'app-home', labelKey: 'template.appHome', device: 'mobile', build: mobileAppHome },
  { id: 'app-login', labelKey: 'template.appLogin', device: 'mobile', build: mobileLogin },
  { id: 'saas-landing', labelKey: 'template.saasLanding', device: 'desktop', build: saasLanding },
  { id: 'dashboard', labelKey: 'template.dashboard', device: 'desktop', build: dashboard },
  { id: 'ecommerce', labelKey: 'template.ecommerce', device: 'desktop', build: ecommerceHome },
  { id: 'portfolio', labelKey: 'template.portfolio', device: 'desktop', build: portfolio },
]
