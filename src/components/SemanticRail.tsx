import React, { useState } from 'react'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import {
  SEMANTIC_GROUPS,
  DEFAULT_PROPS,
  DEFAULT_LAYOUT,
  canTag,
  setSemantic,
  applyStyle,
  toBlueprint,
  downloadJSON,
} from '../lib/blueprint'
import type { SemanticType, SemanticMeta } from '../lib/blueprint'
import { useI18n } from '../lib/i18n'
import './SemanticRail.css'

interface Props {
  editor: ExcalidrawImperativeAPI | null
  selected: ExcalidrawElement | null
  onChanged?: () => void
}

const TYPE_ICONS: Record<SemanticType, string> = {
  container: '▭', section: '▤', card: '▢', nav: '☰',
  heading: 'H', text: 'T', link: '↗',
  button: '⬭', input: '▭',
  image: '◫',
  raw: '</>', note: '✎',
}

const GROUP_LABEL_KEY: Record<string, string> = {
  container: 'semantic.groupContainer',
  content: 'semantic.groupContent',
  control: 'semantic.groupControl',
  media: 'semantic.groupMedia',
  special: 'semantic.groupSpecial',
}

export function SemanticRail({ editor, selected, onChanged }: Props) {
  const t = useI18n()
  const taggable = !!editor && !!selected && canTag(selected!)
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')

  const handleTag = (type: SemanticType) => {
    if (!editor || !selected || !canTag(selected)) return
    const meta: SemanticMeta = {
      type,
      layout: DEFAULT_LAYOUT,
      props: { ...DEFAULT_PROPS[type] },
    }
    const tagged = applyStyle(setSemantic(selected, meta), meta)
    const elements = editor
      .getSceneElements()
      .map((el) => (el.id === tagged.id ? tagged : el))
    editor.updateScene({ elements })
    onChanged?.()
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
    <>
      <div className="semantic-rail">
        <div className="semantic-rail-head">
          <span className="semantic-rail-title">{t('semantic.title')}</span>
          <button
            className={`semantic-rail-menu-btn ${menuOpen ? 'open' : ''}`}
            onClick={() => setMenuOpen((v) => !v)}
            title={t('semantic.search')}
          >
            ▾
          </button>
        </div>

        {SEMANTIC_GROUPS.map((group) => (
          <React.Fragment key={group.label}>
            <div className="semantic-rail-group">{t(GROUP_LABEL_KEY[group.label])}</div>
            {group.types.map((type) => (
              <button
                key={type}
                className="semantic-rail-btn"
                disabled={!taggable}
                onClick={() => handleTag(type)}
                title={t(`semantic.${type}`)}
              >
                <span className="semantic-rail-icon">{TYPE_ICONS[type]}</span>
                {t(`semantic.${type}`)}
              </button>
            ))}
          </React.Fragment>
        ))}
        <div className="semantic-rail-sep" />
        <button
          className="semantic-rail-btn semantic-rail-clear"
          disabled={!taggable}
          onClick={handleClear}
          title={t('semantic.untag')}
        >
          <span className="semantic-rail-icon">✕</span>
          {t('semantic.untag')}
        </button>
        <button className="semantic-rail-btn semantic-rail-export" onClick={handleExport}>
          <span className="semantic-rail-icon">⇩</span>
          {t('semantic.exportBlueprint')}
        </button>
      </div>

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
                disabled={!taggable}
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
    </>
  )
}