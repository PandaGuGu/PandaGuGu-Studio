import React, { useEffect, useState, useCallback } from 'react'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { getSemantic } from '../lib/blueprint'
import { useI18n } from '../lib/i18n'
import './LayersPanel.css'

interface Props {
  editor: ExcalidrawImperativeAPI | null
  canvasVersion: number
  selectedElementId: string | null
  onAddFrame: () => void
}

interface Layer {
  id: string
  type: string
  semantic?: string
  label: string
}

const TYPE_ICONS: Record<string, string> = {
  rectangle: '▭', ellipse: '⬭', text: 'T', image: '◫',
  container: '▭', section: '▤', card: '▢', nav: '☰',
  heading: 'H', link: '↗',
  button: '⬭', input: '▭',
  raw: '</>', note: '✎',
  frame: '▣',
}

export function LayersPanel({ editor, canvasVersion, selectedElementId, onAddFrame }: Props) {
  const t = useI18n()
  const [layers, setLayers] = useState<Layer[]>([])

  useEffect(() => {
    if (!editor) return
    const els = editor.getSceneElements()
    const result = els
      .filter((e) => !(e as any).isDeleted)
      .map((e) => {
        const sem = getSemantic(e)
        const semanticType = sem?.type
        const label = sem?.props?.label || semanticType || e.type
        return {
          id: e.id,
          type: e.type,
          semantic: semanticType,
          label: String(label),
        }
      })
      .reverse() // last drawn on top
    setLayers(result)
  }, [editor, canvasVersion])

  const handleSelect = useCallback((id: string) => {
    if (!editor) return
    editor.updateScene({
      appState: { selectedElementIds: { [id]: true } as any },
    })
  }, [editor])

  return (
    <div className="layers-panel">
      <div className="layers-header">
        <span className="layers-title">{t('layers.title')}</span>
        <button
          className="layers-add-btn"
          onClick={onAddFrame}
          title={t('layers.add')}
        >
          +
        </button>
      </div>
      <div className="layers-list">
        {layers.length === 0 && (
          <div className="layers-empty">{t('layers.empty')}</div>
        )}
        {layers.map((layer) => (
          <button
            key={layer.id}
            className={`layer-item ${selectedElementId === layer.id ? 'selected' : ''}`}
            onClick={() => handleSelect(layer.id)}
          >
            <span className="layer-icon">
              {TYPE_ICONS[layer.semantic || layer.type] || '◇'}
            </span>
            <span className="layer-name">{layer.label}</span>
            <span className="layer-type">{layer.semantic || layer.type}</span>
          </button>
        ))}
      </div>
    </div>
  )
}