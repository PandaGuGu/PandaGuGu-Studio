import React from 'react'
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

  return (
    <div className="semantic-rail">
      <div className="semantic-rail-title">{t('semantic.title')}</div>
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
  )
}
