import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import SignWithClarity from './SignWithClarity.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SignWithClarity />
  </StrictMode>,
)
