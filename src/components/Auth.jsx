import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../lib/LanguageContext'
import { LANGUAGES } from '../lib/i18n'

export default function Auth() {
  const { lang, setLang, t } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSubmit() {
    setLoading(true)
    setMessage('')

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { username } }
      })
      if (error) setMessage(error.message)
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage(error.message)
    }
    setLoading(false)
  }

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#0a0a0a', color: '#fff', gap: 12, padding: 24
    }}>
      {/* Language switcher */}
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

      <h1 style={{ fontSize: 32, marginBottom: 8 }}>🗺️ {t.welcome}</h1>
      <p style={{ color: '#888', marginBottom: 16 }}>{t.tagline}</p>

      {isSignUp && (
        <input placeholder={t.username} value={username}
          onChange={e => setUsername(e.target.value)} style={inputStyle} />
      )}
      <input placeholder={t.email} type="email" value={email}
        onChange={e => setEmail(e.target.value)} style={inputStyle} />
      <input placeholder={t.password} type="password" value={password}
        onChange={e => setPassword(e.target.value)} style={inputStyle} />

      {message && (
        <p style={{ color: '#ff4444', fontSize: 13 }}>{message}</p>
      )}

      <button onClick={handleSubmit} disabled={loading} style={{
        background: '#00FF88', color: '#000', border: 'none',
        padding: '14px 40px', borderRadius: 30, fontSize: 16,
        fontWeight: 'bold', cursor: 'pointer', width: '100%', maxWidth: 320
      }}>
        {loading ? '...' : isSignUp ? t.signup : t.login}
      </button>

      <button onClick={() => setIsSignUp(!isSignUp)} style={{
        background: 'none', border: 'none', color: '#888',
        cursor: 'pointer', fontSize: 14
      }}>
        {isSignUp ? t.hasAccount : t.noAccount}
      </button>
    </div>
  )
}

const inputStyle = {
  width: '100%', maxWidth: 320, padding: '12px 16px',
  borderRadius: 10, border: '1px solid #333',
  background: '#1a1a1a', color: '#fff', fontSize: 15
}