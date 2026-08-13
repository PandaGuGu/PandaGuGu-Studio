import { Fragment, useState } from 'react'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import {
  SEMANTIC_GROUPS,
  DEFAULT_LAYOUT,
  canTag,
  setSemantic,
  toBlueprintAsync,
  blueprintToHtml,
  downloadJSON,
} from '../lib/blueprint'
import { alignElements } from '../lib/align'
import type { AlignOp } from '../lib/align'
import { exportAllAsPng, brandFilename } from '../lib/export'
import type { SemanticType, SemanticMeta } from '../lib/blueprint'
import { useI18n } from '../lib/i18n'
import './SemanticRail.css'

interface Props {
  editor: ExcalidrawImperativeAPI | null
  selected: ExcalidrawElement | null
  selectedIds?: Set<string>
  onChanged?: () => void
  /** No selection → switch Excalidraw tool & tag the next drawn element. */
  onDrawTag?: (type: SemanticType) => void
  /** Open the "import HTML" dialog. */
  onImportHtml?: () => void
  /** Open the classic-templates dialog. */
  onOpenTemplates?: () => void
}

const ALIGN_BTNS: { op: AlignOp; icon: string }[] = [
  { op: 'left', icon: '⇤' },
  { op: 'hcenter', icon: '↔' },
  { op: 'right', icon: '⇥' },
  { op: 'top', icon: '⇡' },
  { op: 'vcenter', icon: '↕' },
  { op: 'bottom', icon: '⇣' },
  { op: 'hdistribute', icon: '⊞' },
  { op: 'vdistribute', icon: '⊟' },
]

const TYPE_ICONS: Record<SemanticType, string> = {
  container: '▭', section: '▤', card: '▢', nav: '☰',
  heading: 'H', text: 'T', link: '↗',
  button: '⬭', input: '▭',
  image: '◫',
  raw: '</>', note: '✎',
}

export function SemanticRail({ editor, selected, selectedIds = new Set(), onChanged, onDrawTag, onImportHtml, onOpenTemplates }: Props) {
  const t = useI18n()
  const taggable = !!editor && !!selected && canTag(selected!)
  const multiSelect = selectedIds.size >= 2
  const [menuOpen, setMenuOpen] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [query, setQuery] = useState('')

  const handleAlign = (op: AlignOp) => {
    if (!editor || selectedIds.size < 2) return
    const selEls = editor
      .getSceneElements()
      .filter((e) => selectedIds.has(e.id) && !(e as any).isDeleted)
    if (selEls.length < 2) return
    const aligned = alignElements(selEls, op)
    const idMap = new Map(aligned.map((a) => [a.id, a]))
    const elements = editor
      .getSceneElements()
      .map((el) => idMap.get(el.id) || el)
    editor.updateScene({ elements })
    onChanged?.()
  }

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

  const handleExport = async (imageAsFile = false) => {
    if (!editor) return
    const bp = await toBlueprintAsync(editor, { imageAsFile })
    if (!bp) {
      alert(t('semantic.exportEmpty'))
      return
    }
    downloadJSON(bp, brandFilename('json'))
  }

  /** 导出自包含 HTML:图片 base64 内嵌,无需任何本地文件,Ai 不参与。 */
  const handleExportHtml = async () => {
    if (!editor) return
    const bp = await toBlueprintAsync(editor)
    if (!bp) {
      alert(t('semantic.exportEmpty'))
      return
    }
    const html = blueprintToHtml(bp)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = brandFilename('html')
    a.click()
    URL.revokeObjectURL(url)
    setExportMenuOpen(false)
  }

  /** 复制"提示词+JSON"给网页 AI:明确告知 src 是 base64 字符串、不要解码、原样复制。 */
  const handleCopyForAI = async () => {
    if (!editor) return
    const bp = await toBlueprintAsync(editor)
    if (!bp) {
      alert(t('semantic.exportEmpty'))
      return
    }
    const prompt =
      '严格根据以下 JSON 布局生成一个完整的 HTML 页面。\n' +
      '【映射规则】section→<section>，container/card/nav→<div>，heading→<h1-h6>，text→<p>，link→<a>，button→<button>，input→<input>，image→<img>，raw→原样嵌入 props.html。\n' +
      '【图片规则】image 元素的 props.src 若以 data:image/ 开头，它是一段完整的 base64 图片数据字符串。你**不需要解码、不需要理解、不需要查看它**，它只是普通文本。你只需把它**一字不差、原样完整复制**到 <img src="..."> 里，浏览器会自动显示图片。**严禁截断、省略、改写、压缩或替换成占位图/链接**。若 src 不是 data: 开头，则按普通 URL 或文件名使用。\n' +
      '【布局规则】layout:"free" 用 position:absolute(x/y/w/h 是像素)；"row"用 flex 横向；"column"用 flex 纵向；"grid"/"wrap"用 grid/flex-wrap。重叠元素按 zIndex 设置 z-index。\n' +
      '【硬性要求】1) 严格按元素树生成，不得臆造或删除区块；2) 文案一律用 props 中的 content/label/placeholder，不要自己编内容；3) 输出完整可运行的单文件 HTML(含 <!DOCTYPE html> 和内联 CSS)，不要输出解释文字。\n\n' +
      '```json\n' +
      JSON.stringify(bp, null, 2) +
      '\n```'
    try {
      await navigator.clipboard.writeText(prompt)
      alert(t('semantic.copyForAIHint'))
    } catch {
      // Clipboard blocked (non-secure context) — fall back to a download.
      downloadJSON({ __prompt: prompt }, brandFilename('prompt'))
    }
    setExportMenuOpen(false)
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
    a.download = brandFilename('png')
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
        <Fragment key={group.label}>
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
        </Fragment>
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
            onClick={() => { handleExport(true); setExportMenuOpen(false) }}
            title={t('semantic.exportBlueprintFileHint')}
          >
            <span className="semantic-rail-icon">📁</span>
            {t('semantic.exportBlueprintFile')}
          </button>
          <button
            className="semantic-rail-menu-item"
            onClick={handleExportHtml}
            title={t('semantic.exportHtmlHint')}
          >
            <span className="semantic-rail-icon">🧾</span>
            {t('semantic.exportHtml')}
          </button>
          <button
            className="semantic-rail-menu-item"
            onClick={handleCopyForAI}
            title={t('semantic.copyForAIHint')}
          >
            <span className="semantic-rail-icon">🤖</span>
            {t('semantic.copyForAI')}
          </button>
          <button
            className="semantic-rail-menu-item"
            onClick={handleExportPng}
          >
            <span className="semantic-rail-icon">🖼</span>
            {t('semantic.exportPng')}
          </button>
          <button
            className="semantic-rail-menu-item"
            onClick={() => { onImportHtml?.(); setExportMenuOpen(false) }}
          >
            <span className="semantic-rail-icon">⇪</span>
            {t('semantic.importHtml')}
          </button>
          <button
            className="semantic-rail-menu-item"
            onClick={() => { onOpenTemplates?.(); setExportMenuOpen(false) }}
          >
            <span className="semantic-rail-icon">▦</span>
            {t('semantic.templates')}
          </button>
          <div className="semantic-rail-menu-divider" />
          <div className="semantic-rail-menu-group">{t('align.title')}</div>
          {ALIGN_BTNS.map(({ op, icon }) => (
            <button
              key={op}
              className={`semantic-rail-menu-item ${multiSelect ? '' : 'disabled'}`}
              onClick={() => handleAlign(op)}
              title={multiSelect ? t(`align.${op}`) : t('align.needMulti')}
            >
              <span className="semantic-rail-icon">{icon}</span>
              {t(`align.${op}`)}
            </button>
          ))}
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