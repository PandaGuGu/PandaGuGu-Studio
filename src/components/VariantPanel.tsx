import React, { useState } from 'react'
import { useI18n } from '../lib/i18n'
import './VariantPanel.css'

/** Preset style descriptions sent to the AI. */
export const PRESET_STYLES: { id: string; labelKey: string; desc: string }[] = [
  { id: 'minimal', labelKey: 'variant.minimal', desc: '极简主义：大量留白、黑白灰主色、细线边框、无衬线字体、克制的小圆角' },
  { id: 'cyberpunk', labelKey: 'variant.cyberpunk', desc: '赛博朋克：深紫/青色霓虹渐变、发光边框、故障效果、等宽字体、网格背景' },
  { id: 'morandi', labelKey: 'variant.morandi', desc: '莫兰迪色系：低饱和灰调(雾霾蓝/灰粉/燕麦色)、柔和阴影、圆角卡片、优雅衬线标题' },
  { id: 'glass', labelKey: 'variant.glass', desc: '玻璃拟态：半透明毛玻璃卡片、blur 背景、白色微光描边、柔和渐变背景' },
  { id: 'terminal', labelKey: 'variant.terminal', desc: '暗黑终端风：纯黑背景、荧光绿/琥珀色等宽字体、扫描线/光标效果、简洁命令行布局' },
  { id: 'neumorphic', labelKey: 'variant.neumorphic', desc: '新拟物：同色系凹凸阴影(亮高光+暗投影)、圆角方块、无边框、柔和中性色' },
  { id: 'luxury', labelKey: 'variant.luxury', desc: '高端质感：深色背景+金色点缀、衬线大标题、细腻渐变、杂志式排版、大留白' },
  { id: 'retro', labelKey: 'variant.retro', desc: '复古像素风：8bit 像素字体、高饱和撞色、粗边框、块状阴影、复古游戏界面' },
]

export interface VariantStyle {
  id: string
  label: string
  desc: string
}

interface Props {
  onGenerate: (styles: VariantStyle[]) => void
  generating: boolean
  progress: { done: number; total: number; current: string } | null
  disabled?: boolean
}

export function VariantPanel({ onGenerate, generating, progress, disabled }: Props) {
  const t = useI18n()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<VariantStyle[]>([])
  const [custom, setCustom] = useState('')

  const togglePreset = (p: { id: string; labelKey: string; desc: string }) => {
    const label = t(p.labelKey)
    setSelected((prev) =>
      prev.some((s) => s.id === p.id)
        ? prev.filter((s) => s.id !== p.id)
        : [...prev, { id: p.id, label, desc: p.desc }]
    )
  }

  const addCustom = () => {
    const desc = custom.trim()
    if (!desc) return
    const id = `custom-${Date.now()}`
    setSelected((prev) => [...prev, { id, label: desc.slice(0, 12), desc }])
    setCustom('')
  }

  const removeStyle = (id: string) => {
    setSelected((prev) => prev.filter((s) => s.id !== id))
  }

  const canGenerate = selected.length > 0 && !generating && !disabled

  return (
    <div className={`variant-panel ${open ? 'open' : ''}`}>
      <button
        className={`variant-toggle ${open ? 'open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title={t('variant.title')}
      >
        <span className="variant-toggle-icon">⚡</span>
        {t('variant.title')}
        {selected.length > 0 && <span className="variant-count">{selected.length}</span>}
        <span className="variant-arrow">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="variant-body">
          <div className="variant-preset-label">{t('variant.presets')}</div>
          <div className="variant-presets">
            {PRESET_STYLES.map((p) => (
              <button
                key={p.id}
                className={`variant-chip ${selected.some((s) => s.id === p.id) ? 'on' : ''}`}
                onClick={() => togglePreset(p)}
                title={p.desc}
              >
                {t(p.labelKey)}
              </button>
            ))}
          </div>

          <div className="variant-custom-row">
            <input
              className="variant-custom-input"
              value={custom}
              placeholder={t('variant.customPlaceholder')}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addCustom() }}
            />
            <button className="variant-add-btn" onClick={addCustom} disabled={!custom.trim()}>
              {t('variant.add')}
            </button>
          </div>

          {selected.length > 0 && (
            <div className="variant-selected">
              {selected.map((s) => (
                <span key={s.id} className="variant-selected-chip" title={s.desc}>
                  {s.label}
                  <button className="variant-selected-x" onClick={() => removeStyle(s.id)}>✕</button>
                </span>
              ))}
            </div>
          )}

          <button
            className="variant-generate-btn"
            onClick={() => onGenerate(selected)}
            disabled={!canGenerate}
          >
            {generating
              ? progress
                ? `${t('variant.generating')} ${progress.done}/${progress.total} · ${progress.current}`
                : t('variant.generating')
              : t('variant.generate', { n: String(selected.length) })}
          </button>
        </div>
      )}
    </div>
  )
}
