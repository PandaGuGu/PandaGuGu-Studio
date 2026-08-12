import React, { useState } from 'react'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import {
  getSemantic,
  setSemantic,
  setSemanticProps,
  setSemanticLayout,
  setSemanticStyle,
  setSemanticEvents,
  setSemanticHtml,
  applyStyle,
  DEFAULT_PROPS,
  HEADING_SIZES,
  LAYOUTS,
} from '../lib/blueprint'
import type { SemanticType, LayoutHint } from '../lib/blueprint'
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
  const [advanced, setAdvanced] = useState(false)
  if (!meta || !editor) return null

  const type = meta.type as SemanticType
  const props = meta.props || {}
  // Panel shows defaults as placeholder, but only writes to props on edit —
  // so the canvas drawing is never auto-restyled.
  const dflt = (key: string) => (DEFAULT_PROPS[type] || {})[key]

  // Persist any meta change + style sync back to canvas
  const apply = (patch: Partial<Pick<typeof meta, 'props' | 'layout' | 'style' | 'events' | 'html'>>) => {
    let next = element
    if (patch.layout !== undefined) next = setSemanticLayout(next, patch.layout)
    if (patch.style !== undefined) next = setSemanticStyle(next, patch.style)
    if (patch.events !== undefined) next = setSemanticEvents(next, patch.events as any)
    if (patch.html !== undefined) next = setSemanticHtml(next, patch.html)
    if (patch.props !== undefined) next = setSemanticProps(next, patch.props)
    const m = getSemantic(next)
    if (!m) return
    const styled = applyStyle(next, m)
    const elements = editor
      .getSceneElements()
      .map((el) => (el.id === styled.id ? styled : el))
    editor.updateScene({ elements })
    onChanged?.()
  }

  const onProp = (patch: Record<string, any>) => apply({ props: patch })
  const onLayout = (layout: LayoutHint) => apply({ layout })

  const num = (key: string, min: number, max: number) => (
    <input
      type="number"
      className="pp-input p"
      value={Number(props[key] ?? dflt(key)) || 0}
      min={min}
      max={max}
      onChange={(e) => onProp({ [key]: Number(e.target.value) })}
    />
  )
  const color = (key: string) => (
    <input
      type="color"
      className="pp-input p-color"
      value={String(props[key] ?? dflt(key) ?? '#888888')}
      onChange={(e) => onProp({ [key]: e.target.value })}
    />
  )
  const text = (key: string, placeholder = '') => (
    <input
      type="text"
      className="pp-input"
      value={String(props[key] ?? '')}
      placeholder={placeholder || String(dflt(key) ?? '')}
      onChange={(e) => onProp({ [key]: e.target.value })}
    />
  )
  const area = (key: string, rows = 2, placeholder = '') => (
    <textarea
      className="pp-input p-area"
      value={String(props[key] ?? '')}
      rows={rows}
      placeholder={placeholder || String(dflt(key) ?? '')}
      onChange={(e) => onProp({ [key]: e.target.value })}
    />
  )
  const select = <T extends string | number>(key: string, opts: { v: T; label: string }[]) => (
    <select
      className="pp-input p-select"
      value={String(props[key] ?? dflt(key) ?? '')}
      onChange={(e) => {
        const v = e.target.value
        const matched = opts.find((o) => String(o.v) === v)
        onProp({ [key]: matched ? matched.v : v })
      }}
    >
      {opts.map((o) => (
        <option key={String(o.v)} value={String(o.v)}>{o.label}</option>
      ))}
    </select>
  )

  const onHeadingLevel = (level: number) => {
    apply({
      props: { level: Number(level), fontSize: HEADING_SIZES[level] || 36 },
    })
  }

  const onEventsEdit = (raw: string) => {
    try {
      const obj = raw.trim() ? JSON.parse(raw) : null
      apply({ events: obj })
    } catch {
      // keep typing — don't apply broken JSON
    }
  }
  const eventsStr = meta.events ? JSON.stringify(meta.events, null, 2) : ''

  return (
    <div className="props-panel">
      <div className="props-panel-head">
        <span className="props-panel-title">{t(`semantic.${type}`)}</span>
        <span className="props-panel-hint">{t('semantic.propsHint')}</span>
      </div>

      <div className="props-panel-body">
        <label className="pp-row"><span>{t('semantic.layout')}</span>
          <select
            className="pp-input p-select"
            value={meta.layout}
            onChange={(e) => onLayout(e.target.value as LayoutHint)}
          >
            {LAYOUTS.map((l) => (
              <option key={l} value={l}>{t(`semantic.layout${l[0].toUpperCase()}${l.slice(1)}`)}</option>
            ))}
          </select>
        </label>

        <div className="pp-divider" />

        {type === 'container' && (
          <>
            <label className="pp-row"><span>{t('props.label')}</span>{text('label')}</label>
            <label className="pp-row"><span>{t('props.bg')}</span>{color('bg')}</label>
            <label className="pp-row"><span>{t('props.radius')}</span>{num('radius', 0, 24)}</label>
            <label className="pp-row"><span>{t('props.padding')}</span>{num('padding', 0, 64)}</label>
          </>
        )}
        {type === 'section' && (
          <>
            <label className="pp-row"><span>{t('props.label')}</span>{text('label')}</label>
            <label className="pp-row"><span>{t('props.bg')}</span>{color('bg')}</label>
            <label className="pp-row"><span>{t('props.radius')}</span>{num('radius', 0, 24)}</label>
            <label className="pp-row"><span>{t('props.padding')}</span>{num('padding', 0, 64)}</label>
            <label className="pp-row"><span>{t('props.border')}</span>{color('border')}</label>
          </>
        )}
        {type === 'card' && (
          <>
            <label className="pp-row"><span>{t('props.label')}</span>{text('label')}</label>
            <label className="pp-row"><span>{t('props.bg')}</span>{color('bg')}</label>
            <label className="pp-row"><span>{t('props.radius')}</span>{num('radius', 0, 24)}</label>
            <label className="pp-row"><span>{t('props.padding')}</span>{num('padding', 0, 64)}</label>
            <label className="pp-row"><span>{t('props.shadow')}</span>
              {select('shadow', [
                { v: 'none', label: 'none' },
                { v: 'sm',  label: 'sm' },
                { v: 'md',  label: 'md' },
                { v: 'lg',  label: 'lg' },
                { v: 'xl',  label: 'xl' },
              ])}
            </label>
          </>
        )}
        {type === 'nav' && (
          <>
            <label className="pp-row"><span>{t('props.label')}</span>{text('label')}</label>
            <label className="pp-row"><span>{t('props.bg')}</span>{color('bg')}</label>
            <label className="pp-row"><span>{t('props.padding')}</span>{num('padding', 0, 64)}</label>
            <label className="pp-row"><span>{t('props.align')}</span>
              {select('align', [
                { v: 'left',   label: t('props.alignLeft') },
                { v: 'center', label: t('props.alignCenter') },
                { v: 'right',  label: t('props.alignRight') },
              ])}
            </label>
          </>
        )}
        {type === 'heading' && (
          <>
            <label className="pp-row pp-col"><span>{t('props.content')}</span>{area('content')}</label>
            <label className="pp-row"><span>{t('props.level')}</span>
              <select
                className="pp-input p-select"
                value={String(props.level || 1)}
                onChange={(e) => onHeadingLevel(Number(e.target.value))}
              >
                {[1,2,3,4,5,6].map((n) => (
                  <option key={n} value={n}>H{n}</option>
                ))}
              </select>
            </label>
            <label className="pp-row"><span>{t('props.fontSize')}</span>{num('fontSize', 12, 96)}</label>
            <label className="pp-row"><span>{t('props.color')}</span>{color('color')}</label>
            <label className="pp-row"><span>{t('props.fontWeight')}</span>{num('fontWeight', 100, 900)}</label>
            <label className="pp-row"><span>{t('props.align')}</span>
              {select('align', [
                { v: 'left',   label: t('props.alignLeft') },
                { v: 'center', label: t('props.alignCenter') },
                { v: 'right',  label: t('props.alignRight') },
              ])}
            </label>
          </>
        )}
        {type === 'text' && (
          <>
            <label className="pp-row pp-col"><span>{t('props.content')}</span>{area('content', 3)}</label>
            <label className="pp-row"><span>{t('props.fontSize')}</span>{num('fontSize', 10, 72)}</label>
            <label className="pp-row"><span>{t('props.color')}</span>{color('color')}</label>
            <label className="pp-row pp-row-inline"><span>{t('props.bold')}</span>
              <input type="checkbox" className="pp-check" checked={!!props.bold}
                onChange={(e) => onProp({ bold: e.target.checked })} />
            </label>
            <label className="pp-row"><span>{t('props.align')}</span>
              {select('align', [
                { v: 'left',   label: t('props.alignLeft') },
                { v: 'center', label: t('props.alignCenter') },
                { v: 'right',  label: t('props.alignRight') },
              ])}
            </label>
          </>
        )}
        {type === 'link' && (
          <>
            <label className="pp-row"><span>{t('props.label')}</span>{text('label')}</label>
            <label className="pp-row pp-col"><span>{t('props.href')}</span>{text('href', 'https://…')}</label>
            <label className="pp-row"><span>{t('props.color')}</span>{color('color')}</label>
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
        {type === 'input' && (
          <>
            <label className="pp-row"><span>{t('props.label')}</span>{text('label')}</label>
            <label className="pp-row"><span>{t('props.placeholder')}</span>{text('placeholder')}</label>
            <label className="pp-row"><span>{t('props.type')}</span>
              {select('type', [
                { v: 'text',     label: 'text' },
                { v: 'email',    label: 'email' },
                { v: 'password', label: 'password' },
                { v: 'number',   label: 'number' },
              ])}
            </label>
            <label className="pp-row"><span>{t('props.bg')}</span>{color('bg')}</label>
            <label className="pp-row"><span>{t('props.border')}</span>{color('border')}</label>
          </>
        )}
        {type === 'image' && (
          <>
            <label className="pp-row"><span>{t('props.alt')}</span>{text('alt')}</label>
            <label className="pp-row pp-col"><span>{t('props.src')}</span>{text('src', 'https://…')}</label>
            <label className="pp-row"><span>{t('props.fit')}</span>
              {select('fit', [
                { v: 'cover',   label: 'cover' },
                { v: 'contain', label: 'contain' },
                { v: 'fill',    label: 'fill' },
                { v: 'none',    label: 'none' },
              ])}
            </label>
          </>
        )}
        {type === 'raw' && (
          <>
            <label className="pp-row pp-col"><span>{t('props.html')}</span>
              <textarea
                className="pp-input p-area p-area-lg"
                value={String(props.html || '')}
                rows={6}
                spellCheck={false}
                onChange={(e) => onProp({ html: e.target.value })}
              />
            </label>
          </>
        )}
        {type === 'note' && (
          <>
            <label className="pp-row pp-col"><span>{t('props.content')}</span>{area('content', 4)}</label>
            <label className="pp-row"><span>{t('props.color')}</span>{color('color')}</label>
          </>
        )}

        <div className="pp-divider" />

        <button
          className="pp-advanced-toggle"
          onClick={() => setAdvanced((v) => !v)}
        >
          {advanced ? '▾' : '▸'} {t('semantic.advanced')}
        </button>
        {advanced && (
          <div className="pp-advanced">
            <label className="pp-row pp-col"><span>{t('semantic.style')}</span>
              <textarea
                className="pp-input p-area"
                value={meta.style || ''}
                rows={3}
                spellCheck={false}
                placeholder={t('semantic.stylePlaceholder')}
                onChange={(e) => apply({ style: e.target.value })}
              />
            </label>
            <label className="pp-row pp-col"><span>{t('semantic.events')}</span>
              <textarea
                className="pp-input p-area"
                value={eventsStr}
                rows={3}
                spellCheck={false}
                placeholder='{ "onClick": "open-menu" }'
                onChange={(e) => onEventsEdit(e.target.value)}
              />
            </label>
            {type === 'raw' && (
              <div className="pp-hint">{t('semantic.htmlHint')}</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}