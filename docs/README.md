# PandaGuGu Studio 文档中心

| 文档 | 位置 | 用途 |
|------|------|------|
| 工程规则（红线） | [`/Rule.md`](../Rule.md) | 研发制度，AI 与开发者必须遵守的规则 |
| 功能规格（确定性） | [`/SPEC.md`](../SPEC.md) | 蓝图 v2 数据模型、功能清单、明确排除 |
| AI 操作指令 | [`/Skill.md`](../Skill.md) | 新增类型/文案/组件的操作手册 |
| 部署说明 | [`/deploy/README.md`](../deploy/README.md) | Docker / 静态托管方式 |

## 根目录文件速查

> 以下文件位于项目根目录（工具链/平台约定位置，**请勿移动**）：

| 文件 | 说明 |
|------|------|
| `README.md` | 对外介绍（功能 / CLI 用法 / 数据模型简介 / 服务商 / 开发） |
| `LICENSE` | MIT 三层版权声明（Excalidraw / VCanvas / PandaGuGu） |
| `package.json` | npm 脚本（dev/build/test/check/build:cli）+ bin `pgg` |
| `package-lock.json` | 依赖锁定（勿手改，用 `npm install` 刷新） |
| `tsconfig.json` | TypeScript 配置（include: src） |
| `vite.config.ts` | Vite 构建配置（manualChunks 拆包 / chunkSizeWarningLimit） |
| `index.html` | 入口 HTML（favicon.png / title / 字体） |
| `.gitignore` | 忽略规则（node_modules / dist / dist-cli / .env* / .workbuddy） |
| `.env.example` | 环境变量示例（构建路径 / pgg CLI 的 PGG_* 变量） |

## 目录约定（模仿 cakecake-project 架构）

```
PandaGuGu Studio/
├── Rule.md / SPEC.md / Skill.md   # 文档体系（研发制度 + 规格 + 指令）
├── src/                           # 前端源码（React + Vite + TS + Excalidraw）
│   └── lib/core/                  # 纯 TS 核心（浏览器 + pgg CLI 双端复用）
├── cli/                           # pgg CLI 源码（plan / import / render / history / serve）
├── tests/                         # core 单元测试（node:test）
├── scripts/                       # 开发脚本（check / build-cli）
├── deploy/                        # 部署（Dockerfile + nginx.conf + 说明）
├── docs/                          # 文档中心（本目录）
├── .github/workflows/             # CI（typecheck + test + build ×2）
├── .env.example                   # 环境变量示例
├── public/                        # 静态资源（favicon 等）
└── screenshot/                    # 演示截图/录屏
```
