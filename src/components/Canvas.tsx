import React, { useCallback, useState, useRef, useEffect } from 'react'
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

export function Canvas({ onEditorReady, onCanvasChange, onSelectElement, autoTag = true, onAutoTagChange, theme = 'light', langCode = 'zh-CN' }: Props) {
  const t = useI18n()
  const [editor, setEditor] = useState<ExcalidrawImperativeAPI | null>(null)
  const [selected, setSelected] = useState<ExcalidrawElement | null>(null)
  const autoTagTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
          ((window as any).__vcanvasPrevEls as readonly ExcalidrawElement[] | undefined || [])
            .map((e) => e.id)
        )
        const targets = current.filter((e) => {
          if (prevIds.has(e.id)) return false
          if ((e as any).isDeleted) return false
          if ((e as any).containerId) return false
          if ((e as any).frameId) return false
          if (getSemantic(e)) return false
          return SHAPE_TO_SEMANTIC[e.type] != null
        })
        if (targets.length === 0) return

        // Keep every other element's original reference — only tag targets.
        const byId = new Map(targets.map((t) => [t.id, t]))
        const mutated = current.map((x) => {
          const t = byId.get(x.id)
          if (!t) return x
          const st = SHAPE_TO_SEMANTIC[t.type]
          if (!st) return x
          return setSemantic(t, { type: st, layout: DEFAULT_LAYOUT, props: {} })
        })
        editor.updateScene({ elements: mutated as any })
      }, 250)
    }
    // Cache snapshot for the NEXT diff.
    ;(window as any).__vcanvasPrevEls = els
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
      <button
        className={`canvas-auto-tag ${autoTag ? 'on' : ''}`}
        onClick={() => onAutoTagChange?.(!autoTag)}
        title={t('semantic.autoTag')}
      >
        <span className="canvas-auto-tag-icon">⚡</span>
        {t('semantic.autoTag')}
      </button>
      <SemanticRail editor={editor} selected={selected} onChanged={onCanvasChange} />
    </div>
  )
}