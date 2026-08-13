# PandaGuGu Studio 设计规格文档（SPEC）

**版本**：v2.1
**最后更新**：2026-08-13
**性质**：确定性需求规格

> PandaGuGu Studio 是"画布式页面编辑器"：在 Excalidraw 画布上画元素 → 语义标记 → 画框圈成区块 → 导出结构化 JSON 蓝图 → AI 消费蓝图生成 HTML。核心价值是把"画布意图"无损、合理地映射到前端代码。功能清单与 CLI 用法见 README，本文档专注规格契约。

---

### 一、版本目标与范围

#### 1.1 当前能力（v2.x，已完成）
功能清单见 **README.md「功能」章节**（语义标记 / 属性面板 / 图层 / 蓝图导出 / AI 生成闭环 / 批量变体 / 生成历史 / 模板库 / 导入 HTML / 图片导出三模式 / 9 模型服务商 / pgg CLI）。本文档不再重复罗列，只保留规格锚点：
- 蓝图导出文件名：**纯日期** `YYYY-MM-DD.ext`（用户 2026-08-12 要求，无品牌前缀）

#### 1.2 明确排除
- **不做 js.behaviors 行为库**（蓝图级）：AI 自身具备程序逻辑能力，生成时自行实现交互，蓝图不需要定义行为契约
- **不做蓝图级 css.fonts/vars/global 顶层字段**：排版配色交给 AI 自行决策，避免过度约束
- **不做商业化功能**

#### 1.3 历史规划（2026-08 全部落地 ✅）
| 规划 | 完成情况 |
|------|----------|
| 批量变体（N 风格 → N HTML） | ✅ 2026-08-12 f01bcc2 |
| 生成历史库（localStorage 存档/回看/删除） | ✅ 2026-08-12 5270ac1 |
| 一键下载生成的 HTML | ✅ 2026-08-12 |
| CLI / 接口（pgg: plan/import/render/history/serve） | ✅ 2026-08-13 |
| 导入 HTML → 简化 → 自动布局到画布 | ✅ 2026-08-12 fcd8488 + 增强 |
| git 推远端 + CI 上线 | ✅ 2026-08-12 |

#### 1.4 后续规划（未完成项）
1. **`pgg serve` 接入浏览器**：网页版"生成"按钮可切换到本地 serve 模式（省 token 调试 / 固定 endpoint）
2. **蓝图 → PNG 预览**：CLI 内渲染蓝图为图片（Node 侧 canvas 或导出 SVG），便于快速检查布局
3. （已落地项不再列：pgg render ✅ 08-13、pgg history ✅ 08-13）

---

### 二、蓝图 v2 数据模型（核心契约）

```
Blueprint {
  elements: BlueprintElement[]  // 元素树
}

BlueprintElement {
  type: SemanticType            // 12 种语义类型
  x / y / w / h: number         // Excalidraw 逻辑坐标，1:1（1 单位 = 1 CSS px @100%）
  angle: number
  layout: 'free'|'row'|'column'|'grid'|'wrap'   // 布局提示
  props: Record<string, any>    // L1 结构化样式（bg/radius/padding/fontSize/color/...）
  style?: string                // L2 自由 CSS（长尾样式）
  events?: Record<string, string>  // 元素级交互声明（onClick → 行为名）
  html?: string                 // raw 类型专用，原样嵌入
  children: BlueprintElement[]  // containerId / frameId 建父子树
  zIndex: number                // 场景 z-order，0=底层（叠层画框用）
  // 无 id：用户 2026-08-12 要求去 id，元素唯一性由 Excalidraw 场景保证
}
```

**语义类型 → HTML 映射**（AI 生成时必须遵循）：

| 类型 | HTML | 说明 |
|------|------|------|
| section | `<section>` | 画框映射，页面区块/一屏 |
| container/card/nav | `<div>` | 区块内部盒子 |
| heading | `<h1>`–`<h6>` | level → 字号联动（H1=48/H2=36/...） |
| text | `<p>`/`<span>` | 正文 |
| link | `<a>` | 链接 |
| button | `<button>` | 按钮 |
| input | `<input>` | 输入框 |
| image | `<img>` | 图片 |
| raw | 原样嵌入 html 字段 | 复杂片段 |
| note | 不渲染，作设计意图参考 | 便签文字（"菜单放右上角"） |

**生成规则**：
- 重叠元素按 `zIndex` 设 `z-index`
- `layout: free` → `position: absolute`；`row/column/grid/wrap` → flex/grid

---

### 三、布局架构（当前）

```
┌──────────────────────────────────────────────────────────┐
│ Header：PandaGuGu Studio / 主题切换 / 这是什么 / ●模型⚙设置 │
├───────────────┬──────────────────────────────────────────┤
│ panel-left    │ panel-right                               │
│  ├ Canvas     │  ├ side-panels（限高 45%，区内滚动）       │
│  │  ├ ⚡智能打标│  │   ├ 图层（200px 内滚）               │
│  │  ├ ▲对齐    │  │   ├ 批量变体（展开=浮层盖预览）       │
│  │  ├ Excalidraw│  │   └ 生成历史（220px 内滚）           │
│  │  └ SemanticRail│ ├ preview-container（flex:1，对话显示）│
│  ├ FramePicker │  │   └ preview-toolbar（嵌卡片底部）     │
│  └ MessageStrip│  └ PromptBar（输入框，贴底卡片）         │
└───────────────┴──────────────────────────────────────────┘
```

**核心工作流**：画元素 → 智能打标 → 属性面板微调 → 画框圈成 section → ✨ 用画布蓝图生成 → AI 出 HTML → 预览细化
