// core 单元测试 — Node 内置 node:test,零依赖。
// 运行: npm test (node --experimental-strip-types --test tests/)
// 注意: core 内部全部 type-only import,type-stripping 后可直接执行,
//       htmlToBlueprint 在 Node 端需 linkedom 注入 document。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseHTML } from 'linkedom'

import {
  SEMANTIC_TYPES, SEMANTIC_GROUPS, LAYOUTS, DEFAULT_LAYOUT,
  DEFAULT_PROPS, HEADING_SIZES, frameLabel, mimeToExt, sanitizeFilename,
} from '../src/lib/core/types.ts'
import { blueprintToHtml } from '../src/lib/core/blueprintToHtml.ts'
import { buildBlueprintPrompt, buildWebAIPrompt } from '../src/lib/core/prompt.ts'
import { htmlToBlueprint } from '../src/lib/core/htmlToBlueprint.ts'
import type { Blueprint, BlueprintElement } from '../src/lib/core/types.ts'

// ── 工具 ──

function el(partial: Partial<BlueprintElement>): BlueprintElement {
  return {
    type: 'container', x: 0, y: 0, w: 100, h: 60, angle: 0,
    layout: 'free', zIndex: 0, props: {}, children: [],
    ...partial,
  }
}

function bp(els: BlueprintElement[]): Blueprint {
  return { elements: els }
}

// ── types:常量契约 ──

test('types: 12 种语义类型 × 5 组', () => {
  assert.equal(SEMANTIC_TYPES.length, 12)
  assert.equal(SEMANTIC_GROUPS.length, 5)
  const grouped = SEMANTIC_GROUPS.flatMap((g) => g.types)
  assert.deepEqual([...grouped].sort(), [...SEMANTIC_TYPES].sort())
  // 每个类型都有默认 props
  for (const t of SEMANTIC_TYPES) {
    assert.ok(DEFAULT_PROPS[t], `DEFAULT_PROPS 缺 ${t}`)
  }
})

test('types: 常量定义', () => {
  assert.ok(LAYOUTS.includes('free'))
  assert.equal(DEFAULT_LAYOUT, 'free')
  assert.equal(HEADING_SIZES[1], 48)
  assert.equal(HEADING_SIZES[6], 16)
})

test('types: frameLabel 清理 "Frame N"', () => {
  assert.equal(frameLabel('Frame 1'), '1')
  assert.equal(frameLabel('Frame 12'), '12')
  assert.equal(frameLabel('Hero'), 'Hero')
  assert.equal(frameLabel(undefined), 'Section')
  assert.equal(frameLabel(''), 'Section')
})

test('types: mimeToExt / sanitizeFilename', () => {
  assert.equal(mimeToExt('image/jpeg'), '.jpg')
  assert.equal(mimeToExt('image/webp'), '.webp')
  assert.equal(mimeToExt('image/svg+xml'), '.svg')
  assert.equal(mimeToExt('image/png'), '.png')
  assert.equal(mimeToExt(undefined), '.png')
  assert.equal(sanitizeFilename('我的 logo.png'), '我的-logo.png')
  assert.equal(sanitizeFilename('a/b:c'), 'a-b-c')
  assert.equal(sanitizeFilename('///'), 'image')
})

// ── blueprintToHtml ──

test('blueprintToHtml: free 布局 absolute 定位 + z-index', () => {
  const html = blueprintToHtml(bp([
    el({ type: 'heading', x: 10, y: 20, w: 200, h: 50, zIndex: 2, props: { content: '标题', level: 1, fontSize: 32 } }),
    el({ type: 'button', x: 10, y: 80, w: 120, h: 40, zIndex: 1, props: { label: '点我', bg: '#2563eb', color: '#fff' } }),
  ]))
  assert.match(html, /<!DOCTYPE html>/)
  assert.match(html, /<h1/)
  assert.match(html, /position:absolute;left:10px;top:20px/)
  assert.match(html, /z-index:2/)
  assert.match(html, /<button/)
  assert.match(html, /点我/)
})

test('blueprintToHtml: row/column 容器 flex 布局', () => {
  const html = blueprintToHtml(bp([
    el({
      type: 'section', layout: 'column', w: 300, h: 200,
      children: [
        el({ type: 'heading', layout: 'free', x: 5, y: 5, w: 100, h: 30, props: { content: 'Hero', level: 2 } }),
      ],
    }),
  ]))
  assert.match(html, /<section/)
  assert.match(html, /display:flex;flex-direction:column/)
})

test('blueprintToHtml: note 不渲染, raw 原样嵌入', () => {
  const html = blueprintToHtml(bp([
    el({ type: 'note', props: { content: '设计意图:菜单放右上角' } }),
    el({ type: 'raw', props: { html: '<svg><circle /></svg>' } }),
  ]))
  assert.ok(!html.includes('设计意图'), 'note 不应渲染')
  assert.match(html, /<svg><circle \/><\/svg>/)
})

test('blueprintToHtml: image 内嵌 dataURL + alt', () => {
  const html = blueprintToHtml(bp([
    el({ type: 'image', w: 80, h: 80, props: { src: 'data:image/png;base64,AAAA', alt: 'logo' } }),
  ]))
  assert.match(html, /<img[^>]*src="data:image\/png;base64,AAAA"/)
  assert.match(html, /alt="logo"/)
})

test('blueprintToHtml: 自定义 title', () => {
  const html = blueprintToHtml(bp([]), '我的页面')
  assert.match(html, /<title>我的页面<\/title>/)
})

// ── prompt ──

test('prompt: buildBlueprintPrompt 含完整规则与 JSON', () => {
  const p = buildBlueprintPrompt(bp([el({ type: 'heading', props: { content: 'X' } })]))
  assert.match(p, /严格根据以下画布蓝图/)
  assert.match(p, /映射规则/)
  assert.match(p, /layout:"free"/)
  assert.match(p, /```json/)
  assert.ok(p.includes('"content": "X"'))
})

test('prompt: buildBlueprintPrompt 风格描述追加', () => {
  const p = buildBlueprintPrompt(bp([]), '现代深色 SaaS 风')
  assert.match(p, /【风格要求】现代深色 SaaS 风/)
})

test('prompt: buildWebAIPrompt 强调 base64 原样复制', () => {
  const p = buildWebAIPrompt(bp([el({ type: 'image', props: { src: 'data:image/png;base64,AAA' } })]))
  assert.match(p, /一字不差、原样完整复制/)
  assert.match(p, /不需要解码/)
})

// ── htmlToBlueprint ──

const toDoc = (html: string) => parseHTML(html).document as unknown as Document
/** 解析同一份 html 再注入(避免 doc 与 html 不同源导致 body 为 null) */
const toBP = (html: string) => htmlToBlueprint(html, toDoc(html))

test('htmlToBlueprint: 基础结构 section 根 + heading/text', () => {
  const out = toBP('<html><body><div class="hero"><h1>熊猫商城</h1><p>正品好物</p></div></body></html>')
  assert.ok(out)
  assert.equal(out!.elements[0].type, 'section')
})

test('htmlToBlueprint: row 布局检测(inline flex)', () => {
  const out = toBP('<html><body><div style="display:flex"><a>首页</a><a>分类</a></div></body></html>')
  const nav = out!.elements[0]
  // inline flex 的 div 单根 → 提升为 section,layout 保留 row
  assert.equal(nav.type, 'section')
  assert.equal(nav.layout, 'row')
  assert.equal(nav.children.length, 2) // 两个 a
  assert.equal(nav.children[0].type, 'link')
})

test('htmlToBlueprint: stylesheet class 样式提取', () => {
  const out = toBP(
    '<html><head><style>.card{background:#fff;border-radius:12px}</style></head>' +
    '<body><div class="card"><p>内容</p></div></body></html>',
  )
  // div.card 单根 → 提升为 section,样式留在 section.props 上
  const section = out!.elements[0]
  assert.equal(section.type, 'section')
  assert.equal(section.props.bg, '#fff')
  assert.equal(section.props.radius, 12)
  assert.equal(section.children[0].type, 'text')
})

test('htmlToBlueprint: 表格 table→section / tr→row / td→text', () => {
  const out = toBP('<html><body><table><tr><td>姓名</td><td>分数</td></tr><tr><td>张三</td><td>98</td></tr></table></body></html>')
  const table = out!.elements[0] // table 单根 → 提升为 section
  assert.equal(table.type, 'section')
  assert.equal(table.children.length, 2) // 两行 tr
  assert.equal(table.children[0].layout, 'row')
  assert.equal(table.children[0].children[0].type, 'text')
  assert.equal(table.children[0].children[0].props.content, '姓名')
})

test('htmlToBlueprint: SVG 图标兜底转文本, 无文本丢弃', () => {
  const out = toBP('<html><body><svg aria-label="设置"><path/></svg><svg><path/></svg><p>正文</p></body></html>')
  const texts = out!.elements[0].children.filter((c) => c.type === 'text')
  assert.ok(texts.some((t) => t.props.content === '设置'))
  // 无文本的 svg 被丢弃,只剩 aria-label 的 svg 和 p 两个
  assert.equal(out!.elements[0].children.length, 2)
})

test('htmlToBlueprint: div 无子元素升级为 text', () => {
  const out = toBP('<html><body><div class="banner-title">限时秒杀</div></body></html>')
  const el0 = out!.elements[0]
  // div 无子元素 → 升级为 text,单根文本不提升为 section
  assert.equal(el0.type, 'text')
  assert.equal(el0.props.content, '限时秒杀')
})

test('htmlToBlueprint: 空 body 返回 null', () => {
  assert.equal(toBP('<html><body></body></html>'), null)
})
