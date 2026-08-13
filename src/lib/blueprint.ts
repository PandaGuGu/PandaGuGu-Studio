// Blueprint v2 — semantic element types + serialization (Excalidraw layer).
// A "blueprint" is an open, human-editable JSON description of the canvas
// layout with semantic tags — the input contract for AI generation and
// batch variants.
//
// The framework-free core (types, constants, HTML renderer, prompt builders,
// HTML→blueprint parsing) lives in ./core and is shared with the pgg CLI.
// This module adds the Excalidraw-specific parts: tagging, WYSIWYG style
// sync, and canvas → blueprint serialization.

import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'

// ── Re-export the framework-free core ──
// TS 6.0 note: `export *` re-exports but no longer creates local bindings,
// so the members used in THIS file are imported explicitly below.
import {
  type SemanticType, type LayoutHint, type SemanticMeta,
  type Blueprint, type BlueprintElement,
  SEMANTIC_TYPES, SEMANTIC_GROUPS, LAYOUTS, DEFAULT_LAYOUT,
  DEFAULT_PROPS, SHAPE_OF, HEADING_SIZES,
  frameLabel, mimeToExt, sanitizeFilename,
} from './core/types'
export * from './core/types'
export { blueprintToHtml } from './core/blueprintToHtml'
export { buildBlueprintPrompt, buildWebAIPrompt } from './core/prompt'
export { htmlToBlueprint } from './core/htmlToBlueprint'

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

/** MIME → 文件扩展名、文件名清理 → 见 core/types(双端复用)。 */

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

