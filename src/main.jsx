import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { LanguageProvider } from './lib/LanguageContext'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(() => console.log('✅ Service Worker registered'))
      .catch(err => console.log('❌ Service Worker failed:', err))
  })
}

export async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      const lock = await navigator.wakeLock.request('screen')
      console.log('✅ Wake Lock active')
      return lock
    } catch (err) {
      console.log('Wake Lock not available:', err)
      return null
    }
  }
  return null
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
)