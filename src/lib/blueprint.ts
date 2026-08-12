// Semantic element types + blueprint serialization.
// A "blueprint" is an open, human-editable JSON description of the canvas
// layout with semantic tags — the input contract for AI generation and
// batch variants.

import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'

export type SemanticType = 'container' | 'text' | 'button' | 'image'

export interface SemanticMeta {
  type: SemanticType
  props: Record<string, any>
}

export interface BlueprintElement {
  id: string
  type: SemanticType
  x: number
  y: number
  w: number
  h: number
  angle: number
  props: Record<string, any>
  children: BlueprintElement[]
}

export interface Blueprint {
  app: 'pandagugu-studio'
  kind: 'blueprint'
  version: number
  title: string
  theme: 'light' | 'dark'
  note: string
  elements: BlueprintElement[]
}

export const SEMANTIC_TYPES: SemanticType[] = ['container', 'text', 'button', 'image']

export const DEFAULT_PROPS: Record<SemanticType, Record<string, any>> = {
  container: { label: '容器', bg: '#d4d4d8', radius: 12, padding: 16 },
  text: { content: '文本', fontSize: 20, color: '#18181b', bold: false, align: 'left' },
  button: { label: '按钮', bg: '#2563eb', color: '#ffffff', radius: 8 },
  image: { alt: '图片', src: '' },
}

/** Types that Excalidraw shapes map to for each semantic type. */
export const SHAPE_OF: Record<SemanticType, string> = {
  container: 'rectangle',
  text: 'text',
  button: 'rectangle',
  image: 'image',
}

/** Whether an Excalidraw element can carry a semantic tag. */
export function canTag(el: ExcalidrawElement): boolean {
  return (
    el.type === 'rectangle' ||
    el.type === 'text' ||
    el.type === 'image' ||
    el.type === 'ellipse'
  )
}

/** Read the semantic meta attached to an element (via customData). */
export function getSemantic(el: ExcalidrawElement): SemanticMeta | null {
  const cd = (el as any).customData as { semantic?: SemanticMeta } | undefined
  if (cd?.semantic?.type) return cd.semantic
  return null
}

/** Attach (or clear) a semantic tag on a copy of the element. */
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

/** Replace semantic props on a copy of the element (keeps type). */
export function setSemanticProps(
  el: ExcalidrawElement,
  patch: Record<string, any>
): ExcalidrawElement {
  const meta = getSemantic(el)
  if (!meta) return el
  return setSemantic(el, { ...meta, props: { ...meta.props, ...patch } })
}

/** Merge style fields back onto the Excalidraw element so the canvas is WYSIWYG. */
export function applyStyle(el: ExcalidrawElement, meta: SemanticMeta): ExcalidrawElement {
  const p = meta.props
  const next = { ...el } as any

  if (meta.type === 'container' || meta.type === 'button') {
    next.backgroundColor = p.bg ?? el.backgroundColor
    next.strokeColor = meta.type === 'button' ? p.color ?? el.strokeColor : el.strokeColor
    next.roundness =
      typeof p.radius === 'number'
        ? { type: 'proportional' as const, value: Math.min(1, (p.radius || 0) / 60) }
        : el.roundness
    next.strokeWidth = 2
    next.fillStyle = 'solid'
  } else if (meta.type === 'text') {
    next.text = p.content ?? (el as any).text
    next.fontSize = p.fontSize ?? (el as any).fontSize
    next.strokeColor = p.color ?? el.strokeColor
    if (typeof p.bold === 'boolean') next.fontFamily = p.bold ? 2 : 1
  } else if (meta.type === 'image') {
    // nothing to style — alt/src live in props for the blueprint
  }

  return next as ExcalidrawElement
}

/**
 * Serialize the current scene into a blueprint tree.
 * Only semantically-tagged elements are included; parent/child relations come
 * from Excalidraw's containerBinding (containerId).
 */
export function toBlueprint(api: ExcalidrawImperativeAPI): Blueprint | null {
  const elements = api.getSceneElements()
  if (elements.length === 0) return null

  const byId = new Map<string, ExcalidrawElement>()
  for (const el of elements) byId.set(el.id, el)

  const build = (el: ExcalidrawElement): BlueprintElement => {
    const meta = getSemantic(el)
    const children = elements
      .filter((c) => (c as any).containerId === el.id && getSemantic(c))
      .map(build)
    return {
      id: el.id,
      type: meta?.type || 'container',
      x: Math.round(el.x),
      y: Math.round(el.y),
      w: Math.round(el.width || 0),
      h: Math.round(el.height || 0),
      angle: el.angle,
      props: meta?.props || DEFAULT_PROPS.container,
      children,
    }
  }

  const roots = elements.filter(
    (el) => getSemantic(el) && !(el as any).containerId
  )
  if (roots.length === 0) return null

  const firstContainer = roots.find((e) => getSemantic(e)?.type === 'container')
  const title =
    (firstContainer && getSemantic(firstContainer)?.props.label) || 'Untitled'

  const appState: any = api.getAppState()
  return {
    app: 'pandagugu-studio',
    kind: 'blueprint',
    version: 1,
    title: String(title || 'Untitled'),
    theme: appState.theme === 'dark' ? 'dark' : 'light',
    note: 'Coordinates are Excalidraw logical units (1 unit = 1 CSS px at 100% zoom). x/y = top-left corner.',
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
