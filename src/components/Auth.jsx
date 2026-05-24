import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Auth() {
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
        email,
        password,
        options: { data: { username } }
      })
      if (error) setMessage(error.message)
      else setMessage('Check your email to confirm your account!')
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
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>🗺️ Stepland</h1>
      <p style={{ color: '#888', marginBottom: 16 }}>Claim the streets</p>

      {isSignUp && (
        <input
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          style={inputStyle}
        />
      )}
      <input
        placeholder="Email"
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        style={inputStyle}
      />
      <input
        placeholder="Password"
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        style={inputStyle}
      />

      {message && (
        <p style={{ color: message.includes('error') ? '#ff4444' : '#00FF88', fontSize: 13 }}>
          {message}
        </p>
      )}

      <button onClick={handleSubmit} disabled={loading} style={{
        background: '#00FF88', color: '#000', border: 'none',
        padding: '14px 40px', borderRadius: 30, fontSize: 16,
        fontWeight: 'bold', cursor: 'pointer', width: '100%', maxWidth: 320
      }}>
        {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Log In'}
      </button>

      <button onClick={() => setIsSignUp(!isSignUp)} style={{
        background: 'none', border: 'none', color: '#888',
        cursor: 'pointer', fontSize: 14
      }}>
        {isSignUp ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
      </button>
    </div>
  )
}

const inputStyle = {
  width: '100%', maxWidth: 320, padding: '12px 16px',
  borderRadius: 10, border: '1px solid #333',
  background: '#1a1a1a', color: '#fff', fontSize: 15
}