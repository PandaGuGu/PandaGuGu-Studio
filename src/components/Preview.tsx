import React from 'react'
import './Preview.css'
import { useI18n } from '../lib/i18n'

interface Props {
  html: string
  iframeRef: React.RefObject<HTMLIFrameElement | null>
  device?: 'desktop' | 'tablet' | 'mobile'
}

const DEVICE_WIDTHS: Record<NonNullable<Props['device']>, number | null> = {
  desktop: null,
  tablet: 768,
  mobile: 375,
}

export function Preview({ html, iframeRef, device = 'desktop' }: Props) {
  const t = useI18n()
  if (!html) {
    return (
      <div className="preview-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="m9 8 6 4-6 4Z" />
        </svg>
        <p>{t('preview.emptyText')}</p>
        <span className="preview-hint">{t('preview.emptyHint')}</span>
      </div>
    )
  }

  const width = DEVICE_WIDTHS[device]
  const deviceStyle: React.CSSProperties = width
    ? { width: `${width}px`, maxWidth: '100%', margin: '0 auto', height: '100%' }
    : { width: '100%', height: '100%' }

  return (
    <div className="preview-device" style={deviceStyle} data-device={device}>
      <iframe
        ref={iframeRef}
        className="preview-frame"
        srcDoc={html}
        sandbox="allow-scripts allow-same-origin"
        title="Preview"
      />
    </div>
  )
}
