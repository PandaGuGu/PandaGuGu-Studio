import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { I18nProvider } from './lib/i18n'
import './styles/globals.css'

const savedLang = localStorage.getItem('pandagugu-lang') || 'zh-CN'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider lang={savedLang as 'zh-CN' | 'en'}>
      <App />
    </I18nProvider>
  </StrictMode>
)
