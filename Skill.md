# PandaGuGu Studio AI 操作指令（Skill）

**版本**：v1.0
**最后更新**：2026-08-12
**依赖文档**：SPEC.md（规格）、Rule.md（规则）

本文档是 AI 在本项目开发时的"操作手册"——先读 Rule（红线）再动手，按本文档的流程修改、验证、提交。

---

### S-001 新增一个语义类型（全链路）

1. `src/lib/blueprint.ts`：
   - `SEMANTIC_GROUPS` 对应分组加类型名（5 组：容器/内容/控件/媒体/特殊）
   - `TYPE_ICONS` 加图标字符
   - `DEFAULT_PROPS` 加默认属性
   - `applyStyle` 按类型映射样式（注意只同步 props 显式存在的字段，`has()` 检查）
2. `src/components/PropsPanel.tsx`：按 type 加表单分支
3. `src/lib/i18n.tsx`：`semantic.<type>` 中英两条
4. `src/components/Canvas.tsx`：若需要拖拽创建，`TOOL_OF` 加映射
5. 验证：`npx tsc --noEmit` + `npm run build`

### S-002 新增 UI 文案（i18n）

- 必须在 `src/lib/i18n.tsx` 的 **zh-CN 和 en 两个字典**各加一条，key 用 `模块.子项` 语义化命名
- 组件内用 `t('key')` 取值，严禁硬编码中文
- 历史教训：曾经把 en 区域误改成中文导致双语错乱，编辑时注意区分两个字典块

### S-003 新增组件

1. 建 `src/components/组件名.tsx` + `组件名.css`（成对）
2. 样式用主题变量（`--bg-*`/`--text-*`/`--accent` 等），禁止硬编码色值（浅色模式会露馅）
3. 弹层/下拉：作为触发按钮的**子节点** absolute 定位（Fragment 兄弟节点会相对定位祖先漂移，历史教训）
4. 工具条布局避开 Excalidraw 原生 UI（顶部工具栏/底部 zoom/右侧 dock）

### S-004 导出文件

- 一律用 `brandFilename(kind, tag?)`：`import { brandFilename } from '../lib/export'`
- 格式 `PandaGuGu-YYYY-MM-DD[.tag].json|png`，禁止时间戳/自定义拼接
- JSON 蓝图：`downloadJSON(bp, brandFilename('json', 'blueprint'))`
- 画布完整 JSON：`brandFilename('json', 'canvas')`；PNG：`brandFilename('png')`

### S-005 语义打标

- 打标 = `setSemantic(el, { type, layout: DEFAULT_LAYOUT, props: {} })`，**只写 customData**
- **严禁**在打标时调用 `applyStyle` 或改元素视觉（用户铁律，历史 bug：松手变点、文字被替换）
- 智能打标延迟 250ms 执行（等形状提交），用 `editor.getSceneElements()` 读最新场景，只替换目标元素
- 智能打标映射：rectangle→container、ellipse/diamond→button、text→text、image→image

### S-006 验证与提交

```bash
npx tsc --noEmit          # 必须 0 错误
npm run build             # 必须成功
git add -A
git -c user.email="pandagugu@studio.local" -c user.name="PandaGuGu Studio" commit -m "feat: 中文描述..."
```

- 提交信息格式：`feat:` / `fix:` / `refactor:` / `chore:` + 中文描述 + 正文要点列表
- UI 改动建议用 Edge headless 截图验证：
  `"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless --disable-gpu --window-size=1500,950 --screenshot=... http://localhost:5174`

### S-007 已知 API 要点（Excalidraw 0.18）

- 顶部工具栏插槽已移除（FooterCenter 时代结束），自定义 UI 用 absolute 定位浮层
- `viewportCoordsToSceneCoords({clientX, clientY}, appState)` 需传 2 参（zoom/scroll）
- 画框子元素：`frameId` 关联；容器子元素：`containerId` 关联
- 新画框自动半透明白背景：深色 `rgba(255,255,255,0.15)`、浅色 `rgba(255,255,255,0.8)`，已有背景色不覆盖

### S-008 开发环境

- dev server：`npm run dev`（http://localhost:5174，5173 常被占用）
- 类型检查：`npx tsc --noEmit`
- 生产构建：`npm run build`（产物在 dist/）
- 快捷键：`Cmd/Ctrl+Enter` 提交生成（PromptBar）

### S-009 pgg CLI（蓝图 ⇄ AI ⇄ HTML）

- 构建：`npm run build:cli` → `dist-cli/pgg.mjs`（rolldown 单文件 ESM，**不要手动提交 dist-cli，已 gitignore**）
- 命令：
  - `node dist-cli/pgg.mjs plan <blueprint.json> [prompt]` 蓝图→AI→HTML（流式，`--provider/--model/--key/--endpoint/--style/--out/--no-stream`）
  - `node dist-cli/pgg.mjs import <file.html> [-o out.json]` HTML→蓝图（Node 端用 linkedom 解析后注入）
  - `node dist-cli/pgg.mjs render <blueprint.json> [-o out.html]` 蓝图→HTML（离线，不经 AI；`--title` 覆盖页面标题，`--open` 浏览器打开）
  - `node dist-cli/pgg.mjs history list|show|add|rm|clear` 生成历史（文件级 `~/.pandagugu/history.json`，上限 50 条）
  - `node dist-cli/pgg.mjs serve [--port 8787]` 本地 REST API（GET /health · POST /api/plan · POST /api/import）
- 短参数别名：`-o=--out`、`-p=--port`、`-k=--key`、`-m=--model`（parseArgs 的 ALIAS 表归一化，命令内一律读长名）
- 配置优先级：命令行参数 > 环境变量（`PGG_PROVIDER/PGG_MODEL/PGG_API_KEY/PGG_ENDPOINT`）> `~/.pandagugu.json`
- **双端复用铁律**：浏览器与 CLI 共用的逻辑必须放 `src/lib/core/`（纯 TS 零依赖，禁 import Excalidraw/React/DOM）；`blueprint.ts` 只留 Excalidraw 层并 re-export core
- **TS 6.0 坑**：`export * from` 不再把导出带入当前模块自身作用域——本地要用的成员必须显式 `import`（blueprint.ts 头部有示范）
- **serve 场景禁 fail()**：`fail()` 会 `process.exit(1)` 杀死服务进程；可被 serve 复用的逻辑（如 planToHtml）抛 Error，由 CLI 层 catch 后转 fail
- **rolldown 坑**：`bundle.write({ banner })` 在 rc 版会清空产物；shebang 靠源文件首行保留，`banner` 参数不要用
