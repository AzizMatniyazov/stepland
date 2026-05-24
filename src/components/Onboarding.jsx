import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Onboarding({ userId, onComplete }) {
  const [username, setUsername] = useState('')
  const [selectedColor, setSelectedColor] = useState('#00FF88')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!username.trim()) { setError('Please enter a username'); return }
    if (username.trim().length < 3) { setError('Username must be at least 3 characters'); return }
    if (!selectedColor) { setError('Please pick a color'); return }

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

    // Check color is not too similar to existing colors
    const { data: profiles } = await supabase
      .from('profiles')
      .select('color')
      .neq('id', userId)

    if (profiles) {
      const tooSimilar = profiles.some(p => {
        if (!p.color) return false
        return colorDistance(selectedColor, p.color) < 30
      })

      if (tooSimilar) {
        setError('This color is too similar to another player. Pick a different shade.')
        setLoading(false)
        return
      }
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
        <label style={{ color: '#aaa', fontSize: 13, display: 'block', marginBottom: 6 }}>
          Choose your territory color
        </label>

        {/* Color wheel input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <input
            type="color"
            value={selectedColor}
            onChange={e => setSelectedColor(e.target.value)}
            style={{
              width: 60, height: 60,
              borderRadius: 10, border: 'none',
              cursor: 'pointer', background: 'none',
              padding: 0
            }}
          />
          <div>
            <div style={{
              width: 120, height: 40, borderRadius: 8,
              background: selectedColor,
              marginBottom: 4
            }} />
            <div style={{ color: '#888', fontSize: 12 }}>
              {selectedColor}
            </div>
          </div>
        </div>

        <p style={{ color: '#555', fontSize: 12, marginTop: 8 }}>
          Pick any color. If it's too similar to another player's color you'll be asked to change it.
        </p>
      </div>

      {error && (
        <p style={{ color: '#FF4444', fontSize: 13, margin: 0, textAlign: 'center', maxWidth: 340 }}>
          {error}
        </p>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading}
        style={{
          background: '#00FF88', color: '#000',
          border: 'none', padding: '14px 40px',
          borderRadius: 30, fontSize: 16,
          fontWeight: 'bold', cursor: 'pointer',
          width: '100%', maxWidth: 340,
          opacity: loading ? 0.7 : 1
        }}
      >
        {loading ? 'Saving...' : 'Start Playing →'}
      </button>
    </div>
  )
}

// Calculate perceptual distance between two hex colors
// Returns 0-100, where lower = more similar
function colorDistance(hex1, hex2) {
  const r1 = parseInt(hex1.slice(1, 3), 16)
  const g1 = parseInt(hex1.slice(3, 5), 16)
  const b1 = parseInt(hex1.slice(5, 7), 16)
  const r2 = parseInt(hex2.slice(1, 3), 16)
  const g2 = parseInt(hex2.slice(3, 5), 16)
  const b2 = parseInt(hex2.slice(5, 7), 16)

  return Math.sqrt(
    Math.pow(r1 - r2, 2) * 0.3 +
    Math.pow(g1 - g2, 2) * 0.59 +
    Math.pow(b1 - b2, 2) * 0.11
  )
}