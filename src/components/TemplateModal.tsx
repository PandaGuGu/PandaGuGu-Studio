import React from 'react'
import { TEMPLATES } from '../lib/templates'
import type { Template } from '../lib/templates'
import { useI18n } from '../lib/i18n'
import './TemplateModal.css'

interface Props {
  onApply: (template: Template) => void
  onClose: () => void
}

const DEVICE_ICON: Record<Template['device'], string> = {
  mobile: '📱',
  desktop: '🖥',
}

export function TemplateModal({ onApply, onClose }: Props) {
  const t = useI18n()

  return (
    <div className="tpl-overlay" onClick={onClose}>
      <div className="tpl-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tpl-head">
          <span className="tpl-title">{t('template.title')}</span>
          <button className="tpl-close" onClick={onClose}>&times;</button>
        </div>
        <p className="tpl-desc">{t('template.desc')}</p>
        <div className="tpl-grid">
          {TEMPLATES.map((tp) => (
            <button key={tp.id} className="tpl-card" onClick={() => onApply(tp)}>
              <span className="tpl-device">{DEVICE_ICON[tp.device]}</span>
              <span className="tpl-name">{t(tp.labelKey)}</span>
              <span className="tpl-tag">{t(tp.device === 'mobile' ? 'template.mobile' : 'template.desktop')}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
