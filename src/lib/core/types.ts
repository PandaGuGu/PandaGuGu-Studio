// Blueprint v2 core — semantic types, constants, and pure helpers.
// This module is framework- and DOM-free: usable from the browser (React app)
// AND from Node (pgg CLI / server) without any build tricks.
//
// The Excalidraw-specific parts (tagging, canvas serialization) live in
// src/lib/blueprint.ts and re-export everything from here.

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

// ── Pure helpers ──

/** Strip the default "Frame N" name down to just the number: "Frame 1" -> "1". Custom names pass through. */
export function frameLabel(name: string | undefined): string {
  const n = (name || '').trim()
  if (!n) return 'Section'
  const m = n.match(/^Frame\s*(\d+)$/i)
  return m ? m[1] : n
}

/** MIME → 文件扩展名（imageAsFile 模式生成文件名用）。 */
export function mimeToExt(mime?: string): string {
  switch (mime) {
    case 'image/jpeg': case 'image/jpg': return '.jpg'
    case 'image/webp': return '.webp'
    case 'image/svg+xml': return '.svg'
    case 'image/gif': return '.gif'
    default: return '.png'
  }
}

/** 把 alt/名称清理成安全文件名。 */
export function sanitizeFilename(s: string): string {
  const cleaned = s.replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '')
  return cleaned || 'image'
}
