import { useState } from 'react'
import { supabase } from '../lib/supabase'

const COLORS = [
  '#FF5733', '#33FF57', '#3357FF', '#FF33F5',
  '#FFD700', '#00FFFF', '#FF6B6B', '#6BCB77',
  '#4D96FF', '#FF9F1C', '#E040FB', '#00BCD4'
]

export default function Onboarding({ userId, onComplete }) {
  const [username, setUsername] = useState('')
  const [selectedColor, setSelectedColor] = useState('')
  const [takenColors, setTakenColors] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Load already taken colors
  useState(() => {
    supabase.from('profiles').select('color').then(({ data }) => {
      if (data) setTakenColors(data.map(p => p.color))
    })
  })

  async function handleSubmit() {
    if (!username.trim()) { setError('Please enter a username'); return }
    if (!selectedColor) { setError('Please pick a color'); return }
    if (username.trim().length < 3) { setError('Username must be at least 3 characters'); return }

    setLoading(true)
    setError('')

    // Check username is unique
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username.trim())
      .neq('id', userId)
      .single()

    if (existing) {
      setError('Username already taken. Try another.')
      setLoading(false)
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({ username: username.trim(), color: selectedColor })
      .eq('id', userId)

    if (error) {
      setError('Something went wrong. Try again.')
      setLoading(false)
      return
    }

    onComplete()
  }

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#0a0a0a', color: '#fff',
      padding: 24, gap: 20
    }}>
      <h1 style={{ fontSize: 28, marginBottom: 0 }}>🗺️ Welcome to Stepland</h1>
      <p style={{ color: '#888', marginTop: 0 }}>Set up your profile to start playing</p>

      {/* Username */}
      <div style={{ width: '100%', maxWidth: 340 }}>
        <label style={{ color: '#aaa', fontSize: 13, display: 'block', marginBottom: 6 }}>
          Choose a username
        </label>
        <input
          placeholder="e.g. StreetKing_Nukus"
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

      {/* Color picker */}
      <div style={{ width: '100%', maxWidth: 340 }}>
        <label style={{ color: '#aaa', fontSize: 13, display: 'block', marginBottom: 10 }}>
          Choose your territory color
        </label>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10
        }}>
          {COLORS.map(color => {
            const isTaken = takenColors.includes(color)
            const isSelected = selectedColor === color
            return (
              <div
                key={color}
                onClick={() => !isTaken && setSelectedColor(color)}
                style={{
                  width: 44, height: 44,
                  borderRadius: 8,
                  background: color,
                  opacity: isTaken ? 0.25 : 1,
                  cursor: isTaken ? 'not-allowed' : 'pointer',
                  border: isSelected ? '3px solid #fff' : '3px solid transparent',
                  boxSizing: 'border-box',
                  position: 'relative'
                }}
              >
                {isTaken && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18, color: '#fff'
                  }}>✕</div>
                )}
              </div>
            )
          })}
        </div>
        {selectedColor && (
          <p style={{ color: '#aaa', fontSize: 12, marginTop: 8 }}>
            Selected: <span style={{ color: selectedColor }}>■</span> {selectedColor}
          </p>
        )}
      </div>

      {error && (
        <p style={{ color: '#FF4444', fontSize: 13, margin: 0 }}>{error}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading}
        style={{
          background: '#00FF88', color: '#000',
          border: 'none', padding: '14px 40px',
          borderRadius: 30, fontSize: 16,
          fontWeight: 'bold', cursor: 'pointer',
          width: '100%', maxWidth: 340
        }}
      >
        {loading ? 'Saving...' : 'Start Playing →'}
      </button>
    </div>
  )
}