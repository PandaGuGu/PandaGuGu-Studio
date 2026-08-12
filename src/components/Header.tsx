import React, { useState } from 'react'
import type { ProviderDef, ModelDef } from '../lib/providers'
import { useI18n } from '../lib/i18n'
import './Header.css'

interface Props {
  providerName: string
  modelLabel: string
  hasKey: boolean
  provider?: ProviderDef | null
  model?: ModelDef | null
  onOpenSettings: () => void
  theme?: 'light' | 'dark'
  onToggleTheme?: () => void
}

export function Header({ providerName, modelLabel, hasKey, provider, model, onOpenSettings, theme = 'light', onToggleTheme }: Props) {
  const t = useI18n()
  const [showAbout, setShowAbout] = useState(false)

  return (
    <>
      <header className="app-header">
        <div className="header-title">
          <span className="header-title-main">PandaGuGu Studio</span>
          <span className="header-sep">/</span>
          <span className="header-title-sub">{t('header.subtitle')}</span>
        </div>
        <div className="header-right">
          <button
            className="btn btn-ghost theme-toggle-btn"
            onClick={onToggleTheme}
            title={theme === 'dark' ? t('theme.toggleDark') : t('theme.toggleLight')}
          >
            {theme === 'dark' ? '☾ ' + t('theme.dark') : '☀ ' + t('theme.light')}
          </button>
          <button
            className="btn btn-ghost what-is-this-btn"
            onClick={() => setShowAbout(true)}
          >
            {t('header.whatIsThis')}
          </button>
          <div className="header-divider" />

          {/* Active model display — click to open settings */}
          <button className="header-model-btn" onClick={onOpenSettings} title={t('header.openSettings')} aria-label={t('header.openSettings')}>
            <span className={`header-status-dot ${hasKey ? 'on' : ''}`} />
            <span className="header-model-label">{t('header.model')}</span>
            {hasKey ? (
              <>
                <span className="header-model-provider">{providerName}</span>
                <span className="header-model-sep">/</span>
                <span className="header-model-name">{modelLabel}</span>
              </>
            ) : (
              <span className="header-model-name header-model-unset">{t('header.modelNotSet')}</span>
            )}
            <svg className="header-gear" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>

            {/* Hover tooltip — full model info */}
            <div className="header-model-tip">
              <div className="tip-title">{hasKey ? (model?.label || modelLabel) : t('header.modelNotSet')}</div>
              {hasKey ? (
                <>
                  <div className="tip-row">
                    <span className="tip-k">{t('header.tipProvider')}</span>
                    <span className="tip-v">{provider?.name || providerName}</span>
                  </div>
                  {model?.vision && (
                    <div className="tip-row">
                      <span className="tip-k">{t('header.tipVision')}</span>
                      <span className="tip-v tip-vision">{t('header.tipVisionYes')}</span>
                    </div>
                  )}
                  <div className="tip-row">
                    <span className="tip-k">{t('header.tipEndpoint')}</span>
                    <span className="tip-v tip-endpoint">{provider?.endpoint || '—'}</span>
                  </div>
                </>
              ) : (
                <div className="tip-note">{t('header.tipNotSet')}</div>
              )}
              <div className="tip-foot">{t('header.tipOpenSettings')}</div>
            </div>
          </button>
        </div>
      </header>

      {showAbout && (
        <div className="about-overlay" onClick={() => setShowAbout(false)}>
          <div className="about-card" onClick={(e) => e.stopPropagation()}>
            <button className="about-close" onClick={() => setShowAbout(false)}>&times;</button>
            <h2 className="about-title">{t('header.aboutTitle')}</h2>
            <p className="about-subtitle">PandaGuGu Studio &middot; 2026</p>

            <div className="about-body">
              <p>
                {t('header.aboutDesc')}
              </p>

              <h3>{t('header.aboutProviders')}</h3>
              <ul>
                <li><strong>z.ai</strong> — GLM-5V Turbo</li>
                <li><strong>Google</strong> — Gemini 2.5 Flash/Pro, Gemma 4</li>
                <li><strong>Fireworks</strong> — Llama 4, DeepSeek</li>
                <li><strong>OpenRouter</strong> — Claude, GPT-4.1, Gemini, Llama, DeepSeek</li>
              </ul>

              <h3>{t('header.aboutHow')}</h3>
              <ol>
                <li><strong>{t('header.aboutStep1T')}</strong> — {t('header.aboutStep1D')}</li>
                <li><strong>{t('header.aboutStep2T')}</strong> — {t('header.aboutStep2D')}</li>
                <li><strong>{t('header.aboutStep3T')}</strong> — {t('header.aboutStep3D')}</li>
                <li><strong>{t('header.aboutStep4T')}</strong> — {t('header.aboutStep4D')}</li>
              </ol>

              <h3>{t('header.aboutFeatures')}</h3>
              <ul>
                <li>{t('header.aboutF1')}</li>
                <li>{t('header.aboutF2')}</li>
                <li>{t('header.aboutF3')}</li>
                <li>{t('header.aboutF4')}</li>
              </ul>

              <div className="about-footer">
                <span>{t('header.aboutFooter1')}</span>
                <span>{t('header.aboutFooter2')}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
