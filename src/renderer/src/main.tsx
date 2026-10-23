import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ConfirmProvider } from './components/ui/ConfirmProvider'
import { ToastProvider } from './components/ui/ToastProvider'
import { AppProvider } from './store/AppProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <ConfirmProvider>
        <AppProvider>
          <App />
        </AppProvider>
      </ConfirmProvider>
    </ToastProvider>
  </StrictMode>
)
