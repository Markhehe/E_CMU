import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import 'overlayscrollbars/overlayscrollbars.css'
import './styles/global.css'
import App from './App.jsx'
import './styles/responsive.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <ToastProvider> 
        <App />
      </ToastProvider>
    </AuthProvider>
  </StrictMode>,
)