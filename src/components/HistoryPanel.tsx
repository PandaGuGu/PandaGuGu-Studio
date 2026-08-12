import React, { useState } from 'react'
import type { HistoryItem } from '../lib/history'
import { brandFilename } from '../lib/export'
import { useI18n } from '../lib/i18n'
import './HistoryPanel.css'

interface Props {
  items: HistoryItem[]
  activeId: string | null
  modelLabel?: string
  onLoad: (item: HistoryItem) => void
  onDelete: (id: string) => void
  onClear: () => void
}

function fmtTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function summarize(html: string): string {
  const m = html.match(/<title>([^<]*)<\/title>/i)
  if (m && m[1].trim()) return m[1].trim().slice(0, 24)
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return (text || 'HTML').slice(0, 24)
}

export function HistoryPanel({ items, activeId, modelLabel, onLoad, onDelete, onClear }: Props) {
  const t = useI18n()
  const [open, setOpen] = useState(false)

  return (
    <div className={`history-panel ${open ? 'open' : ''}`}>
      <button className={`history-toggle ${open ? 'open' : ''}`} onClick={() => setOpen((v) => !v)}>
        <span className="history-toggle-icon">🗂</span>
        {t('history.title')}
        {items.length > 0 && <span className="history-count">{items.length}</span>}
        <span className="history-arrow">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="history-body">
          {items.length === 0 && <div className="history-empty">{t('history.empty')}</div>}
          {items.map((item) => (
            <div key={item.id} className={`history-item ${activeId === item.id ? 'active' : ''}`}>
              <button
                className="history-item-main"
                onClick={() => onLoad(item)}
                title={t('history.load')}
              >
                <span className="history-item-time">{fmtTime(item.ts)}</span>
                <span className="history-item-summary">{summarize(item.html)}</span>
              </button>
              <button
                className="history-item-dl"
                title={t('history.download')}
                onClick={() => {
                  const blob = new Blob([item.html], { type: 'text/html' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = brandFilename('html', modelLabel)
                  a.click()
                  URL.revokeObjectURL(url)
                }}
              >
                ⇩
              </button>
              <button
                className="history-item-del"
                title={t('history.delete')}
                onClick={() => onDelete(item.id)}
              >
                ✕
              </button>
            </div>
          ))}
          {items.length > 0 && (
            <button className="history-clear" onClick={onClear}>
              {t('history.clearAll')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
