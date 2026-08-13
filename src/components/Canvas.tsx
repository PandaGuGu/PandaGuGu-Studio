import { useCallback, useState, useRef, useEffect } from 'react'
import { Excalidraw, THEME, viewportCoordsToSceneCoords } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { SemanticRail } from './SemanticRail'
import { PropsPanel } from './PropsPanel'
import {
  getSemantic,
  setSemantic,
  DEFAULT_LAYOUT,
} from '../lib/blueprint'
import type { SemanticType } from '../lib/blueprint'
import { useI18n } from '../lib/i18n'
import './Canvas.css'

interface Props {
  onEditorReady: (api: ExcalidrawImperativeAPI) => void
  onCanvasChange?: () => void
  onSelectElement?: (el: ExcalidrawElement | null) => void
  autoTag?: boolean
  onAutoTagChange?: (v: boolean) => void
  theme?: 'light' | 'dark'
  langCode?: string
  onImportHtml?: () => void
  onOpenTemplates?: () => void
}

/** Map Excalidraw shape type → semantic type for auto-tagging. */
const SHAPE_TO_SEMANTIC: Record<string, SemanticType | null> = {
  rectangle: 'container',
  ellipse: 'button',
  text: 'text',
  image: 'image',
  diamond: 'button',
  arrow: null,
  line: null,
  freedraw: null,
  frame: null,
}

/** Map semantic type → Excalidraw drawing tool (drag-to-create). */
const TOOL_OF: Record<SemanticType, string> = {
  container: 'rectangle', section: 'rectangle', card: 'rectangle', nav: 'rectangle',
  heading: 'text', text: 'text', link: 'text',
  button: 'rectangle', input: 'rectangle',
  image: 'image',
  raw: 'rectangle', note: 'rectangle',
}

export function Canvas({ onEditorReady, onCanvasChange, onSelectElement, autoTag = true, onAutoTagChange, theme = 'light', langCode = 'zh-CN', onImportHtml, onOpenTemplates }: Props) {
  const t = useI18n()
  const [editor, setEditor] = useState<ExcalidrawImperativeAPI | null>(null)
  const [selected, setSelected] = useState<ExcalidrawElement | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const autoTagTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingTagRef = useRef<SemanticType | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Ctrl/⌘ + click → toggle element in the multi-selection.
  useEffect(() => {
    if (!editor) return
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const handleClick = (e: MouseEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      const rect = wrapper.getBoundingClientRect()
      const appState: any = editor.getAppState()
      const scenePt = viewportCoordsToSceneCoords(
        { clientX: e.clientX - rect.left, clientY: e.clientY - rect.top },
        {
          zoom: appState.zoom,
          offsetLeft: appState.offsetLeft,
          offsetTop: appState.offsetTop,
          scrollX: appState.scrollX,
          scrollY: appState.scrollY,
        }
      )
      const hit = editor
        .getSceneElements()
        .filter((el) => !(el as any).isDeleted)
        .find((el) => {
          const w = el.width
          const h = el.height
          if (w == null || h == null) return false
          const pad = 4
          return (
            scenePt.x >= el.x - pad &&
            scenePt.x <= el.x + w + pad &&
            scenePt.y >= el.y - pad &&
            scenePt.y <= el.y + h + pad
          )
        })
      if (!hit) return
      e.preventDefault()
      const current = { ...editor.getAppState().selectedElementIds }
      if (current[hit.id]) delete current[hit.id]
      else current[hit.id] = true
      editor.updateScene({ appState: { selectedElementIds: current } as any })
    }
    wrapper.addEventListener('click', handleClick)
    return () => wrapper.removeEventListener('click', handleClick)
  }, [editor])

  const handleReady = useCallback((api: ExcalidrawImperativeAPI) => {
    setEditor(api)
    onEditorReady(api)
  }, [onEditorReady])

  /** Drag-to-create: pick a semantic type, then draw the matching shape. */
  const handleDrawTag = useCallback((type: SemanticType) => {
    if (!editor) return
    const tool = TOOL_OF[type]
    try {
      ;(editor as any).setActiveTool?.({ type: tool })
    } catch { /* ignore */ }
    pendingTagRef.current = type
  }, [editor])

  const handleChange = useCallback((
    els: readonly ExcalidrawElement[],
    appState: any
  ) => {
    const ids = appState.selectedElementIds as Record<string, boolean>
    const firstId = Object.keys(ids).find((k) => ids[k])
    const el = firstId ? els.find((e) => e.id === firstId) || null : null
    setSelected(el)
    setSelectedIds(new Set(Object.keys(ids).filter((k) => ids[k])))
    onSelectElement?.(el)

    // 选中图片但未打语义标记 → 自动补上 image 标记,
    // 让右侧属性面板(文件名/描述/来源)始终可用,点击即可改名。
    if (el?.type === 'image' && !getSemantic(el) && editor) {
      const tagged = setSemantic(el, { type: 'image', layout: DEFAULT_LAYOUT, props: {} })
      const elements = editor
        .getSceneElements()
        .map((x) => (x.id === tagged.id ? tagged : x))
      editor.updateScene({ elements })
    }

    // Auto-tag NEW elements, but deferred: wait until Excalidraw has fully
    // committed the shape (dragging/resizing done), then re-read the LATEST
    // scene from the editor and only swap the tagged elements. This keeps the
    // user's drawing untouched and never interferes with shape creation.
    if (autoTag && editor && !appState.draggingElement && !appState.resizingElement && !appState.editingElement) {
      if (autoTagTimerRef.current) clearTimeout(autoTagTimerRef.current)
      autoTagTimerRef.current = setTimeout(() => {
        if (!editor) return
        const current = editor.getSceneElements()
        const prevIds = new Set(
          ((window as any).__pggPrevEls as readonly ExcalidrawElement[] | undefined || [])
            .map((e) => e.id)
        )
        const targets = current.filter((e) => {
          if (prevIds.has(e.id)) return false
          if ((e as any).isDeleted) return false
          if ((e as any).containerId) return false
          if ((e as any).frameId) return false
          if (getSemantic(e)) return false
          return SHAPE_TO_SEMANTIC[e.type] != null || e.type === 'frame'
        })
        if (targets.length === 0) return

        // Keep every other element's original reference — only touch targets.
        const isDark = appState.theme === 'dark'
        const byId = new Map(targets.map((t) => [t.id, t]))
        const mutated = current.map((x) => {
          const tgt = byId.get(x.id)
          if (!tgt) return x
          // Frames: translucent white fill so they stand out from the
          // tablecloth grid — never tagged.
          if (tgt.type === 'frame') {
            const cur = (tgt as any).backgroundColor
            if (!cur || cur === 'transparent') {
              return {
                ...tgt,
                backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.8)',
              } as any
            }
            return x
          }
          // Pending type (drag-to-create) wins; else shape→semantic mapping.
          const st = pendingTagRef.current || SHAPE_TO_SEMANTIC[tgt.type]
          if (!st) return x
          return setSemantic(tgt, { type: st, layout: DEFAULT_LAYOUT, props: {} })
        })
        // Only one element is created per drag — consume the pending tag.
        pendingTagRef.current = null
        editor.updateScene({ elements: mutated as any })
      }, 250)
    }
    // Cache snapshot for the NEXT diff.
    ;(window as any).__pggPrevEls = els
    onCanvasChange?.()
  }, [onSelectElement, onCanvasChange, autoTag, editor])

  // Clear pending timer on unmount / autoTag off.
  useEffect(() => {
    if (!autoTag && autoTagTimerRef.current) {
      clearTimeout(autoTagTimerRef.current)
      autoTagTimerRef.current = null
    }
  }, [autoTag])

  useEffect(() => {
    return () => {
      if (autoTagTimerRef.current) clearTimeout(autoTagTimerRef.current)
    }
  }, [])

  const showPanel = !!selected && (selected.type === 'frame' || !!getSemantic(selected))

  return (
    <div className="canvas-wrapper" ref={wrapperRef}>
      <Excalidraw
        excalidrawAPI={handleReady}
        onChange={handleChange}
        theme={theme === 'light' ? THEME.LIGHT : THEME.DARK}
        langCode={langCode}
        initialData={{
          appState: { viewBackgroundColor: 'transparent' as any },
        }}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            export: false,
            saveToActiveFile: false,
            saveAsImage: false,
            clearCanvas: true,
            toggleTheme: false,
            changeViewBackgroundColor: false,
          },
        }}
      />
      {showPanel && (
        <PropsPanel editor={editor} element={selected!} onChanged={onCanvasChange} />
      )}
      <button
        className={`canvas-auto-tag ${autoTag ? 'on' : ''}`}
        onClick={() => onAutoTagChange?.(!autoTag)}
        title={t('semantic.autoTag')}
      >
        <span className="canvas-auto-tag-icon">⚡</span>
        {t('semantic.autoTag')}
      </button>
      <SemanticRail editor={editor} selected={selected} selectedIds={selectedIds} onChanged={onCanvasChange} onDrawTag={handleDrawTag} onImportHtml={onImportHtml} onOpenTemplates={onOpenTemplates} />
    </div>
  )
}