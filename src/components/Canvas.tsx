import React, { useCallback, useState } from 'react'
import { Excalidraw, THEME, Footer } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { SemanticToolbar } from './SemanticToolbar'
import { PropsPanel } from './PropsPanel'
import { getSemantic } from '../lib/blueprint'
import './Canvas.css'

interface Props {
  onEditorReady: (api: ExcalidrawImperativeAPI) => void
  onCanvasChange?: () => void
  theme?: 'light' | 'dark'
  langCode?: string
}

export function Canvas({ onEditorReady, onCanvasChange, theme = 'light', langCode = 'zh-CN' }: Props) {
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
    onCanvasChange?.()
  }, [onCanvasChange])

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
      >
        <Footer>
          <SemanticToolbar editor={editor} selected={selected} onChanged={onCanvasChange} />
        </Footer>
      </Excalidraw>
      {showPanel && (
        <PropsPanel editor={editor} element={selected!} onChanged={onCanvasChange} />
      )}
    </div>
  )
}
