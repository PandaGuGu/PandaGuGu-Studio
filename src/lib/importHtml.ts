import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { Blueprint, BlueprintElement, SemanticType } from './blueprint'
import { setSemantic, DEFAULT_LAYOUT } from './blueprint'
import { htmlToBlueprint } from './blueprint' // re-exported from core (browser + Node)
// Excalidraw 0.18 orders elements by fractional index (a0, a1, …, az, b0, …).
// Hand-rolled base62 counters produce invalid keys ("0", "a", …) that make
// updateScene throw "invalid order key" — always use the official generator.
import { generateNKeysBetween } from 'fractional-indexing'

/** Pre-generated legal fractional indices, dispensed in scene order. */
interface IndexSeed {
  keys: string[]
  i: number
}

let idCounter = 1
function nextId(): string {
  return `imp-${idCounter++}-${Math.random().toString(36).slice(2, 6)}`
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
