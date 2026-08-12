import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { I18nProvider } from './lib/i18n'
import './styles/globals.css'

const savedLang = localStorage.getItem('vcanvas-lang') || 'zh-CN'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider lang={savedLang as 'zh-CN' | 'en'}>
      <App />
    </I18nProvider>
  </React.StrictMode>
)
