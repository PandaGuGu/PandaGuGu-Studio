<div align="center">

<img src="public/favicon.png" width="64" alt="PandaGuGu Studio logo" />

# PandaGuGu Studio

**A canvas-based HTML generator** — draw elements · tag them with semantics · group them into sections → export a JSON blueprint with one click → AI turns it into a complete HTML page

[English](README.md) | [简体中文](README.zh-CN.md)

Pure frontend, no backend, runs entirely in the browser. AI capabilities are **BYOK** (Bring Your Own Key) — you fill in your own model API key in the settings page (the app embeds no keys). Keys are stored only in your browser's localStorage and never uploaded. Ships with the **pgg CLI** for a file-level workflow: blueprint ⇄ AI ⇄ HTML.

[![GitHub stars](https://img.shields.io/github/stars/PandaGuGu/PandaGuGu-Studio?style=for-the-badge&logo=github&color=2e7d6f)](https://github.com/PandaGuGu/PandaGuGu-Studio/stargazers)
[![License](https://img.shields.io/github/license/PandaGuGu/PandaGuGu-Studio?style=for-the-badge&color=2563eb)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/PandaGuGu/PandaGuGu-Studio/ci.yml?style=for-the-badge&label=CI&color=2e7d6f)](https://github.com/PandaGuGu/PandaGuGu-Studio/actions)
[![Repo size](https://img.shields.io/github/repo-size/PandaGuGu/PandaGuGu-Studio?style=for-the-badge&color=854F0B)](https://github.com/PandaGuGu/PandaGuGu-Studio)

</div>

![PandaGuGu Studio screenshot](screenshot/sc.png)

## Relationship with Excalidraw (our advantage)

PandaGuGu Studio is built on the MIT-licensed open-source [Excalidraw](https://github.com/excalidraw/excalidraw) — a mature infinite-canvas engine. Instead of reinventing the wheel, we upgrade the canvas from a "drawing whiteboard" into a **"visual → code" pipeline**:

| Excalidraw native | PandaGuGu Studio adds |
|---|---|
| Shapes: rectangle / ellipse / text / image | **Semantics**: container / heading / button / image… 12 page element types |
| Export PNG / proprietary JSON | **Open blueprint JSON**: semantic types + layout + zIndex, consumed directly by AI to generate HTML |
| Stops at drawing (whiteboard) | **AI generation loop**: canvas → blueprint → streaming HTML → sandbox preview → refine |
| Frame = marquee selection tool | Frame = `<section>` page structure (multiple frames = multi-section page) |
| Few shape props, manually tuned | Property panel per semantic type (color / text / radius…), live WYSIWYG editing |
| Flat element list | IDE-style tree layers (frame = folder, ▸/▾ collapse, click to select) |
| Shift multi-select | Ctrl/⌘ multi-select + 8 align/distribute actions (EASYEDA-style) |

**One-liner positioning**: Excalidraw is the engine; PandaGuGu Studio is the product that turns it into "draw it → AI writes the code".

## Core workflow

```
① Draw    — draw rectangles / text / images / ellipses… with Excalidraw
② Tag     — smart tagging: rectangle→container, ellipse→button, text→text, image→image (auto-tagged as you draw)
③ Frame   — draw a frame around a region = one <section> (page section / one screen)
④ Generate — click「✨ Generate from canvas blueprint」→ the JSON blueprint feeds the prompt automatically → AI generates the HTML
```

## Features

- **Semantic type system (12 types)**: container / section / card / nav + heading / text / link + button / input + image + HTML snippet / note
- **Smart tagging**: auto-matches semantic types as you draw (⚡ toggle at the top); drag-to-create is also supported (pick a type → draw → auto-tagged)
- **Property panel**: edit per-type props of the selected element (color / text / radius…), syncs to the canvas only on edit — never modifies your drawing
- **Frame = `<section>`**: areas framed by a rectangle export as top-level section nodes, with inner elements as children
- **Layers panel**: IDE-style tree hierarchy (frame = folder with ▸/▾ arrows), click to select, − to delete
- **Align tools**: left / right / horizontal center + top / bottom / vertical center + even distribution (8 actions, bottom ▲ menu after multi-select)
- **Multi-select**: Ctrl/⌘+click toggles selection (click selected to deselect, click unselected to add)
- **JSON blueprint export**: per-frame (thumbnail ⇩) or whole canvas (▲ menu), including zIndex (stacking order) and layout hints
- **Three image export modes**: embed dataURL (self-contained HTML) / filename reference (for DeepSeek text-only models) / inline HTML (offline output)
- **Batch variants**: 8 preset styles + custom descriptions, generate N variants in one click with toggle preview
- **Generation history**: every generation auto-archives to localStorage; review / reload / delete anytime
- **Classic template library**: 6 templates (mobile app home / login + SaaS landing / dashboard / e-commerce / portfolio), one-click to generate frames + semantic elements
- **Import HTML → canvas**: parse legacy pages, simplify, auto-layout onto the canvas — closes the reverse-redesign loop
- **Smart guides**: Excalidraw native smart guides (red guides while dragging); elements dragged into a frame auto-assign to it
- **Theme**: light / dark toggle, applied across the whole site
- **9 model providers**: z.ai / DeepSeek / Kimi / Tongyi Qianwen / Volcano Ark / Google / Fireworks / OpenRouter / Custom
- **pgg CLI**: `pgg plan` (blueprint→AI→HTML), `pgg import` (HTML→blueprint), `pgg render` (offline output), `pgg history` (generation history), `pgg serve` (local REST API) — all sharing the same core logic as the web app

## CLI (pgg)

A file-level workflow between blueprints and HTML, convenient for AI or scripts to drive directly — shares the same core (types / prompts / HTML rendering / import parsing) as the web app.

```bash
npm run build:cli          # bundles dist-cli/pgg.mjs (rolldown, single-file ESM)
node dist-cli/pgg.mjs help

# ① blueprint → AI → complete HTML (same prompt contract as the web app's「✨ Generate from canvas blueprint」)
node dist-cli/pgg.mjs plan design.blueprint.json "make it a dark tech style" \
  --provider=qwen --model=qwen-plus --key=sk-xxx --out=out.html

# ② HTML → blueprint JSON (reverse; load it back into the canvas for further editing)
node dist-cli/pgg.mjs import old-site.html -o old-site.blueprint.json

# ③ blueprint → HTML (offline render, no AI, no token cost; same renderer as the web app's「🧾 Export HTML」)
node dist-cli/pgg.mjs render old-site.blueprint.json --title="New page" -o new.html

# ④ generation history (file-level, ~/.pandagugu/history.json)
node dist-cli/pgg.mjs history list
node dist-cli/pgg.mjs history show <id> -o some-generation.html

# ⑤ local REST API (GET /health · POST /api/plan · POST /api/import)
node dist-cli/pgg.mjs serve --port 8787
```

Config precedence: **CLI args > environment variables (`PGG_PROVIDER/PGG_MODEL/PGG_API_KEY/PGG_ENDPOINT`) > `~/.pandagugu.json`**. Keys stay local, never uploaded. Short flags `-o/-p/-k/-m` are aliases for `--out/--port/--key/--model`.

## Blueprint data model (v2)

```json
{
  "elements": [
    { "type": "section", "label": "Hero", "x": 100, "y": 80, "w": 800, "h": 500,
      "zIndex": 0, "layout": "column",
      "props": { "label": "Hero" },
      "children": [
        { "type": "heading", "props": { "content": "A new visual canvas" } },
        { "type": "text", "props": { "content": "Draw, tag, generate" } },
        { "type": "button", "props": { "label": "Get started" } }
      ] }
  ]
}
```

- **Semantic types → HTML**: section→`<section>`, container→`<div>`, heading→`<h1-h6>`, button→`<button>`, input→`<input>`, image→`<img>`, text→`<p>`, link→`<a>`, raw→embedded verbatim, note→design intent reference
- **layout hints**: free→absolute, row/column/grid/wrap→flex/grid
- **zIndex**: overlapping elements get `z-index` from it

## Model providers

| Provider | Endpoint | Models |
|------|------|------|
| z.ai | api.z.ai | GLM-5V Turbo |
| DeepSeek | api.deepseek.com | deepseek-chat / deepseek-reasoner |
| Kimi | api.moonshot.cn | moonshot-v1 / kimi-k2 |
| Tongyi Qianwen | dashscope compatible mode | qwen-vl-plus / qwen-plus / qwen-max |
| Volcano Ark | ark.cn-beijing.volces.com | doubao-1.5-pro/lite, seed-1.6 |
| Google | generativelanguage | Gemini 3.1 Pro / Flash / Lite |
| Fireworks | api.fireworks.ai | Kimi K2.5 Turbo |
| OpenRouter | openrouter.ai | 100+ models (auto-fetched) |
| Custom | any | any OpenAI-compatible endpoint |

Keys are stored in browser localStorage and never uploaded.

## Keyboard shortcuts

- `Cmd/Ctrl + Enter`: submit generate / refine
- `Ctrl/⌘ + click`: toggle multi-select
- `Shift + click` / marquee: multi-select

## Development

```bash
npm install
npm run dev       # dev server, http://localhost:5173
npm run build     # production build
npm run build:cli # bundle the pgg CLI → dist-cli/pgg.mjs
npm test          # core unit tests (node:test)
npm run check     # quality checks: tsc + tests + build + brand scan
```

## Architecture

```
src/
  App.tsx                 — orchestration hub, state, AI pipeline (generate / refine / plan)
  lib/
    core/                 — pure TS, zero deps, shared between browser & Node
      types.ts            — semantic types v2, blueprint model, constants, pure utils
      blueprintToHtml.ts  — blueprint → self-contained HTML (images embedded as base64)
      prompt.ts           — blueprint → AI prompt (shared by generate / variants / web AI)
      htmlToBlueprint.ts  — HTML → blueprint (simplify + auto layout)
    blueprint.ts          — Excalidraw layer: tagging, style sync, toBlueprint serialization (re-exports core)
    align.ts              — 8 align/distribute algorithms (pure coordinates)
    providers.ts          — 9 provider configs, state persistence
    api.ts                — OpenAI-compatible + Gemini dual-protocol SSE streaming
    export.ts             — frame / full-canvas PNG export
    i18n.tsx              — English & Chinese
  components/
    Canvas.tsx            — Excalidraw instance, smart tagging, Ctrl multi-select
    SemanticRail.tsx      — bottom floating toolbar (12 types + search + export/align ▲)
    PropsPanel.tsx        — per-type property editor panel
    LayersPanel.tsx       — IDE-style tree layers panel
    FramePicker.tsx       — frame management, thumbnails, per-frame JSON export
    PromptBar.tsx         — AI input (✨ blueprint generate + scenario presets)
    Preview.tsx           — sandboxed iframe preview + device switching
    ...
cli/
  pgg.ts                  — CLI entry (plan / import / render / history / serve / version)
  commands/plan.ts        — blueprint → AI → HTML (planToHtml reused by serve)
  commands/import.ts      — HTML → blueprint (linkedom parsing)
  commands/render.ts      — blueprint → HTML (offline, no AI)
  commands/history.ts     — generation history (~/.pandagugu/history.json)
  commands/serve.ts       — local REST API
  config.ts               — arg parsing + config merging (flag > env > ~/.pandagugu.json)
```

## License

MIT — upstream copyright notices are preserved:

- **Excalidraw** (underlying canvas engine, MIT) — Copyright (c) 2020 Excalidraw
- **VCanvas** (upstream project, MIT) — Copyright (c) 2026 E01.ai
- **PandaGuGu Studio** (this project) — Copyright (c) 2026 PandaGuGu Studio
