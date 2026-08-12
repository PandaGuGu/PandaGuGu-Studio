import React from 'react'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { getSemantic, setSemanticProps, applyStyle } from '../lib/blueprint'
import type { SemanticType } from '../lib/blueprint'
import { useI18n } from '../lib/i18n'
import './PropsPanel.css'

interface Props {
  editor: ExcalidrawImperativeAPI | null
  element: ExcalidrawElement
  onChanged?: () => void
}

export function PropsPanel({ editor, element, onChanged }: Props) {
  const t = useI18n()
  const meta = getSemantic(element)
  if (!meta || !editor) return null

  const type = meta.type as SemanticType
  const props = meta.props || {}

  const update = (patch: Record<string, any>) => {
    const next = setSemanticProps(element, patch)
    const nextMeta = getSemantic(next)
    if (!nextMeta) return
    const styled = applyStyle(next, nextMeta)
    const elements = editor
      .getSceneElements()
      .map((el) => (el.id === styled.id ? styled : el))
    editor.updateScene({ elements })
    onChanged?.()
  }

  const num = (key: string, min: number, max: number) => (
    <input
      type="number"
      className="pp-input pp-num"
      value={Number(props[key]) || 0}
      min={min}
      max={max}
      onChange={(e) => update({ [key]: Number(e.target.value) })}
    />
  )

  const color = (key: string) => (
    <input
      type="color"
      className="pp-input pp-color"
      value={String(props[key] || '#888888')}
      onChange={(e) => update({ [key]: e.target.value })}
    />
  )

  const text = (key: string, placeholder = '') => (
    <input
      type="text"
      className="pp-input"
      value={String(props[key] || '')}
      placeholder={placeholder}
      onChange={(e) => update({ [key]: e.target.value })}
    />
  )

  return (
    <div className="props-panel">
      <div className="props-panel-head">
        <span className="props-panel-title">{t(`semantic.${type}`)}</span>
        <span className="props-panel-hint">{t('semantic.propsHint')}</span>
      </div>
      <div className="props-panel-body">
        {type === 'container' && (
          <>
            <label className="pp-row"><span>{t('props.label')}</span>{text('label')}</label>
            <label className="pp-row"><span>{t('props.bg')}</span>{color('bg')}</label>
            <label className="pp-row"><span>{t('props.radius')}</span>{num('radius', 0, 24)}</label>
            <label className="pp-row"><span>{t('props.padding')}</span>{num('padding', 0, 32)}</label>
          </>
        )}
        {type === 'text' && (
          <>
            <label className="pp-row pp-col"><span>{t('props.content')}</span>
              <textarea
                className="pp-input pp-area"
                value={String(props.content || '')}
                rows={2}
                onChange={(e) => update({ content: e.target.value })}
              />
            </label>
            <label className="pp-row"><span>{t('props.fontSize')}</span>{num('fontSize', 12, 72)}</label>
            <label className="pp-row"><span>{t('props.color')}</span>{color('color')}</label>
            <label className="pp-row pp-row-inline"><span>{t('props.bold')}</span>
              <input
                type="checkbox"
                className="pp-check"
                checked={!!props.bold}
                onChange={(e) => update({ bold: e.target.checked })}
              />
            </label>
            <label className="pp-row"><span>{t('props.align')}</span>
              <select
                className="pp-input pp-select"
                value={String(props.align || 'left')}
                onChange={(e) => update({ align: e.target.value })}
              >
                <option value="left">{t('props.alignLeft')}</option>
                <option value="center">{t('props.alignCenter')}</option>
                <option value="right">{t('props.alignRight')}</option>
              </select>
            </label>
          </>
        )}
        {type === 'button' && (
          <>
            <label className="pp-row"><span>{t('props.label')}</span>{text('label')}</label>
            <label className="pp-row"><span>{t('props.bg')}</span>{color('bg')}</label>
            <label className="pp-row"><span>{t('props.color')}</span>{color('color')}</label>
            <label className="pp-row"><span>{t('props.radius')}</span>{num('radius', 0, 24)}</label>
          </>
        )}
        {type === 'image' && (
          <>
            <label className="pp-row"><span>{t('props.alt')}</span>{text('alt')}</label>
            <label className="pp-row pp-col"><span>{t('props.src')}</span>{text('src', 'https://…')}</label>
          </>
        )}
      </div>
    </div>
  )
}
