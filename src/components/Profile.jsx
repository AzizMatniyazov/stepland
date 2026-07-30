import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function colorDistance(hex1, hex2) {
  if (!hex1 || !hex2) return 100
  const r1 = parseInt(hex1.slice(1,3),16), g1 = parseInt(hex1.slice(3,5),16), b1 = parseInt(hex1.slice(5,7),16)
  const r2 = parseInt(hex2.slice(1,3),16), g2 = parseInt(hex2.slice(3,5),16), b2 = parseInt(hex2.slice(5,7),16)
  return Math.sqrt(Math.pow(r1-r2,2)*0.3 + Math.pow(g1-g2,2)*0.59 + Math.pow(b1-b2,2)*0.11)
}

const BAD_WORDS = [
  'fuck', 'shit', 'bitch', 'dick', 'pussy', 'cock', 'cunt', 'nigger', 'nigga',
  'faggot', 'fag', 'whore', 'slut', 'bastard', 'piss', 'crap', 'asshole',
  'хуй', 'пизда', 'блядь', 'ебать', 'сука', 'пиздец', 'залупа', 'мудак',
  'ублюдок', 'шлюха', 'еблан', 'пиздюк', 'хуйня', 'бля', 'блять', 'пидор', 'пидар',
  'qotgan', 'orospu', 'harom', 'ahmoq', 'tentak', 'sikdir', 'sik', 'amak',
  'gay', 'lesbian', 'trans', 'queer', 'lgbt', 'lgbtq', 'homo', 'bisex',
  'гей', 'лесби', 'транс', 'гомик', 'педик',
  'gey', 'gomosek', 'lesbiyan'
]

function containsBadWord(text) {
  const lower = text.toLowerCase()
  return BAD_WORDS.some(word => lower.includes(word))
}

export default function Profile({ userId, onClose }) {
  const [profile, setProfile] = useState(null)
  const [blockCount, setBlockCount] = useState(0)
  const [hallOfFame, setHallOfFame] = useState([])
  const [newUsername, setNewUsername] = useState('')
  const [newColor, setNewColor] = useState('#00FF88')
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => { loadProfile() }, [])

  async function loadProfile() {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (data) {
      setProfile(data)
      setNewUsername(data.username)
      setNewColor(data.color || '#00FF88')
    }

    const { count } = await supabase
      .from('territories')
      .select('*', { count: 'exact', head: true })
      .eq('controller_id', userId)
    setBlockCount(count || 0)

    const { data: fame } = await supabase
      .from('hall_of_fame')
      .select('*')
      .eq('user_id', userId)
      .order('archived_at', { ascending: false })
      .limit(5)
    setHallOfFame(fame || [])
  }

  async function handleSave() {
    setLoading(true); setError(''); setSuccess('')

    if (!newUsername.trim() || newUsername.trim().length < 3) {
      setError('Username must be at least 3 characters')
      setLoading(false); return
    }

    if (containsBadWord(newUsername.trim())) {
      setError('This username is not allowed. Please choose a different one.')
      setLoading(false); return
    }

    const { data: existing } = await supabase
      .from('profiles').select('id')
      .eq('username', newUsername.trim()).neq('id', userId).single()

    if (existing) { setError('Username already taken'); setLoading(false); return }

    const { data: profiles } = await supabase
      .from('profiles').select('color').neq('id', userId)

    if (profiles) {
      const tooSimilar = profiles.some(p => colorDistance(newColor, p.color) < 15)
      if (tooSimilar) {
        setError('Color too similar to another player. Pick a different shade.')
        setLoading(false); return
      }
    }

    const { error } = await supabase
      .from('profiles')
      .update({ username: newUsername.trim(), color: newColor })
      .eq('id', userId)

    if (error) { setError('Failed to save. Try again.') }
    else { setSuccess('Profile updated!'); setEditing(false); loadProfile() }
    setLoading(false)
  }

  if (!profile) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
      Loading...
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 2000, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px', overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 480, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ color: '#fff', fontSize: 24, margin: 0 }}>👤 Profile</h1>
        <button onClick={onClose} style={{ background: 'none', border: '1px solid #444', color: '#fff', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 14 }}>✕ Close</button>
      </div>

      <div style={{ width: '100%', maxWidth: 480, background: '#111', borderRadius: 16, padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 12, background: profile.color || '#FF5733', border: '3px solid #333' }} />
          <div>
            <div style={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}>{profile.username}</div>
            <div style={{ color: '#888', fontSize: 13 }}>{profile.color}</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ background: '#1a1a1a', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ color: '#00FF88', fontSize: 20, fontWeight: 'bold' }}>{Math.floor(profile.total_score || 0).toLocaleString()}</div>
            <div style={{ color: '#888', fontSize: 12 }}>Total points</div>
          </div>
          <div style={{ background: '#1a1a1a', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ color: '#FFD700', fontSize: 20, fontWeight: 'bold' }}>{blockCount}</div>
            <div style={{ color: '#888', fontSize: 12 }}>Blocks owned</div>
          </div>
        </div>
      </div>

      {hallOfFame.length > 0 && (
        <div style={{ width: '100%', maxWidth: 480, background: '#111', borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <h3 style={{ color: '#FFD700', margin: '0 0 12px 0', fontSize: 16 }}>🏆 Hall of Fame History</h3>
          {hallOfFame.map((entry, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #222', color: '#fff', fontSize: 14 }}>
              <span>Season {entry.season}</span>
              <span style={{ color: '#aaa' }}>Rank #{entry.rank}</span>
              <span style={{ color: '#00FF88' }}>{Math.floor(entry.score).toLocaleString()} pts</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ width: '100%', maxWidth: 480, background: '#111', borderRadius: 16, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ color: '#fff', margin: 0, fontSize: 16 }}>Edit Profile</h3>
          {!editing && (
            <button onClick={() => setEditing(true)} style={{ background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13 }}>Edit</button>
          )}
        </div>

        {editing && (
          <>
            <label style={{ color: '#aaa', fontSize: 13, display: 'block', marginBottom: 6 }}>Username</label>
            <input value={newUsername} onChange={e => setNewUsername(e.target.value)} maxLength={20}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #333', background: '#1a1a1a', color: '#fff', fontSize: 14, marginBottom: 16, boxSizing: 'border-box' }} />

            <label style={{ color: '#aaa', fontSize: 13, display: 'block', marginBottom: 8 }}>Territory Color</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)}
                style={{ width: 50, height: 50, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'none', padding: 0 }} />
              <div style={{ width: 100, height: 36, borderRadius: 6, background: newColor }} />
              <span style={{ color: '#888', fontSize: 12 }}>{newColor}</span>
            </div>

            {error && <p style={{ color: '#FF4444', fontSize: 13, margin: '0 0 12px 0' }}>{error}</p>}
            {success && <p style={{ color: '#00FF88', fontSize: 13, margin: '0 0 12px 0' }}>{success}</p>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleSave} disabled={loading} style={{ flex: 1, background: '#00FF88', color: '#000', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 'bold', cursor: 'pointer' }}>
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
              <button onClick={() => { setEditing(false); setError('') }} style={{ flex: 1, background: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: 10, padding: '12px', fontSize: 14, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}