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
import type { SemanticType, LayoutHint, SemanticMeta } from '../lib/blueprint'
import { useI18n } from '../lib/i18n'
import './SemanticToolbar.css'

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

export function SemanticToolbar({ editor, selected, onChanged }: Props) {
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
    <div className="semantic-toolbar">
      <span className="semantic-toolbar-label">{t('semantic.title')}</span>
      {SEMANTIC_GROUPS.map((group) => (
        <React.Fragment key={group.label}>
          <span className="semantic-group-label">{t(GROUP_LABEL_KEY[group.label])}</span>
          {group.types.map((type) => (
            <button
              key={type}
              className="semantic-btn"
              disabled={!taggable}
              onClick={() => handleTag(type)}
              title={t(`semantic.${type}`)}
            >
              <span className="semantic-btn-icon">{TYPE_ICONS[type]}</span>
              {t(`semantic.${type}`)}
            </button>
          ))}
        </React.Fragment>
      ))}
      <span className="semantic-toolbar-sep" />
      <button
        className="semantic-btn semantic-btn-clear"
        disabled={!taggable}
        onClick={handleClear}
        title={t('semantic.untag')}
      >
        ✕
      </button>
      <button className="semantic-btn semantic-btn-export" onClick={handleExport}>
        {t('semantic.exportBlueprint')}
      </button>
    </div>
  )
}