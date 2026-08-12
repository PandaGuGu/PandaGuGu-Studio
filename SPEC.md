# PandaGuGu Studio 设计规格文档（SPEC）

**版本**：v2.0
**最后更新**：2026-08-12
**性质**：确定性需求规格

> PandaGuGu Studio 是"画布式页面编辑器"：在 Excalidraw 画布上画元素 → 语义标记 → 画框圈成区块 → 导出结构化 JSON 蓝图 → AI 消费蓝图生成 HTML。核心价值是把"画布意图"无损、合理地映射到前端代码。

---

### 一、版本目标与范围

#### 1.1 当前能力（v2.0，已完成）
1. **画布**：Excalidraw 0.18 深度集成，桌布格（40px 经纬棋盘格）定位背景，画框自动半透明白背景
2. **语义标记**：12 种类型分 5 组（容器/内容/控件/媒体/特殊），智能打标（形状自动映射）+ 手动打标 + 拖拽创建 + 可搜索下拉
3. **属性面板**：按类型渲染表单（布局切换 + 主属性 + 高级折叠面板 style/events/html），编辑实时 WYSIWYG
4. **图层面板**：IDE 风格树（画框顶级 + ▾ 折叠 + 缩进 + 点击选中 + − 删除）
5. **蓝图导出**：JSON（整画布 / 画框级 / PNG），文件名 `PandaGuGu-YYYY-MM-DD`
6. **AI 生成闭环**：✨ 用画布蓝图生成（蓝图自动填入 prompt）→ 流式生成 HTML → 沙箱预览 → 细化迭代
7. **对齐工具**：8 种对齐/分布（嘉立创风格），Ctrl+点击多选
8. **模型服务**：9 个服务商（z.ai / Google / Fireworks / OpenRouter / DeepSeek / Kimi / 通义千问 / 火山方舟 / Custom），OpenAI 兼容 + Gemini 双协议，SSE 流式

#### 1.2 明确排除
- **不做 js.behaviors 行为库**（蓝图级）：AI 自身具备程序逻辑能力，生成时自行实现交互，蓝图不需要定义行为契约
- **不做蓝图级 css.fonts/vars/global 顶层字段**：排版配色交给 AI 自行决策，避免过度约束
- **不做商业化功能**

#### 1.3 未来规划
1. **批量变体**：蓝图 + N 组风格描述 → AI 批量生成多份 HTML → 变体栏切换预览
2. **生成历史库**：每次生成自动存档 localStorage，可回看/重新载入/删除/下载
3. **一键下载生成的 HTML 文件**（当前仅复制/新窗口）
4. **CLI / 接口，方便 AI 操控**（2026-08-12 用户提出）：
   - 形态：本地 Node CLI `pandagugu`（或 `pgg`）+ 核心逻辑抽成与 React 无关的纯库
   - 关键前置：把 `blueprint.ts` 中不依赖 Excalidraw 的部分（类型系统、序列化、映射规则）抽成 `lib/core/`，浏览器与 Node 双端复用
   - 命令示例：`pgg plan <blueprint.json> <prompt>`（蓝图→AI→HTML）、`pgg import <file.html>`（HTML→蓝图，正好服务需求 5）、`pgg serve`（本地 REST API 供 AI 调用）
   - AI 接入方式：文件级交互（读写 .blueprint.json/.html）+ 可选 HTTP API
5. **导入 HTML → 简化 → 自动布局到画布**（2026-08-12 用户提出）：
   - 流程：HTML → 解析（jsdom/DOMParser）→ 简化（inline style → props、去 script/冗余嵌套、DOM 树 → 语义类型映射）→ 布局推断（块级纵向 column / 行内横向 row / box 估算 x/y/w/h）→ 生成 BlueprintElement 树 → 用 Excalidraw API 反向画出带语义标记的元素 → 用户直接在画布上改
   - 价值：与需求 4 组成"旧网站逆向 → 画布重设计 → 导出蓝图 → 生成新版"完整闭环
6. **git 推远端** + CI 上线（✅ 已完成 2026-08-12，远端 github.com/PandaGuGu/PandaGuGu-Studio）

---

### 二、蓝图 v2 数据模型（核心契约）

```
Blueprint {
  elements: BlueprintElement[]  // 元素树
}

BlueprintElement {
  id: string
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

### 三、布局架构

```
┌──────────────────────────────────────────────────────────┐
│ Header：PandaGuGu Studio / 主题切换 / 这是什么 / ●模型⚙设置 │
├───────────────┬──────────────────────────────────────────┤
│ panel-left    │ panel-right                               │
│  ├ Canvas     │  ├ PromptBar（✨蓝图生成 + 3 场景预设）    │
│  │  ├ ⚡智能打标│  ├ LayersPanel（IDE 树）                  │
│  │  ├ ▲对齐    │  ├ preview-container（沙箱预览）          │
│  │  ├ Excalidraw│  └ preview-toolbar                      │
│  │  └ SemanticRail（底部浮动）│                            │
│  ├ FramePicker │                                          │
│  └ MessageStrip│                                          │
└───────────────┴──────────────────────────────────────────┘
```

**核心工作流**：画元素 → 智能打标 → 属性面板微调 → 画框圈成 section → ✨ 用画布蓝图生成 → AI 出 HTML → 预览细化
