import React, { useCallback, useState } from 'react'
import { Excalidraw, THEME } from '@excalidraw/excalidraw'
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
import './Canvas.css'

interface Props {
  onEditorReady: (api: ExcalidrawImperativeAPI) => void
  onCanvasChange?: () => void
  onSelectElement?: (el: ExcalidrawElement | null) => void
  autoTag?: boolean
  theme?: 'light' | 'dark'
  langCode?: string
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

export function Canvas({ onEditorReady, onCanvasChange, onSelectElement, autoTag = true, theme = 'light', langCode = 'zh-CN' }: Props) {
  const [editor, setEditor] = useState<ExcalidrawImperativeAPI | null>(null)
  const [selected, setSelected] = useState<ExcalidrawElement | null>(null)

  const handleReady = useCallback((api: ExcalidrawImperativeAPI) => {
    setEditor(api)
    onEditorReady(api)
  }, [onEditorReady])

  const handleChange = useCallback((
    els: readonly ExcalidrawElement[],
    appState: any
  ) => {
    const ids = appState.selectedElementIds as Record<string, boolean>
    const firstId = Object.keys(ids).find((k) => ids[k])
    const el = firstId ? els.find((e) => e.id === firstId) || null : null
    setSelected(el)
    onSelectElement?.(el)

    // Auto-tag new elements when not currently dragging/resizing.
    if (autoTag && editor && !appState.draggingElement && !appState.resizingElement && !appState.editingElement) {
      // Find elements added since last tick.
      // We approximate by comparing current scene to a cached previous snapshot.
      const cached = (window as any).__vcanvasPrevEls as readonly ExcalidrawElement[] | undefined
      const prevIds = new Set((cached || []).map((e) => e.id))
      const newEls = els.filter((e) => {
        if (prevIds.has(e.id)) return false
        if ((e as any).isDeleted) return false
        if ((e as any).containerId) return false
        if ((e as any).frameId) return false
        if (getSemantic(e)) return false
        return SHAPE_TO_SEMANTIC[e.type] != null
      })

      if (newEls.length > 0) {
        let mutated: readonly ExcalidrawElement[] = els
        for (const ne of newEls) {
          const semanticType = SHAPE_TO_SEMANTIC[ne.type]
          if (!semanticType) continue
          // Tag only — never restyle the user's drawing.
          const meta = { type: semanticType, layout: DEFAULT_LAYOUT, props: {} }
          mutated = mutated.map((x) => (x.id === ne.id ? setSemantic(ne, meta) : x))
        }
        editor.updateScene({ elements: mutated as any })
      }
    }
    // Cache for next tick.
    ;(window as any).__vcanvasPrevEls = els
    onCanvasChange?.()
  }, [onSelectElement, onCanvasChange, autoTag, editor])

  const showPanel = !!selected && !!getSemantic(selected)

  return (
    <div className="canvas-wrapper">
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
      <SemanticRail editor={editor} selected={selected} onChanged={onCanvasChange} />
    </div>
  )
}