import React, { useCallback } from 'react'
import { Excalidraw, THEME } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import './Canvas.css'

interface Props {
  onEditorReady: (api: ExcalidrawImperativeAPI) => void
  onCanvasChange?: () => void
  theme?: 'light' | 'dark'
  langCode?: string
}

export function Canvas({ onEditorReady, onCanvasChange, theme = 'light', langCode = 'zh-CN' }: Props) {
  return (
    <div className="canvas-wrapper">
      <Excalidraw
        excalidrawAPI={onEditorReady}
        onChange={onCanvasChange}
        theme={theme === 'light' ? THEME.LIGHT : THEME.DARK}
        langCode={langCode}
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
    </div>
  )
}
