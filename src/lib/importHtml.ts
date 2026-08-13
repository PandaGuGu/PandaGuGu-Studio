import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { Blueprint, BlueprintElement, SemanticType } from './blueprint'
import { setSemantic, DEFAULT_LAYOUT } from './blueprint'
// Excalidraw 0.18 orders elements by fractional index (a0, a1, …, az, b0, …).
// Hand-rolled base62 counters produce invalid keys ("0", "a", …) that make
// updateScene throw "invalid order key" — always use the official generator.
import { generateNKeysBetween } from 'fractional-indexing'

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
  el: Element,
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
function detectLayout(style: string | undefined, tag: string, el?: Element): 'row' | 'column' {
  if (style && /display:\s*(flex|inline-flex)|float:\s*(left|right)/.test(style)) return 'row'
  if (['ul', 'ol', 'tr'].includes(tag)) return 'row'
  if (el) {
    const cls = (el.getAttribute('class') || '').toLowerCase()
    // Common flex-row class patterns
    if (/\b(row|bar|nav|status|list|items|category|actions|header|footer|search|icons|nav-bar)\b/.test(cls)) return 'row'
    // All-inline children (e.g. spans/buttons/anchors) → row
    if (el.children.length >= 2) {
      let inlineCount = 0
      for (const c of Array.from(el.children)) {
        if (['span', 'a', 'button', 'img', 'li', 'td', 'th'].includes(c.tagName.toLowerCase())) inlineCount++
      }
      if (inlineCount === el.children.length) return 'row'
    }
  }
  return 'column'
}

/** Pre-generated legal fractional indices, dispensed in scene order. */
interface IndexSeed {
  keys: string[]
  i: number
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
function simplify(el: Element, ctx: LayoutContext, stylesheet: Record<string, Record<string, string>> = {}): BlueprintElement | null {
  const tag = el.tagName.toLowerCase()
  if (SKIP_TAGS.has(tag)) return null
  if (tag === 'html' || tag === 'body') {
    // Treat body as the root container; lay children out directly.
    let y = ctx.y
    let out: BlueprintElement[] = []
    for (const child of Array.from(el.children)) {
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
    const childArr = Array.from(el.children)
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

/** HTML string → Blueprint tree (simplified + auto-layout). */
export function htmlToBlueprint(html: string): Blueprint | null {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  // Parse the embedded stylesheet once so every element can pull its CSS class styles.
  const styleEl = doc.querySelector('style')
  const stylesheet = styleEl ? parseStylesheet(styleEl.textContent || '') : {}
  const body = doc.body
  if (!body || body.children.length === 0) return null
  const root = simplify(body, { x: 40, y: 40, w: 720 }, stylesheet)
  if (!root) return null
  return {
    elements: [root],
  }
}

// ── Blueprint → Excalidraw elements ──

function makeRect(semantic: SemanticType, b: BlueprintElement, props: Record<string, any>): any {
  // Apply extracted styles. Buttons get the brand teal by default; containers stay
  // transparent unless an explicit bg was extracted from the source.
  const defaultStroke = semantic === 'note' ? '#EF9F27'
                      : semantic === 'button' ? '#ffffff'
                      : '#94a3b8'
  const defaultBg = semantic === 'note' ? '#FAEEDA'
                  : props.bg || (semantic === 'button' ? '#4a9e8e' : 'transparent')
  const roundness = props.radius != null
    ? { type: 'proportional' as const, value: Math.min(1, props.radius / 60) }
    : { type: 'proportional' as const, value: 0.08 }
  return {
    id: nextId(),
    type: 'rectangle',
    x: b.x, y: b.y, width: Math.max(b.w, 20), height: Math.max(b.h, 16),
    angle: 0,
    strokeColor: props.color || defaultStroke,
    backgroundColor: defaultBg,
    fillStyle: 'solid', strokeWidth: 2, strokeStyle: 'solid',
    roundness,
    roughness: 1, opacity: 100,
    seed: Math.floor(Math.random() * 2 ** 31),
    version: 1, versionNonce: Math.floor(Math.random() * 2 ** 31),
    index: null, isDeleted: false,
    groupIds: [], frameId: null, boundElements: null,
    updated: Date.now(), link: null, locked: false,
  }
}

function makeText(semantic: SemanticType, b: BlueprintElement, props: Record<string, any>): any {
  const fontSize = props.fontSize || (semantic === 'heading' ? 24 : 14)
  const fontFamily = (semantic === 'heading' || (props.fontWeight && props.fontWeight >= 600)) ? 2 : 1
  return {
    id: nextId(),
    type: 'text',
    x: b.x, y: b.y, width: Math.max(b.w, 60), height: Math.max(b.h, 20),
    angle: 0,
    strokeColor: props.color || (semantic === 'heading' ? '#1a1a1a' : '#6b7a8a'),
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
    fontFamily,
    fontSize,
    text: props.content || props.label || '',
    baseline: 0,
    originalText: props.content || props.label || '',
  }
}

function blueprintElementToExcalidraw(b: BlueprintElement, indexSeed: IndexSeed, frameId?: string): ExcalidrawElement[] {
  const props = b.props || {}
  let el: any
  if (b.type === 'heading' || b.type === 'text' || b.type === 'link') {
    el = makeText(b.type, b, props)
  } else if (b.type === 'image') {
    // Excalidraw image element — the actual bitmap is fetched in importHtmlToScene
    // (materializeImages) and attached via `files` + fileId.
    el = {
      ...makeRect('image', b, props),
      type: 'image',
      strokeColor: 'transparent',
      backgroundColor: 'transparent',
      status: 'pending',
      fileId: null,
      scale: [1, 1] as [number, number],
      crop: null,
    }
  } else {
    el = makeRect(b.type, b, props)
  }
  if (frameId) el.frameId = frameId
  el.index = indexSeed.keys[indexSeed.i++]
  el.customData = { semantic: { type: b.type, layout: b.layout || DEFAULT_LAYOUT, props: b.props || {} } }
  const els: ExcalidrawElement[] = [el]
  // Buttons & inputs carry their label inside the box — overlay a centred text element.
  if ((b.type === 'button' || b.type === 'input') && !props.content) {
    const overlayText = b.type === 'input' ? props.placeholder : props.label
    if (overlayText) {
      const fontSize = props.fontSize || 14
      const overlayProps: Record<string, any> = {
        content: overlayText,
        color: props.color || (b.type === 'button' ? '#ffffff' : '#6b7a8a'),
        fontSize,
        align: 'center',
      }
      const overlayEl: any = {
        ...makeText('text', { ...b, x: b.x, y: b.y, w: b.w, h: b.h, props: overlayProps }, overlayProps),
        x: b.x,
        y: b.y + (b.h - fontSize) / 2,
        width: b.w,
        height: fontSize + 4,
        textAlign: 'center',
        fontSize,
      }
      overlayEl.index = indexSeed.keys[indexSeed.i++]
      if (frameId) overlayEl.frameId = frameId
      overlayEl.customData = { semantic: { type: 'text', layout: 'free', props: overlayProps } }
      els.push(overlayEl as ExcalidrawElement)
    }
  }
  for (const child of b.children || []) {
    // Containers: keep absolute positions as estimated; children nest via containerId.
    const childEls = blueprintElementToExcalidraw(child, indexSeed, frameId)
    for (const ce of childEls) {
      ;(ce as any).containerId = el.id
    }
    els.push(...childEls)
  }
  return els as ExcalidrawElement[]
}

/** Pick a human-friendly page title for the frame: first heading, then a
 *  "title-like" text node — must contain CJK or ASCII letters (skips status
 *  bars like "9:41", emoji-only icons, and pure numbers). */
function findPageTitle(b: BlueprintElement): string | null {
  const looksLikeTitle = (s: string) => s.length >= 2 && /[\u4e00-\u9fffA-Za-z]/.test(s)
  const walk = (e: BlueprintElement): string | null => {
    if (e.type === 'heading' && e.props?.content) {
      const t = String(e.props.content).trim()
      if (looksLikeTitle(t)) return t
    }
    if (e.type === 'text' && e.props?.content) {
      const t = String(e.props.content).trim()
      if (looksLikeTitle(t) && !/^[\d\s\p{Emoji}]+$/u.test(t)) return t
    }
    for (const c of e.children || []) {
      const r = walk(c)
      if (r) return r
    }
    return null
  }
  return walk(b)
}

/** Build a real Excalidraw frame from a root section element. */
function makeFrame(b: BlueprintElement, indexSeed: IndexSeed): any {
  return {
    id: nextId(),
    type: 'frame',
    name: (findPageTitle(b) || (b.props && b.props.label) || 'Frame').slice(0, 24),
    x: b.x, y: b.y, width: Math.max(b.w, 100), height: Math.max(b.h, 100),
    angle: 0,
    backgroundColor: (b.props && b.props.bg) || 'rgba(255,255,255,0.15)',
    fillStyle: 'solid', strokeWidth: 2, strokeStyle: 'solid',
    roundness: null, roughness: 1, opacity: 100,
    seed: Math.floor(Math.random() * 2 ** 31),
    version: 1, versionNonce: Math.floor(Math.random() * 2 ** 31),
    index: indexSeed.keys[indexSeed.i++],
    isDeleted: false,
    groupIds: [], frameId: null, boundElements: null,
    updated: Date.now(), link: null, locked: false,
  }
}

/** Count all elements in the blueprint tree (roots + descendants). */
function countElements(bp: Blueprint): number {
  let n = 0
  const walk = (e: BlueprintElement) => {
    n++
    for (const c of e.children || []) walk(c)
  }
  bp.elements.forEach(walk)
  return n
}

/** Blueprint tree → Excalidraw scene elements (with semantic tags).
 *  Root sections become real frames; their children bind to the frame via frameId. */
export function blueprintToElements(bp: Blueprint): ExcalidrawElement[] {
  const out: ExcalidrawElement[] = []
  const total = countElements(bp)
  // Legal, ordered fractional indices — pre-generate once for the whole scene.
  const seed: IndexSeed = { keys: generateNKeysBetween(null, null, total), i: 0 }
  for (const root of bp.elements) {
    if (root.type === 'section') {
      const frame = makeFrame(root, seed)
      out.push(frame as any)
      for (const child of root.children || []) {
        out.push(...blueprintElementToExcalidraw(child, seed, frame.id))
      }
    } else {
      out.push(...blueprintElementToExcalidraw(root, seed))
    }
  }
  return out
}

/** Convert a Blob to a data URL. */
function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/**
 * Download every pending image element's src and attach it as an Excalidraw
 * binary file. Failed / missing sources degrade to a plain rectangle placeholder.
 */
async function materializeImages(elements: any[]): Promise<Record<string, any>> {
  const files: Record<string, any> = {}
  const degrade = (el: any) => {
    el.type = 'rectangle'
    el.status = undefined
    el.fileId = null
    el.scale = undefined
    el.crop = undefined
    el.strokeColor = '#94a3b8'
    el.backgroundColor = 'transparent'
  }
  for (const el of elements) {
    if (el.type !== 'image' || el.fileId) continue
    const src = el.customData?.semantic?.props?.src as string | undefined
    if (!src) { degrade(el); continue }
    try {
      let dataURL = src
      let mimeType = 'image/png'
      if (src.startsWith('data:')) {
        mimeType = src.slice(5, src.indexOf(';')) || 'image/png'
      } else {
        const resp = await fetch(src)
        if (!resp.ok) throw new Error('HTTP ' + resp.status)
        const blob = await resp.blob()
        dataURL = await blobToDataURL(blob)
        mimeType = blob.type || 'image/png'
      }
      const fileId = 'file-' + Math.random().toString(36).slice(2, 10)
      // Excalidraw BinaryFileData: id + created + lastRetrieved are required
      // for addFiles to store the file under the element's fileId.
      files[fileId] = {
        id: fileId,
        mimeType,
        dataURL,
        created: Date.now(),
        lastRetrieved: Date.now(),
      }
      el.fileId = fileId
      el.status = 'saved'
    } catch {
      degrade(el)
    }
  }
  return files
}

/** One-shot: parse HTML, simplify, auto-layout, and push onto the canvas (clears existing scene). */
export async function importHtmlToScene(api: ExcalidrawImperativeAPI, html: string): Promise<boolean> {
  const bp = htmlToBlueprint(html)
  if (!bp) return false
  const elements = blueprintToElements(bp) as any[]
  const files = await materializeImages(elements)
  // NOTE: updateScene ignores `files` in Excalidraw 0.18 — binary data must be
  // registered explicitly via addFiles, otherwise getFiles() returns nothing
  // and exported blueprints lose the image data.
  api.updateScene({ elements: elements as any })
  const fileList = Object.values(files)
  if (fileList.length > 0) api.addFiles(fileList as any)
  scrollToContentSafe(api)
  return true
}

/** Apply a prebuilt blueprint (e.g. a template) to the canvas, clearing the existing scene. */
export function applyBlueprintToScene(api: ExcalidrawImperativeAPI, bp: Blueprint): boolean {
  if (!bp || bp.elements.length === 0) return false
  const elements = blueprintToElements(bp)
  api.updateScene({ elements: elements as any })
  scrollToContentSafe(api)
  return true
}

/** Scroll the viewport to the scene content so freshly generated elements are visible. */
function scrollToContentSafe(api: ExcalidrawImperativeAPI) {
  try {
    api.scrollToContent()
  } catch {
    // viewport already sensible — ignore
  }
}
