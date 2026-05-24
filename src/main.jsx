import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(() => console.log('✅ Service Worker registered'))
      .catch(err => console.log('❌ Service Worker failed:', err))
  })
}

// Wake Lock API — keeps screen on during runs
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
    <App />
  </StrictMode>,
)