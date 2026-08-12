import React, { useState } from 'react'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import {
  SEMANTIC_GROUPS,
  DEFAULT_LAYOUT,
  canTag,
  setSemantic,
  toBlueprint,
  downloadJSON,
} from '../lib/blueprint'
import { exportAllAsPng } from '../lib/export'
import type { SemanticType, SemanticMeta } from '../lib/blueprint'
import { useI18n } from '../lib/i18n'
import './SemanticRail.css'

interface Props {
  editor: ExcalidrawImperativeAPI | null
  selected: ExcalidrawElement | null
  onChanged?: () => void
  /** No selection → switch Excalidraw tool & tag the next drawn element. */
  onDrawTag?: (type: SemanticType) => void
}

const TYPE_ICONS: Record<SemanticType, string> = {
  container: '▭', section: '▤', card: '▢', nav: '☰',
  heading: 'H', text: 'T', link: '↗',
  button: '⬭', input: '▭',
  image: '◫',
  raw: '</>', note: '✎',
}

export function SemanticRail({ editor, selected, onChanged, onDrawTag }: Props) {
  const t = useI18n()
  const taggable = !!editor && !!selected && canTag(selected!)
  const [menuOpen, setMenuOpen] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [query, setQuery] = useState('')

  const handleTag = (type: SemanticType) => {
    if (!editor) return
    if (selected && canTag(selected)) {
      // Tag the selected element — keep the drawing exactly as-is.
      const meta: SemanticMeta = { type, layout: DEFAULT_LAYOUT, props: {} }
      const tagged = setSemantic(selected, meta)
      const elements = editor
        .getSceneElements()
        .map((el) => (el.id === tagged.id ? tagged : el))
      editor.updateScene({ elements })
      onChanged?.()
    } else {
      // No selection → drag-to-create: switch tool, tag the next drawn shape.
      onDrawTag?.(type)
    }
  }

  const handleClear = () => {
    if (!editor || !selected) return
    const cleared = setSemantic(selected, null)
    const elements = editor
      .getSceneElements()
      .map((el) => (el.id === cleared.id ? cleared : el))
    editor.updateScene({ elements })
    onChanged?.()
  }

  const handleExport = () => {
    if (!editor) return
    const bp = toBlueprint(editor)
    if (!bp) {
      alert(t('semantic.exportEmpty'))
      return
    }
    downloadJSON(bp, `${bp.title.replace(/\s+/g, '-')}.blueprint.json`)
  }

  const handleExportPng = async () => {
    if (!editor) return
    const b64 = await exportAllAsPng(editor)
    if (!b64) return
    const byteChars = atob(b64)
    const bytes = new Uint8Array(byteChars.length)
    for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
    const blob = new Blob([bytes], { type: 'image/png' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vcanvas-${Date.now()}.png`
    a.click()
    URL.revokeObjectURL(url)
    setExportMenuOpen(false)
  }

  const q = query.trim().toLowerCase()
  const allTypes = SEMANTIC_GROUPS.flatMap((g) => g.types)
  const filtered = q
    ? allTypes.filter(
        (type) =>
          type.toLowerCase().includes(q) ||
          t(`semantic.${type}`).toLowerCase().includes(q)
      )
    : allTypes

  return (
    <div className="semantic-rail">
      <button
        className={`semantic-rail-btn semantic-rail-search-btn ${menuOpen ? 'open' : ''}`}
        onClick={() => setMenuOpen((v) => !v)}
        title={t('semantic.search')}
      >
        <span className="semantic-rail-icon">▲</span>
        {t('semantic.search')}
      </button>

      <div className="semantic-rail-divider" />

      {SEMANTIC_GROUPS.map((group, gi) => (
        <React.Fragment key={group.label}>
          {group.types.map((type) => (
            <button
              key={type}
              className={`semantic-rail-btn ${taggable ? 'has-sel' : 'draw-mode'}`}
              disabled={!editor}
              onClick={() => handleTag(type)}
              title={taggable ? t(`semantic.${type}`) : t('semantic.drawHint')}
            >
              <span className="semantic-rail-icon">{TYPE_ICONS[type]}</span>
              {t(`semantic.${type}`)}
            </button>
          ))}
          {gi < SEMANTIC_GROUPS.length - 1 && (
            <div className="semantic-rail-divider" />
          )}
        </React.Fragment>
      ))}

      <div className="semantic-rail-divider" />

      <button
        className="semantic-rail-btn semantic-rail-clear"
        disabled={!taggable}
        onClick={handleClear}
        title={t('semantic.untag')}
      >
        <span className="semantic-rail-icon">✕</span>
      </button>
      <button
        className={`semantic-rail-btn semantic-rail-export ${exportMenuOpen ? 'open' : ''}`}
        onClick={() => setExportMenuOpen((v) => !v)}
        title={t('semantic.exportMenu')}
      >
        <span className="semantic-rail-icon">▲</span>
      </button>

      {exportMenuOpen && (
        <div className="semantic-rail-export-menu">
          <button
            className="semantic-rail-menu-item"
            onClick={() => { handleExport(); setExportMenuOpen(false) }}
          >
            <span className="semantic-rail-icon">📋</span>
            {t('semantic.exportBlueprint')}
          </button>
          <button
            className="semantic-rail-menu-item"
            onClick={handleExportPng}
          >
            <span className="semantic-rail-icon">🖼</span>
            {t('semantic.exportPng')}
          </button>
        </div>
      )}

      {menuOpen && (
        <div className="semantic-rail-menu">
          <input
            className="semantic-rail-search"
            autoFocus
            value={query}
            placeholder={t('semantic.searchPlaceholder')}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="semantic-rail-menu-list">
            {filtered.map((type) => (
              <button
                key={type}
                className="semantic-rail-menu-item"
                disabled={!editor}
                onClick={() => {
                  handleTag(type)
                  setMenuOpen(false)
                  setQuery('')
                }}
              >
                <span className="semantic-rail-icon">{TYPE_ICONS[type]}</span>
                {t(`semantic.${type}`)}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="semantic-rail-menu-empty">{t('semantic.searchEmpty')}</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}