import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './utils/tokens.css'
import { AuthProvider } from '@schoolchoice/ui/context/AuthContext'
import { I18nProvider } from '@schoolchoice/ui/i18n'
import { Toaster } from '@schoolchoice/ui/primitives/sonner'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <I18nProvider initialLocale={localStorage.getItem('locale') || 'en'}>
        <App />
        <Toaster position="bottom-right" richColors />
      </I18nProvider>
    </AuthProvider>
  </StrictMode>,
)
