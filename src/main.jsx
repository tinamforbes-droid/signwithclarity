import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AppErrorBoundary from './AppErrorBoundary.js'
import SignWithClarity from './SignWithClarity.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary>
      <SignWithClarity />
    </AppErrorBoundary>
  </StrictMode>,
)
