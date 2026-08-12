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
  id: string
  type: SemanticType
  x: number
  y: number
  w: number
  h: number
  angle: number
  layout: LayoutHint
  props: Record<string, any>
  style?: string
  events?: Record<string, string>
  html?: string
  children: BlueprintElement[]
}

export interface Blueprint {
  app: 'pandagugu-studio'
  kind: 'blueprint'
  version: 2
  title: string
  theme: 'light' | 'dark'
  note: string
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

  image:     { alt: '图片', src: '', fit: 'cover' },

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
export function toBlueprint(
  api: ExcalidrawImperativeAPI,
  opts?: { frameId?: string }
): Blueprint | null {
  const all = api.getSceneElements()
  let elements = all
  let titleHint: string | null = null

  if (opts?.frameId) {
    const frame = all.find((e) => e.id === opts.frameId) as any
    if (!frame) return null
    titleHint = frame.name || null
    elements = all.filter(
      (e) => e.id === opts.frameId || (e as any).frameId === opts.frameId
    )
  }

  const build = (el: ExcalidrawElement): BlueprintElement => {
    const meta = getSemantic(el)
    const isFrame = el.type === 'frame'
    const out: BlueprintElement = {
      id: el.id,
      type: (isFrame ? 'section' : meta?.type || 'container') as SemanticType,
      x: Math.round(el.x),
      y: Math.round(el.y),
      w: Math.round(el.width || 0),
      h: Math.round(el.height || 0),
      angle: el.angle,
      layout: meta?.layout || DEFAULT_LAYOUT,
      props: isFrame
        ? { label: (el as any).name || 'Section', ...(meta?.props || {}) }
        : meta?.props || {},
      children: isFrame
        ? elements
            .filter((c) => (c as any).frameId === el.id && getSemantic(c))
            .map(build)
        : elements
            .filter((c) => (c as any).containerId === el.id && getSemantic(c))
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
      getSemantic(el) &&
      !(el as any).containerId &&
      !(el as any).frameId
    )
  })
  if (roots.length === 0) return null

  const firstFrame = roots.find((e) => e.type === 'frame') as any
  const firstContainer = roots.find((e) => getSemantic(e)?.type === 'container')
  const title =
    titleHint ||
    (firstFrame && firstFrame.name) ||
    ((firstContainer && getSemantic(firstContainer)?.props.label) || 'Untitled')

  const appState: any = api.getAppState()
  return {
    app: 'pandagugu-studio',
    kind: 'blueprint',
    version: 2,
    title: String(title || 'Untitled'),
    theme: appState.theme === 'dark' ? 'dark' : 'light',
    note: 'Frames map to <section>. Coordinates are Excalidraw logical units (1 unit = 1 CSS px at 100% zoom). x/y = top-left corner. layout hints: free|row|column|grid|wrap — AI decides flex/grid vs absolute.',
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