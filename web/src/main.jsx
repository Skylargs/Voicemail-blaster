import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { TwilioStatusProvider } from './contexts/TwilioStatusContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <TwilioStatusProvider>
          <App />
        </TwilioStatusProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
