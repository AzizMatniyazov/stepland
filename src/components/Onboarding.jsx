import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../lib/LanguageContext'
import { LANGUAGES } from '../lib/i18n'

function colorDistance(hex1, hex2) {
  if (!hex1 || !hex2) return 100
  const r1 = parseInt(hex1.slice(1,3),16), g1 = parseInt(hex1.slice(3,5),16), b1 = parseInt(hex1.slice(5,7),16)
  const r2 = parseInt(hex2.slice(1,3),16), g2 = parseInt(hex2.slice(3,5),16), b2 = parseInt(hex2.slice(5,7),16)
  return Math.sqrt(Math.pow(r1-r2,2)*0.3 + Math.pow(g1-g2,2)*0.59 + Math.pow(b1-b2,2)*0.11)
}

export default function Onboarding({ userId, onComplete }) {
  const { lang, setLang, t } = useLanguage()
  const [username, setUsername] = useState('')
  const [selectedColor, setSelectedColor] = useState('#00FF88')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!username.trim() || username.trim().length < 3) {
      setError(t.usernameShort); return
    }
    if (!selectedColor) { setError(t.chooseColor); return }

    setLoading(true); setError('')

    const { data: existing } = await supabase
      .from('profiles').select('id')
      .eq('username', username.trim()).neq('id', userId).single()

    if (existing) { setError(t.usernameTaken); setLoading(false); return }

    const { data: profiles } = await supabase
      .from('profiles').select('color').neq('id', userId)

    if (profiles) {
      const tooSimilar = profiles.some(p => p.color && colorDistance(selectedColor, p.color) < 15)
      if (tooSimilar) { setError(t.colorSimilar); setLoading(false); return }
    }

    const { error } = await supabase
      .from('profiles')
      .update({ username: username.trim(), color: selectedColor })
      .eq('id', userId)

    if (error) { setError(t.failedSave); setLoading(false); return }
    onComplete()
  }

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#0a0a0a', color: '#fff', padding: 24, gap: 20
    }}>
      <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 8 }}>
        {LANGUAGES.map(l => (
          <button key={l.code} onClick={() => setLang(l.code)} style={{
            background: lang === l.code ? '#00FF88' : '#1a1a1a',
            color: lang === l.code ? '#000' : '#fff',
            border: '1px solid #333', borderRadius: 8,
            padding: '6px 10px', cursor: 'pointer',
            fontSize: 13, fontWeight: 'bold'
          }}>
            {l.flag} {l.label}
          </button>
        ))}
      </div>

      <h1 style={{ fontSize: 28, marginBottom: 0 }}>🗺️ {t.welcomeTitle}</h1>
      <p style={{ color: '#888', marginTop: 0 }}>{t.setupProfile}</p>

      <div style={{ width: '100%', maxWidth: 340 }}>
        <label style={{ color: '#aaa', fontSize: 13, display: 'block', marginBottom: 6 }}>
          {t.chooseUsername}
        </label>
        <input
          placeholder={t.usernamePlaceholder}
          value={username}
          onChange={e => setUsername(e.target.value)}
          maxLength={20}
          style={{
            width: '100%', padding: '12px 16px',
            borderRadius: 10, border: '1px solid #333',
            background: '#1a1a1a', color: '#fff',
            fontSize: 15, boxSizing: 'border-box'
          }}
        />
      </div>

      <div style={{ width: '100%', maxWidth: 340 }}>
        <label style={{ color: '#aaa', fontSize: 13, display: 'block', marginBottom: 6 }}>
          {t.chooseColor}
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <input
            type="color"
            value={selectedColor}
            onChange={e => setSelectedColor(e.target.value)}
            style={{ width: 60, height: 60, borderRadius: 10, border: 'none', cursor: 'pointer', padding: 0 }}
          />
          <div>
            <div style={{ width: 120, height: 40, borderRadius: 8, background: selectedColor, marginBottom: 4 }} />
            <div style={{ color: '#888', fontSize: 12 }}>{selectedColor}</div>
          </div>
        </div>
        <p style={{ color: '#555', fontSize: 12, marginTop: 8 }}>{t.colorHint}</p>
      </div>

      {error && (
        <p style={{ color: '#FF4444', fontSize: 13, margin: 0, textAlign: 'center', maxWidth: 340 }}>
          {error}
        </p>
      )}

      <button onClick={handleSubmit} disabled={loading} style={{
        background: '#00FF88', color: '#000', border: 'none',
        padding: '14px 40px', borderRadius: 30, fontSize: 16,
        fontWeight: 'bold', cursor: 'pointer',
        width: '100%', maxWidth: 340, opacity: loading ? 0.7 : 1
      }}>
        {loading ? t.saving : t.startPlaying}
      </button>
    </div>
  )
}