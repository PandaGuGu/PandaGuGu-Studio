// Blueprint v2 — semantic element types + serialization.
// A "blueprint" is an open, human-editable JSON description of the canvas
// layout with semantic tags — the input contract for AI generation and
// batch variants.
//
// v2 adds: layout hint, free CSS, events contract, raw HTML escape,
// note (sticky text for AI), and 12 semantic types total.

import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'

// ── Semantic type catalog (v2) ──

export type SemanticType =
  | 'container' | 'section' | 'card' | 'nav'
  | 'heading' | 'text' | 'link'
  | 'button' | 'input'
  | 'image'
  | 'raw' | 'note'

export type LayoutHint = 'free' | 'row' | 'column' | 'grid' | 'wrap'

export interface SemanticMeta {
  type: SemanticType
  layout: LayoutHint
  props: Record<string, any>
  style?: string
  events?: Record<string, string>
  html?: string
}

export interface BlueprintElement {
  type: SemanticType
  x: number
  y: number
  w: number
  h: number
  angle: number
  layout: LayoutHint
  /** Scene z-order (0 = bottom). Use as z-index when elements overlap. */
  zIndex: number
  props: Record<string, any>
  style?: string
  events?: Record<string, string>
  html?: string
  children: BlueprintElement[]
}

export interface Blueprint {
  elements: BlueprintElement[]
}

export const SEMANTIC_TYPES: SemanticType[] = [
  'container', 'section', 'card', 'nav',
  'heading', 'text', 'link',
  'button', 'input',
  'image',
  'raw', 'note',
]

/** Grouping for toolbar rendering. */
export const SEMANTIC_GROUPS: { label: string; types: SemanticType[] }[] = [
  { label: 'container',  types: ['container', 'section', 'card', 'nav'] },
  { label: 'content',    types: ['heading', 'text', 'link'] },
  { label: 'control',    types: ['button', 'input'] },
  { label: 'media',      types: ['image'] },
  { label: 'special',    types: ['raw', 'note'] },
]

export const LAYOUTS: LayoutHint[] = ['free', 'row', 'column', 'grid', 'wrap']

export const DEFAULT_LAYOUT: LayoutHint = 'free'

/** Default props per type — populated when user tags an element. */
export const DEFAULT_PROPS: Record<SemanticType, Record<string, any>> = {
  container: { label: '容器',   bg: '#d4d4d8', radius: 12, padding: 16 },
  section:   { label: '区段',   bg: '#f4f6f9', radius: 16, padding: 32, border: '#d6dbe5' },
  card:      { label: '卡片',   bg: '#ffffff', radius: 12, padding: 20, shadow: 'sm' },
  nav:       { label: '导航',   bg: '#ffffff', padding: 12, align: 'left' },

  heading:   { content: '标题',  level: 1, fontSize: 36, fontWeight: 700, color: '#18181b', align: 'left' },
  text:      { content: '文本',  fontSize: 16, color: '#3f3f46', bold: false, align: 'left' },
  link:      { label: '链接',    href: '#', color: '#2e7d6f' },

  button:    { label: '按钮',    bg: '#2563eb', color: '#ffffff', radius: 8 },
  input:     { placeholder: '请输入…', type: 'text', label: '输入框', bg: '#ffffff', border: '#d6dbe5' },

  image:     { fileName: '', alt: '图片', src: '', fit: 'cover' },

  raw:       { html: '<!-- raw HTML 片段 -->' },
  note:      { content: '便签:写给 AI 的注释', color: '#854F0B' },
}

/** Map semantic type → Excalidraw shape kind. */
export const SHAPE_OF: Record<SemanticType, 'rectangle' | 'text' | 'image'> = {
  container: 'rectangle', section: 'rectangle', card: 'rectangle', nav: 'rectangle',
  heading: 'text', text: 'text', link: 'text',
  button: 'rectangle', input: 'rectangle',
  image: 'image',
  raw: 'rectangle', note: 'rectangle',
}

/** Heading level → default font size. */
export const HEADING_SIZES: Record<number, number> = {
  1: 48, 2: 36, 3: 24, 4: 20, 5: 18, 6: 16,
}

// ── Helpers ──

/** Strip the default "Frame N" name down to just the number: "Frame 1" -> "1". Custom names pass through. */
function frameLabel(name: string | undefined): string {
  const n = (name || '').trim()
  if (!n) return 'Section'
  const m = n.match(/^Frame\s*(\d+)$/i)
  return m ? m[1] : n
}

export function canTag(el: ExcalidrawElement): boolean {
  return (
    el.type === 'rectangle' ||
    el.type === 'text' ||
    el.type === 'image'
  )
}

export function getSemantic(el: ExcalidrawElement): SemanticMeta | null {
  const cd = (el as any).customData as { semantic?: SemanticMeta } | undefined
  if (cd?.semantic?.type) return cd.semantic
  return null
}

export function setSemantic(
  el: ExcalidrawElement,
  meta: SemanticMeta | null
): ExcalidrawElement {
  const next = { ...el } as any
  const cd = { ...((el as any).customData || {}) }
  if (meta) {
    cd.semantic = meta
  } else {
    delete cd.semantic
  }
  next.customData = Object.keys(cd).length ? cd : undefined
  return next as ExcalidrawElement
}

export function setSemanticProps(
  el: ExcalidrawElement,
  patch: Record<string, any>
): ExcalidrawElement {
  const meta = getSemantic(el)
  if (!meta) return el
  return setSemantic(el, { ...meta, props: { ...meta.props, ...patch } })
}

export function setSemanticLayout(
  el: ExcalidrawElement,
  layout: LayoutHint
): ExcalidrawElement {
  const meta = getSemantic(el)
  if (!meta) return el
  return setSemantic(el, { ...meta, layout })
}

export function setSemanticStyle(
  el: ExcalidrawElement,
  style: string | undefined
): ExcalidrawElement {
  const meta = getSemantic(el)
  if (!meta) return el
  const m = { ...meta }
  if (style?.trim()) m.style = style
  else delete m.style
  return setSemantic(el, m)
}

export function setSemanticEvents(
  el: ExcalidrawElement,
  events: Record<string, string> | undefined
): ExcalidrawElement {
  const meta = getSemantic(el)
  if (!meta) return el
  const m = { ...meta }
  if (events && Object.keys(events).length) m.events = events
  else delete m.events
  return setSemantic(el, m)
}

export function setSemanticHtml(
  el: ExcalidrawElement,
  html: string | undefined
): ExcalidrawElement {
  const meta = getSemantic(el)
  if (!meta) return el
  const m = { ...meta }
  if (html?.trim()) m.html = html
  else delete m.html
  return setSemantic(el, m)
}

/**
 * Apply style fields back onto the Excalidraw element so the canvas is WYSIWYG.
 * IMPORTANT: only touches fields the user explicitly set (props has the key);
 * never overrides the shape's original look when a prop is unset.
 */
export function applyStyle(el: ExcalidrawElement, meta: SemanticMeta): ExcalidrawElement {
  const p = meta.props || {}
  const next = { ...el } as any
  const t = meta.type
  const has = (k: string) => p[k] !== undefined

  if (t === 'container' || t === 'section' || t === 'card' || t === 'nav' ||
      t === 'button' || t === 'input') {
    if (has('bg')) next.backgroundColor = p.bg
    if (t === 'button' && has('color')) next.strokeColor = p.color
    else if (t === 'input') {
      if (has('border')) next.strokeColor = p.border
    }
    if (has('radius')) {
      next.roundness = {
        type: 'proportional' as const,
        value: Math.min(1, (p.radius || 0) / 60),
      }
    }
  } else if (t === 'heading' || t === 'text' || t === 'link') {
    if (has('content')) next.text = p.content
    if (has('label') && t === 'link') next.text = p.label
    if (has('fontSize')) next.fontSize = p.fontSize
    if (has('color')) next.strokeColor = p.color
    if (t === 'heading' && has('fontWeight')) next.fontFamily = p.fontWeight >= 600 ? 2 : 1
    else if (t === 'text' && has('bold')) next.fontFamily = p.bold ? 2 : 1
  } else if (t === 'note') {
    if (has('content')) next.text = p.content
    if (has('color')) {
      next.strokeColor = p.color
      next.backgroundColor = '#FAEEDA'
    }
  }
  // raw / image: never touch visuals — the user's drawing stays as drawn

  return next as ExcalidrawElement
}

// ── Serialization ──

/**
 * Serialize the current scene into a blueprint tree (v2).
 * - Frames (画框) become top-level `section` nodes; elements inside them
 *   (frameId match) become their children. A frame maps to <section> in HTML.
 * - Semantically-tagged elements outside frames become top-level roots.
 * - Parent/child relations come from containerBinding (containerId).
 * Pass { frameId } to export only the elements inside that frame (画框圈选).
 */
export interface BlueprintOptions {
  frameId?: string
  /** 压缩图片的最长边像素（默认 256）。 */
  maxDim?: number
  /** 压缩质量 0–1（默认 0.8）。 */
  quality?: number
  /** 图片导出方式：true=用文件名引用（不嵌 base64），false=嵌入 dataURL（默认）。 */
  imageAsFile?: boolean
}

/** MIME → 文件扩展名（imageAsFile 模式生成文件名用）。 */
function mimeToExt(mime?: string): string {
  switch (mime) {
    case 'image/jpeg': case 'image/jpg': return '.jpg'
    case 'image/webp': return '.webp'
    case 'image/svg+xml': return '.svg'
    case 'image/gif': return '.gif'
    default: return '.png'
  }
}

/** 把 alt/名称清理成安全文件名。 */
function sanitizeFilename(s: string): string {
  const cleaned = s.replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '')
  return cleaned || 'image'
}

export function toBlueprint(
  api: ExcalidrawImperativeAPI,
  opts?: BlueprintOptions
): Blueprint | null {
  const all = api.getSceneElements()
  let elements = all
  // Auto-number images when exporting filenames (imageAsFile mode).
  let imageCounter = 0

  if (opts?.frameId) {
    const frame = all.find((e) => e.id === opts.frameId) as any
    if (!frame) return null
    elements = all.filter(
      (e) => e.id === opts.frameId || (e as any).frameId === opts.frameId
    )
  }

  const build = (el: ExcalidrawElement): BlueprintElement => {
    const meta = getSemantic(el)
    const isFrame = el.type === 'frame'
    const isImage = el.type === 'image'
    const zIndex = all.findIndex((x) => x.id === el.id)
    // Untagged images still export (as `image`) so their data isn't silently lost —
    // untagged rectangles fall back to container, untagged text to text.
    const type: SemanticType = isFrame
      ? 'section'
      : meta?.type || (isImage ? 'image' : el.type === 'text' ? 'text' : 'container')
    // 克隆 props,避免把 base64 等导出产物写回画布元素自身
    const props: Record<string, any> = isFrame
      ? { label: frameLabel((el as any).name), ...(meta?.props || {}) }
      : { ...(meta?.props || {}) }
    if (isImage) {
      if (opts?.imageAsFile) {
        // Filename reference (no base64): user supplies the image file separately.
        // Priority: props.fileName (面板「文件名」) > element alt > auto-number.
        const fd = (el as any).fileId ? api.getFiles()?.[(el as any).fileId] : undefined
        const ext = mimeToExt(fd?.mimeType)
        const base = props.fileName || props.alt || (el as any).alt || ''
        if (base) {
          const clean = sanitizeFilename(base)
          // 若已带扩展名（如 "111.png"）直接用，否则补上真实扩展名。
          props.src = /\.[a-zA-Z0-9]{2,5}$/.test(clean) ? clean : clean + ext
        } else {
          imageCounter++
          props.src = `image-${imageCounter}${ext}`
        }
        delete props.imageDataURL
      } else if ((el as any).fileId) {
        // Embed the bitmap so the JSON carries the picture (for multimodal AI).
        // 直接把 base64 写进 props.src:网页 AI 只需把 src 复制到 <img src>,
        // 即可得到自包含 HTML,无需任何本地图片文件。
        const fd = api.getFiles()?.[(el as any).fileId]
        if (fd?.dataURL) {
          props.src = fd.dataURL
          props.imageDataURL = fd.dataURL
        }
        if (!props.alt && (el as any).alt) props.alt = (el as any).alt
      }
    }
    const out: BlueprintElement = {
      type,
      x: Math.round(el.x),
      y: Math.round(el.y),
      w: Math.round(el.width || 0),
      h: Math.round(el.height || 0),
      angle: el.angle,
      layout: meta?.layout || DEFAULT_LAYOUT,
      zIndex,
      props,
      children: isFrame
        ? elements
            .filter((c) => (c as any).frameId === el.id && !(c as any).containerId && (getSemantic(c) || c.type === 'image'))
            .map(build)
        : elements
            .filter((c) => (c as any).containerId === el.id && (getSemantic(c) || c.type === 'image'))
            .map(build),
    }
    if (meta?.style)  out.style  = meta.style
    if (meta?.events && Object.keys(meta.events).length) out.events = meta.events
    if (meta?.html)   out.html   = meta.html
    return out
  }

  const roots = elements.filter((el) => {
    if (el.type === 'frame') return true
    return (
      (getSemantic(el) || el.type === 'image') &&
      !(el as any).containerId &&
      !(el as any).frameId
    )
  })
  if (roots.length === 0) return null

  return {
    elements: roots.map(build),
  }
}

/** Download any object as a JSON file. */
export function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Image compression for AI-friendly JSON export ──

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Image load failed'))
    img.src = src
  })
}

/**
 * Downscale + lossy-recompress an image data URL so exported blueprint JSON
 * stays small enough for a web AI to read quickly. Falls back to the original
 * on any error. Prefers WebP (small, keeps transparency), else JPEG.
 */
export async function compressImageDataURL(
  dataURL: string,
  maxDim = 256,
  quality = 0.8,
): Promise<string> {
  try {
    const img = await loadImage(dataURL)
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
    const w = Math.max(1, Math.round(img.width * scale))
    const h = Math.max(1, Math.round(img.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return dataURL
    // White backdrop so transparent PNGs don't turn black in JPEG.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)
    let out = canvas.toDataURL('image/webp', quality)
    if (!out.startsWith('data:image/webp')) out = canvas.toDataURL('image/jpeg', quality)
    return out
  } catch {
    return dataURL
  }
}

async function compressBlueprintImages(bp: Blueprint, maxDim: number, quality: number): Promise<void> {
  const walk = async (e: BlueprintElement): Promise<void> => {
    if (e.props?.imageDataURL) {
      const compressed = await compressImageDataURL(e.props.imageDataURL, maxDim, quality)
      e.props.imageDataURL = compressed
      // src 与 imageDataURL 同源(base64 嵌数据模式),一并更新为压缩版
      if (typeof e.props.src === 'string' && e.props.src.startsWith('data:image')) {
        e.props.src = compressed
      }
    }
    for (const c of e.children || []) await walk(c)
  }
  for (const root of bp.elements) await walk(root)
}

/**
 * Async variant of toBlueprint that also downscales/compresses embedded images.
 * Use this for any export that feeds a web AI (the raw base64 is otherwise huge).
 */
export async function toBlueprintAsync(
  api: ExcalidrawImperativeAPI,
  opts?: BlueprintOptions,
): Promise<Blueprint | null> {
  const bp = toBlueprint(api, opts)
  if (!bp) return null
  const maxDim = opts?.maxDim ?? 256
  const quality = opts?.quality ?? 0.8
  await compressBlueprintImages(bp, maxDim, quality)
  return bp
}

// ── Blueprint → self-contained HTML (no AI needed) ──
//
// Renders the blueprint tree into a single-file HTML where images are
// inlined as base64 data URLs. Opening the file in a browser shows the
// layout with zero external dependencies — no local image files required.

const SHADOW_CSS: Record<string, string> = {
  none: 'none',
  sm: '0 1px 2px rgba(0,0,0,0.08)',
  md: '0 4px 12px rgba(0,0,0,0.12)',
  lg: '0 8px 24px rgba(0,0,0,0.16)',
  xl: '0 16px 48px rgba(0,0,0,0.22)',
}

function esc(s: string | undefined): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Serialize inline CSS from a BlueprintElement's props + free style. */
function elementCss(e: BlueprintElement): string {
  const p = e.props || {}
  const css: string[] = []
  const pos = e.layout === 'free'
    ? `position:absolute;left:${e.x}px;top:${e.y}px;`
    : ''
  css.push(pos + `width:${e.w}px;height:${e.h}px;z-index:${e.zIndex ?? 0};`)
  if (e.angle) css.push(`transform:rotate(${e.angle}rad);`)

  const box = ['container', 'section', 'card', 'nav', 'button', 'input', 'raw', 'note']
  if (box.includes(e.type)) {
    if (p.bg) css.push(`background-color:${p.bg};`)
    if (p.radius != null) css.push(`border-radius:${p.radius}px;`)
    if (p.padding != null) css.push(`padding:${p.padding}px;`)
    if (p.border) css.push(`border:1px solid ${p.border};`)
    if (p.shadow) css.push(`box-shadow:${SHADOW_CSS[p.shadow] || 'none'};`)
    if (p.color) css.push(`color:${p.color};`)
  }
  if (e.type === 'image' && p.fit) css.push(`object-fit:${p.fit};`)
  if (['heading', 'text', 'link', 'button', 'input'].includes(e.type)) {
    if (p.fontSize != null) css.push(`font-size:${p.fontSize}px;`)
    if (p.fontWeight != null) css.push(`font-weight:${p.fontWeight};`)
    if (p.color) css.push(`color:${p.color};`)
    if (p.align) css.push(`text-align:${p.align};`)
  }
  // User-provided free CSS overrides everything else.
  if (e.style) css.push(e.style)
  return css.join('')
}

function elementHtml(e: BlueprintElement): string {
  const p = e.props || {}
  const css = elementCss(e)
  const id = e.type === 'image' ? 'img' : 'div'
  const children = (e.children || []).map(elementHtml).join('\n')
  const styleAttr = css ? ` style="${esc(css)}"` : ''

  switch (e.type) {
    case 'section':
      return `<section${styleAttr}>${children}</section>`
    case 'heading': {
      const lv = Math.min(6, Math.max(1, Number(p.level) || 1))
      const tag = `h${lv}`
      return `<${tag}${styleAttr}>${esc(p.content ?? p.label ?? '')}</${tag}>`
    }
    case 'text':
      return `<p${styleAttr}>${esc(p.content ?? '')}</p>`
    case 'link':
      return `<a${styleAttr} href="${esc(p.href ?? '#')}">${esc(p.label ?? '')}</a>`
    case 'button':
      return `<button${styleAttr}>${esc(p.label ?? '')}</button>`
    case 'input': {
      const type = p.type === 'password' ? 'password' : p.type === 'number' ? 'number' : p.type === 'email' ? 'email' : 'text'
      return `<input${styleAttr} type="${type}" placeholder="${esc(p.placeholder ?? '')}" />`
    }
    case 'image': {
      const src = p.src || p.imageDataURL || ''
      return `<img${styleAttr} src="${esc(src)}" alt="${esc(p.alt ?? '')}" />`
    }
    case 'raw':
      return String(p.html ?? '')
    case 'note':
      return '' // notes are design intent only — never rendered
    default:
      return `<div${styleAttr}>${children}</div>`
  }
}

/** Layout rules for children based on the parent's layout hint. */
function layoutCss(e: BlueprintElement): string {
  const p = e.props || {}
  const css = elementCss(e)
  const parts = [css]
  switch (e.layout) {
    case 'row': parts.push('display:flex;flex-direction:row;align-items:center;gap:8px;'); break
    case 'column': parts.push('display:flex;flex-direction:column;gap:8px;'); break
    case 'grid': parts.push('display:grid;grid-template-columns:repeat(auto-fit,minmax(80px,1fr));gap:8px;'); break
    case 'wrap': parts.push('display:flex;flex-wrap:wrap;gap:8px;'); break
    default: break // free: absolute positioning from x/y
  }
  if (p.align) parts.push(`text-align:${p.align};`)
  return parts.join('')
}

function buildNode(e: BlueprintElement): string {
  // Non-free containers render their children inside a flex/grid wrapper.
  if (e.layout !== 'free' && (e.type === 'container' || e.type === 'section' || e.type === 'card' || e.type === 'nav' || e.type === 'raw')) {
    const css = layoutCss(e)
    const children = (e.children || []).map(buildNode).join('\n')
    const tag = e.type === 'section' ? 'section' : 'div'
    return `<${tag} style="${esc(css)}">${children}</${tag}>`
  }
  return elementHtml(e)
}

/**
 * Convert a blueprint into a self-contained HTML document.
 * Images are inlined as base64, so the output needs NO external files —
 * open it in any browser and the layout (with pictures) just works.
 */
export function blueprintToHtml(bp: Blueprint): string {
  const body = (bp.elements || []).map(buildNode).join('\n')
  return (
    '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n' +
    '<meta charset="UTF-8" />\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n' +
    '<title>Canvas Export</title>\n' +
    '<style>\n' +
    'body { margin:0; background:#f4f6f9; position:relative; }\n' +
    'html,body { min-height:100%; }\n' +
    '</style>\n</head>\n<body>\n' +
    body +
    '\n</body>\n</html>'
  )
}