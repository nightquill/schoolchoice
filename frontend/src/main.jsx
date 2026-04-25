import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './utils/tokens.css'
import { AuthProvider } from './context/AuthContext'
import { Toaster } from '@/components/ui/sonner'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
      <Toaster position="bottom-right" richColors />
    </AuthProvider>
  </StrictMode>,
)
