import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { Blueprint, BlueprintElement, SemanticType } from './blueprint'
import { setSemantic, DEFAULT_LAYOUT } from './blueprint'

/** Inline style props we can extract into structured blueprint props. */
const STYLE_PROPS: Record<string, string> = {
  'background-color': 'bg',
  background: 'bg',
  color: 'color',
  'font-size': 'fontSize',
  'border-radius': 'radius',
  padding: 'padding',
  'text-align': 'align',
  'font-weight': 'fontWeight',
}

function parseInlineStyle(style: string | undefined): Record<string, any> {
  const out: Record<string, any> = {}
  if (!style) return out
  for (const decl of style.split(';')) {
    const idx = decl.indexOf(':')
    if (idx < 0) continue
    const key = decl.slice(0, idx).trim().toLowerCase()
    const value = decl.slice(idx + 1).trim()
    const target = STYLE_PROPS[key]
    if (!target) continue
    if (key === 'font-size' || key === 'padding' || key === 'border-radius' || key === 'font-weight') {
      const n = parseFloat(value)
      if (!isNaN(n)) out[target] = n
    } else {
      out[target] = value
    }
  }
  return out
}

function textContent(el: Element, max = 60): string {
  return (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, max)
}

/** Map a DOM element to a semantic type. */
function tagToSemantic(tag: string): SemanticType | null {
  switch (tag) {
    case 'section': case 'main': case 'article': return 'section'
    case 'header': case 'footer': return 'container'
    case 'nav': return 'nav'
    case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': return 'heading'
    case 'p': case 'span': case 'li': case 'blockquote': return 'text'
    case 'a': return 'link'
    case 'button': return 'button'
    case 'input': case 'textarea': case 'select': return 'input'
    case 'img': return 'image'
    case 'form': case 'div': case 'ul': case 'ol': case 'aside': return 'container'
    default: return null
  }
}

const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'template', 'head', 'meta', 'link', 'title', 'br', 'hr', 'svg', 'path', 'iframe'])

/** Convert an inline-style string to a layout hint. */
function detectLayout(style: string | undefined, tag: string): 'row' | 'column' {
  if (style && /display:\s*flex|display:\s*inline|float:\s*left|float:\s*right/.test(style)) return 'row'
  if (['ul', 'ol', 'span', 'a', 'button'].includes(tag)) return 'row'
  return 'column'
}

const FONT_SIZES: Record<string, number> = { h1: 32, h2: 28, h3: 24, h4: 20, h5: 18, h6: 16 }

let idCounter = 1
function nextId(): string {
  return `imp-${idCounter++}-${Math.random().toString(36).slice(2, 6)}`
}

interface LayoutContext {
  x: number
  y: number
  w: number
}

const GAP = 16

/** Recursively simplify a DOM node into a BlueprintElement tree with estimated layout. */
function simplify(el: Element, ctx: LayoutContext): BlueprintElement | null {
  const tag = el.tagName.toLowerCase()
  if (SKIP_TAGS.has(tag)) return null
  if (tag === 'html' || tag === 'body') {
    // Treat body as the root container; lay children out directly.
    let y = ctx.y
    let out: BlueprintElement[] = []
    for (const child of Array.from(el.children)) {
      const node = simplify(child, { x: ctx.x, y, w: ctx.w })
      if (node) {
        out.push(node)
        y = node.y + node.h + GAP
      }
    }
    if (out.length === 0) return null
    // Collapse: if root has a single child, return it directly.
    if (out.length === 1) return out[0]
    const root: BlueprintElement = {
      id: nextId(), type: 'section', x: ctx.x, y: ctx.y, w: ctx.w,
      h: y - ctx.y - GAP, angle: 0, layout: 'column', props: {}, children: out, zIndex: 0,
    }
    return root
  }

  const semantic = tagToSemantic(tag)
  if (!semantic) return null
  const style = (el.getAttribute('style') || undefined)
  const props: Record<string, any> = { ...parseInlineStyle(style) }

  if (semantic === 'heading') {
    const level = parseInt(tag.slice(1), 10) || 1
    props.content = textContent(el, 80) || `标题 ${level}`
    props.level = level
    props.fontSize = props.fontSize || FONT_SIZES[tag] || 24
  } else if (semantic === 'text') {
    props.content = textContent(el, 200) || '文本'
    props.fontSize = props.fontSize || 14
  } else if (semantic === 'link') {
    props.label = textContent(el, 40) || '链接'
    props.href = el.getAttribute('href') || '#'
  } else if (semantic === 'button') {
    props.label = textContent(el, 40) || '按钮'
  } else if (semantic === 'input') {
    props.placeholder = el.getAttribute('placeholder') || ''
  } else if (semantic === 'image') {
    props.src = el.getAttribute('src') || ''
    props.alt = el.getAttribute('alt') || ''
  } else {
    props.label = textContent(el, 30) || (el.getAttribute('id') || tag)
  }

  // Estimate dimensions.
  let w: number
  let h: number
  const parentW = ctx.w
  if (semantic === 'heading') { w = Math.min(parentW, 480); h = (props.fontSize || 24) * 1.5 }
  else if (semantic === 'text') { w = Math.min(parentW, 640); h = Math.max(20, (props.fontSize || 14) * 1.6) }
  else if (semantic === 'link') { w = Math.min(parentW, 200); h = 20 }
  else if (semantic === 'button') { w = Math.min(parentW, 180); h = 40 }
  else if (semantic === 'input') { w = Math.min(parentW, 260); h = 36 }
  else if (semantic === 'image') { w = Math.min(parentW, 200); h = 120 }
  else { w = parentW; h = 0 }

  // Children (only for container-like types).
  let children: BlueprintElement[] = []
  let childStartY = ctx.y + (h > 0 ? h + GAP : 0)
  if (semantic === 'section' || semantic === 'container' || semantic === 'nav') {
    for (const child of Array.from(el.children)) {
      const node = simplify(child, { x: ctx.x, y: childStartY, w })
      if (node) {
        children.push(node)
        childStartY = node.y + node.h + GAP
      }
    }
    if (children.length > 0) {
      h = h > 0 ? h : childStartY - ctx.y - GAP
      if (h <= 0) h = childStartY - ctx.y - GAP
      // Container with children: width spans the children.
      for (const c of children) {
        if (c.x + c.w > ctx.x + w) w = c.x + c.w - ctx.x
      }
    }
    if (h <= 0) h = 60
  }

  const out: BlueprintElement = {
    id: nextId(),
    type: semantic,
    x: ctx.x,
    y: ctx.y,
    w: Math.round(w),
    h: Math.round(h),
    angle: 0,
    layout: semantic === 'section' || semantic === 'container' || semantic === 'nav'
      ? detectLayout(style, tag)
      : 'free',
    props,
    children,
    zIndex: 0,
  }
  return out
}

/** HTML string → Blueprint tree (simplified + auto-layout). */
export function htmlToBlueprint(html: string): Blueprint | null {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const body = doc.body
  if (!body || body.children.length === 0) return null
  const root = simplify(body, { x: 40, y: 40, w: 720 })
  if (!root) return null
  return {
    elements: [root],
  }
}

// ── Blueprint → Excalidraw elements ──

function makeRect(semantic: SemanticType, b: BlueprintElement, props: Record<string, any>): any {
  return {
    id: b.id,
    type: 'rectangle',
    x: b.x, y: b.y, width: Math.max(b.w, 20), height: Math.max(b.h, 16),
    angle: 0,
    strokeColor: semantic === 'note' ? '#EF9F27' : '#4a9e8e',
    backgroundColor: semantic === 'note' ? '#FAEEDA' : 'transparent',
    fillStyle: 'solid', strokeWidth: 2, strokeStyle: 'solid',
    roundness: { type: 'proportional', value: 0.08 },
    roughness: 1, opacity: 100,
    seed: Math.floor(Math.random() * 2 ** 31),
    version: 1, versionNonce: Math.floor(Math.random() * 2 ** 31),
    index: null, isDeleted: false,
    groupIds: [], frameId: null, boundElements: null,
    updated: Date.now(), link: null, locked: false,
  }
}

function makeText(semantic: SemanticType, b: BlueprintElement, props: Record<string, any>): any {
  return {
    id: b.id,
    type: 'text',
    x: b.x, y: b.y, width: Math.max(b.w, 60), height: Math.max(b.h, 20),
    angle: 0,
    strokeColor: props.color || '#d4d4d8',
    backgroundColor: 'transparent',
    fillStyle: 'solid', strokeWidth: 2, strokeStyle: 'solid',
    roundness: null, roughness: 1, opacity: 100,
    seed: Math.floor(Math.random() * 2 ** 31),
    version: 1, versionNonce: Math.floor(Math.random() * 2 ** 31),
    index: null, isDeleted: false,
    groupIds: [], frameId: null, boundElements: null,
    updated: Date.now(), link: null, locked: false,
    textAlign: props.align === 'center' ? 'center' : props.align === 'right' ? 'right' : 'left',
    verticalAlign: 'top',
    fontFamily: semantic === 'heading' ? 2 : 1,
    fontSize: props.fontSize || (semantic === 'heading' ? 24 : 14),
    text: props.content || props.label || '',
    baseline: 0,
    originalText: props.content || props.label || '',
  }
}

function blueprintElementToExcalidraw(b: BlueprintElement, indexSeed: { n: number }): ExcalidrawElement[] {
  const props = b.props || {}
  let el: any
  if (b.type === 'heading' || b.type === 'text' || b.type === 'link') {
    el = makeText(b.type, b, props)
  } else {
    el = makeRect(b.type, b, props)
  }
  el.index = `a${String(indexSeed.n++).padStart(4, '0')}`
  el.customData = { semantic: { type: b.type, layout: b.layout || DEFAULT_LAYOUT, props: b.props || {} } }
  const els: ExcalidrawElement[] = [el]
  for (const child of b.children || []) {
    // Containers: keep absolute positions as estimated; children nest via containerId.
    const childEls = blueprintElementToExcalidraw(child, indexSeed)
    for (const ce of childEls) {
      ;(ce as any).containerId = b.id
    }
    els.push(...childEls)
  }
  return els as ExcalidrawElement[]
}

/** Blueprint tree → Excalidraw scene elements (with semantic tags). */
export function blueprintToElements(bp: Blueprint): ExcalidrawElement[] {
  const out: ExcalidrawElement[] = []
  const seed = { n: 1 }
  for (const root of bp.elements) {
    out.push(...blueprintElementToExcalidraw(root, seed))
  }
  return out
}

/** One-shot: parse HTML, simplify, auto-layout, and push onto the canvas (clears existing scene). */
export function importHtmlToScene(api: ExcalidrawImperativeAPI, html: string): boolean {
  const bp = htmlToBlueprint(html)
  if (!bp) return false
  const elements = blueprintToElements(bp)
  api.updateScene({ elements: elements as any })
  return true
}
