# PandaGuGu Studio 工程规则（Rule）

**版本**：v1.1
**最后更新**：2026-08-13
**依赖文档**：SPEC.md（功能规格）、Skill.md（AI 操作指令）

### 关于 Rule 的说明

本文档是项目的"研发制度"，告诉 AI 与开发者什么事绝对不能乱来。Rule 是软约束，不是硬门禁——当某条规则被反复违反时，应下沉为 scripts/ 中可执行的检查脚本。

---

### 一、品牌与命名

| 编号       | 规则                                     | 说明                                                         |
| :--------- | :--------------------------------------- | :----------------------------------------------------------- |
| **R-BRAND-1** | **严禁残留旧品牌名**                   | 项目品牌为 **PandaGuGu Studio**。`glm5v-drawing`、`vcanvas`、`E01.ai` 等旧品牌名严禁出现在代码、文案、文件名中（已全部清理，新代码不得引入）。 |
| **R-BRAND-2** | **导出文件名必须用纯日期**             | 所有导出文件（JSON/PNG/HTML）文件名必须通过 `brandFilename(kind)` 生成，格式 `YYYY-MM-DD.ext`（用户 2026-08-12 明确要求纯日期，不要品牌前缀）。严禁时间戳、自定义拼接、品牌名前缀。 |
| **R-BRAND-3** | **i18n 文案必须中英成对**               | 任何新增 UI 文案必须同时在 `src/lib/i18n.tsx` 的 `zh-CN` 与 `en` 两个字典中各加一条，key 语义化（`模块.子项`），严禁在组件里硬编码中文字符串。 |

---

### 二、语义类型与数据模型

| 编号        | 规则                                             | 说明                                                         |
| :---------- | :----------------------------------------------- | :----------------------------------------------------------- |
| **R-SEM-1** | **打标只加语义，严禁改画布视觉**                 | `setSemantic` 只写 `customData.semantic`，**绝不**调用 `applyStyle` 或改动元素的颜色/文字/尺寸。视觉只在用户在属性面板主动编辑时才同步。这是用户明确要求的铁律。 |
| **R-SEM-2** | **语义类型集是固定契约**                         | 12 种类型（container/section/card/nav/heading/text/link/button/input/image/raw/note）分 5 组，定义在 `blueprint.ts` 的 `SEMANTIC_GROUPS`。新增类型必须同步更新：`SEMANTIC_GROUPS`、`TYPE_ICONS`、`DEFAULT_PROPS`、`PropsPanel` 表单、i18n。 |
| **R-SEM-3** | **智能打标映射固定**                             | 形状→语义映射：rectangle→container、ellipse/diamond→button、text→text、image→image；arrow/line/freedraw/frame 不打标。映射改动需回归测试。 |
| **R-SEM-4** | **蓝图 v2 字段为稳定契约**                       | `BlueprintElement`：id/type/x/y/w/h/angle/layout/props/style?/events?/html?/children/zIndex。导出 JSON 结构改动必须版本号升级（version: 2 → 3），严禁静默改字段。 |
| **R-SEM-5** | **画框映射为 section**                           | 画框（Excalidraw frame）导出为顶层 `section` 节点，`props.label` 用画框名，框内元素（frameId 匹配）成为 children。叠层顺序用 `zIndex` 表达。 |

---

### 三、UI 与样式

| 编号       | 规则                                     | 说明                                                         |
| :--------- | :--------------------------------------- | :----------------------------------------------------------- |
| **R-UI-1** | **严禁硬编码颜色，必须用主题变量**       | 颜色一律用 `globals.css` 定义的 CSS 变量（`--bg-*`/`--text-*`/`--border-*`/`--accent`/`--orange`/`--cyan`）。深色主题是默认，浅色主题通过 `[data-theme]` 切换，硬编码色值会导致浅色模式露馅（历史教训）。 |
| **R-UI-2** | **弹层就近弹出**                         | 下拉菜单/浮层必须紧贴触发按钮（作为按钮子节点 absolute 定位），严禁用 Fragment 兄弟节点（相对定位祖先会漂移，历史教训）。 |
| **R-UI-3** | **工具条不得遮挡 Excalidraw 原生 UI**    | 自定义工具条（SemanticRail/对齐按钮）布局时必须避开 Excalidraw 顶部工具栏、底部 zoom 控件、右侧 dock。 |

---

### 四、代码质量

| 编号        | 规则                                             | 说明                                                         |
| :---------- | :----------------------------------------------- | :----------------------------------------------------------- |
| **R-QA-1** | **提交前必须 tsc 零错误 + 构建通过**             | `npx tsc --noEmit` 必须 0 错误，`npm run build` 必须成功，才能提交。 |
| **R-QA-2** | **组件文件必须成对（.tsx + .css）**              | 新组件 = `组件名.tsx` + `组件名.css`，样式不要写进 globals.css（全局变量除外）。 |
| **R-QA-3** | **提交信息必须遵循 Conventional Commits**        | `feat:` / `fix:` / `refactor:` / `chore:` + 中文描述，正文列要点。git 作者固定 `PandaGuGu Studio <pandagugu@studio.local>`。 |
| **R-QA-4** | **API Key 严禁提交**                              | `.env`、真实 key、token 严禁进入 git。Key 存浏览器 localStorage（providerState），代码里只存占位符。CLI 的 key 走 `~/.pandagugu.json`（gitignore 范围外，用户主目录，不随项目提交）。 |
| **R-QA-5** | **core 必须零依赖、双端复用**                     | 浏览器与 CLI 共用的逻辑（类型/常量/提示词/HTML 渲染/导入解析）一律放 `src/lib/core/`，纯 TS 零依赖（禁 import Excalidraw/React/DOM）。`blueprint.ts` 只保留 Excalidraw 层并 re-export core。新增双端逻辑不得写进组件或 Excalidraw 层。 |

---

### 五、布局与交互

| 编号        | 规则                                             | 说明                                                         |
| :---------- | :----------------------------------------------- | :----------------------------------------------------------- |
| **R-UX-1** | **数据 1:1，视觉零干扰**                         | 导出 JSON 坐标/尺寸必须与画布 1:1（1 Excalidraw 单位 = 1 CSS px），比例换算交给 AI 侧，画布上不做任何视觉缩放调节。 |
| **R-UX-2** | **快捷键约定**                                   | `Cmd/Ctrl+Enter` 提交生成（PromptBar 已有），普通 Enter 保持换行，严禁改成直接提交。 |
| **R-UX-3** | **多选交互三通道并存**                           | Shift+点击（原生）、Ctrl/⌘+点击（自实现切换）、框选（原生）三通道并存，新增选中交互不得破坏现有任一通道。 |
