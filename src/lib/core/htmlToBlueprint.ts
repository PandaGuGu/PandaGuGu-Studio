// HTML → Blueprint (parse + simplify + auto-layout).
// Pure logic over a DOM-like document: pass a document from the browser
// (DOMParser) or from Node (linkedom) — no global DOM required.
//
// Browser entry: htmlToBlueprint(html) uses the global DOMParser.
// Node entry:   htmlToBlueprint(html, linkedomDoc) where the caller parsed it.

import type { Blueprint, BlueprintElement, SemanticType } from './types'

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

function textContent(el: any, max = 60): string {
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
    // Tables map to nested containers: table → column, tr → row, td/th → text-or-box.
    case 'table': case 'thead': case 'tbody': case 'tfoot': case 'tr':
    case 'td': case 'th': case 'caption': case 'colgroup': case 'col':
      return 'container'
    default: return null
  }
}

const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'template', 'head', 'meta', 'link', 'title', 'br', 'hr', 'path', 'iframe'])

/** Parse the document's <style> sheet into a className → declarations map. */
function parseStylesheet(css: string): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {}
  const re = /\.([a-zA-Z0-9_-]+)\s*\{([^}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(css))) {
    const cls = m[1]
    if (!out[cls]) out[cls] = {}
    for (const decl of m[2].split(';')) {
      const idx = decl.indexOf(':')
      if (idx < 0) continue
      const k = decl.slice(0, idx).trim().toLowerCase()
      const v = decl.slice(idx + 1).trim()
      out[cls][k] = v
    }
  }
  return out
}

/** Merge declarations from all of el's classes into props using STYLE_PROPS mapping. */
function applyClassStyles(
  el: any,
  props: Record<string, any>,
  stylesheet: Record<string, Record<string, string>>,
): void {
  const cls = el.getAttribute('class')
  if (!cls) return
  const merged: Record<string, string> = {}
  for (const c of cls.split(/\s+/)) {
    const decls = stylesheet[c]
    if (decls) Object.assign(merged, decls)
  }
  for (const k of Object.keys(merged)) {
    const target = STYLE_PROPS[k]
    if (!target) continue
    const v = merged[k]
    if (k === 'font-size' || k === 'padding' || k === 'border-radius' || k === 'font-weight') {
      const n = parseFloat(v)
      if (!isNaN(n)) props[target] = n
    } else {
      props[target] = v
    }
  }
}

/** Detect layout direction for a container.
 *  Prefers inline-style cues; falls back to className heuristics (most real-world
 *  flex containers are styled via classes, not inline style). */
function detectLayout(style: string | undefined, tag: string, el?: any): 'row' | 'column' {
  if (style && /display:\s*(flex|inline-flex)|float:\s*(left|right)/.test(style)) return 'row'
  if (['ul', 'ol', 'tr'].includes(tag)) return 'row'
  if (el) {
    const cls = (el.getAttribute('class') || '').toLowerCase()
    // Common flex-row class patterns
    if (/\b(row|bar|nav|status|list|items|category|actions|header|footer|search|icons|nav-bar)\b/.test(cls)) return 'row'
    // All-inline children (e.g. spans/buttons/anchors) → row
    if (el.children.length >= 2) {
      let inlineCount = 0
      for (const c of Array.from(el.children as any[])) {
        if (['span', 'a', 'button', 'img', 'li', 'td', 'th'].includes(c.tagName.toLowerCase())) inlineCount++
      }
      if (inlineCount === el.children.length) return 'row'
    }
  }
  return 'column'
}

const FONT_SIZES: Record<string, number> = { h1: 32, h2: 28, h3: 24, h4: 20, h5: 18, h6: 16 }

interface LayoutContext {
  x: number
  y: number
  w: number
}

const GAP = 16

/** Recursively simplify a DOM node into a BlueprintElement tree with estimated layout. */
function simplify(el: any, ctx: LayoutContext, stylesheet: Record<string, Record<string, string>> = {}): BlueprintElement | null {
  const tag = el.tagName.toLowerCase()
  if (SKIP_TAGS.has(tag)) return null
  if (tag === 'html' || tag === 'body') {
    // Treat body as the root container; lay children out directly.
    let y = ctx.y
    let out: BlueprintElement[] = []
    for (const child of Array.from(el.children as any[])) {
      const node = simplify(child, { x: ctx.x, y, w: ctx.w }, stylesheet)
      if (node) {
        out.push(node)
        y = node.y + node.h + GAP
      }
    }
    if (out.length === 0) return null
    // Collapse: a single root child stays a root; promote container-like roots to
    // section so the import produces a real Excalidraw frame (画框) around the page.
    if (out.length === 1) {
      const single = out[0]
      if (single.type !== 'section' && single.type !== 'heading' && single.type !== 'text' &&
          single.type !== 'link' && single.type !== 'button' && single.type !== 'input' &&
          single.type !== 'image' && single.type !== 'note') {
        return { ...single, type: 'section', layout: single.layout || 'column' }
      }
      return single
    }
    const root: BlueprintElement = {
      type: 'section', x: ctx.x, y: ctx.y, w: ctx.w,
      h: y - ctx.y - GAP, angle: 0, layout: 'column', props: {}, children: out, zIndex: 0,
    }
    return root
  }

  // SVG icons: extract any embedded <title>/<text> (or aria-label) as a text
  // element; drop the vector art itself. Icons without a textual hint are skipped.
  // Handled before the semantic check because svg has no semantic mapping.
  if (tag === 'svg') {
    const titleEl = el.querySelector('title, text')
    const alt = el.getAttribute('aria-label') || el.getAttribute('role')
    const label = (titleEl?.textContent || alt || '').trim()
    if (!label) return null
    return {
      type: 'text',
      x: ctx.x, y: ctx.y, w: Math.min(ctx.w, 160), h: 20,
      angle: 0, layout: 'free',
      props: { content: label, fontSize: 14 },
      children: [], zIndex: 0,
    }
  }

  let semantic = tagToSemantic(tag)
  if (!semantic) return null
  const style = (el.getAttribute('style') || undefined)
  let props: Record<string, any> = { ...parseInlineStyle(style) }
  // Merge in styles extracted from the document's <style> sheet.
  applyClassStyles(el, props, stylesheet)

  // Promote a <div>/<td>/<th> with no element children to text — common pattern for
  // headlines / descriptions / labels / table cells that should render as text.
  if (semantic === 'container' && ['div', 'td', 'th'].includes(tag) && el.children.length === 0) {
    const txt = textContent(el, 200)
    if (txt) {
      semantic = 'text'
      props.content = txt
      props.fontSize = props.fontSize || 14
    }
  }

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

  // Children (only for container-like types): apply row vs column layout.
  let children: BlueprintElement[] = []
  if (semantic === 'section' || semantic === 'container' || semantic === 'nav') {
    const layout = detectLayout(style, tag, el)
    const childArr = Array.from(el.children as any[])
    if (layout === 'row' && childArr.length >= 2) {
      // Equal-width row, vertically padded inside the container. Table rows pack tighter.
      const rowGap = tag === 'tr' ? 2 : GAP
      const pad = rowGap
      const innerW = Math.max(40, w - pad * 2)
      const childW = Math.max(40, Math.floor((innerW - rowGap * (childArr.length - 1)) / childArr.length))
      const childY = ctx.y + pad
      let xCursor = ctx.x + pad
      let maxChildH = 0
      for (const child of childArr) {
        const node = simplify(child, { x: xCursor, y: childY, w: childW }, stylesheet)
        if (node) {
          children.push(node)
          xCursor = node.x + node.w + rowGap
          if (node.h > maxChildH) maxChildH = node.h
        }
      }
      h = h > 0 ? h : maxChildH + pad * 2
      if (h < maxChildH + pad * 2) h = maxChildH + pad * 2
    } else {
      // Column (stack children vertically).
      let childStartY = ctx.y + (h > 0 ? h + GAP : GAP)
      for (const child of childArr) {
        const node = simplify(child, { x: ctx.x, y: childStartY, w }, stylesheet)
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
    }
    if (h <= 0) h = 60
  }

  const out: BlueprintElement = {
    type: semantic,
    x: ctx.x,
    y: ctx.y,
    w: Math.round(w),
    h: Math.round(h),
    angle: 0,
    layout: semantic === 'section' || semantic === 'container' || semantic === 'nav'
      ? detectLayout(style, tag, el)
      : 'free',
    props,
    children,
    zIndex: 0,
  }
  return out
}

/**
 * HTML string → Blueprint tree (simplified + auto-layout).
 * @param html 完整 HTML 文档字符串
 * @param doc 可选:已解析好的 document(Node 端用 linkedom 等传入);
 *            省略时浏览器端用全局 DOMParser 解析。
 */
export function htmlToBlueprint(html: string, doc?: Document | null): Blueprint | null {
  const d = doc || new DOMParser().parseFromString(html, 'text/html')
  // Parse the embedded stylesheet once so every element can pull its CSS class styles.
  const styleEl = d.querySelector('style')
  const stylesheet = styleEl ? parseStylesheet(styleEl.textContent || '') : {}
  const body = d.body
  if (!body || body.children.length === 0) return null
  const root = simplify(body, { x: 40, y: 40, w: 720 }, stylesheet)
  if (!root) return null
  return {
    elements: [root],
  }
}
