import React, { useState, useRef } from 'react'
import { useI18n } from '../lib/i18n'
import './ImportHtmlModal.css'

interface Props {
  onImport: (html: string) => boolean
  onClose: () => void
}

export function ImportHtmlModal({ onImport, onClose }: Props) {
  const t = useI18n()
  const [html, setHtml] = useState('')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const readFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      setHtml(String(reader.result || ''))
      setError('')
    }
    reader.onerror = () => setError(t('import.readError'))
    reader.readAsText(file)
  }

  const doImport = () => {
    if (!html.trim()) {
      setError(t('import.empty'))
      return
    }
    const ok = onImport(html)
    if (ok) onClose()
    else setError(t('import.parseError'))
  }

  return (
    <div className="import-overlay" onClick={onClose}>
      <div className="import-modal" onClick={(e) => e.stopPropagation()}>
        <div className="import-head">
          <span className="import-title">{t('import.title')}</span>
          <button className="import-close" onClick={onClose}>&times;</button>
        </div>
        <p className="import-desc">{t('import.desc')}</p>

        <div className="import-toolbar">
          <input
            ref={fileRef}
            type="file"
            accept=".html,.htm"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f) }}
          />
          <button className="import-file-btn" onClick={() => fileRef.current?.click()}>
            {t('import.file')}
          </button>
          <span className="import-hint">{t('import.hint')}</span>
        </div>

        <textarea
          className="import-area"
          value={html}
          placeholder={t('import.placeholder')}
          onChange={(e) => { setHtml(e.target.value); setError('') }}
          spellCheck={false}
        />

        {error && <div className="import-error">{error}</div>}

        <div className="import-foot">
          <button className="import-cancel" onClick={onClose}>{t('import.cancel')}</button>
          <button className="import-ok" onClick={doImport} disabled={!html.trim()}>
            {t('import.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
