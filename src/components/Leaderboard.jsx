import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Leaderboard({ onClose }) {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadLeaderboard()
  }, [])

  async function loadLeaderboard() {
    const { data, error } = await supabase.rpc('get_leaderboard')
    if (error) { console.error(error); return }
    setPlayers(data || [])
    setLoading(false)
  }

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.92)',
      zIndex: 2000, display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '24px 16px',
      overflowY: 'auto'
    }}>
      {/* Header */}
      <div style={{
        width: '100%', maxWidth: 480,
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 24
      }}>
        <h1 style={{ color: '#fff', fontSize: 24, margin: 0 }}>
          🏆 Leaderboard
        </h1>
        <button onClick={onClose} style={{
          background: 'none', border: '1px solid #444',
          color: '#fff', borderRadius: 8,
          padding: '8px 16px', cursor: 'pointer', fontSize: 14
        }}>
          ✕ Close
        </button>
      </div>

      {/* Season info */}
      <div style={{
        width: '100%', maxWidth: 480,
        background: '#1a1a1a', borderRadius: 12,
        padding: '12px 16px', marginBottom: 20,
        color: '#888', fontSize: 13, textAlign: 'center'
      }}>
        🗓️ Season resets on the 1st of every month
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ color: '#888', marginTop: 40 }}>Loading...</div>
      )}

      {/* Player list */}
      {!loading && players.length === 0 && (
        <div style={{ color: '#888', marginTop: 40 }}>
          No players yet. Go capture some blocks!
        </div>
      )}

      {!loading && players.map((player, i) => (
        <div key={i} style={{
          width: '100%', maxWidth: 480,
          background: i === 0 ? '#1a2a1a' : '#111',
          border: `1px solid ${i === 0 ? '#00FF88' : '#222'}`,
          borderRadius: 12, padding: '14px 16px',
          marginBottom: 10, display: 'flex',
          alignItems: 'center', gap: 12
        }}>
          {/* Rank */}
          <div style={{
            fontSize: i < 3 ? 24 : 16,
            width: 36, textAlign: 'center',
            color: '#888', fontWeight: 'bold'
          }}>
            {i < 3 ? medals[i] : `#${player.rank}`}
          </div>

          {/* Color dot */}
          <div style={{
            width: 12, height: 12, borderRadius: '50%',
            background: player.color || '#FF5733',
            flexShrink: 0
          }} />

          {/* Name and blocks */}
          <div style={{ flex: 1 }}>
            <div style={{
              color: '#fff', fontWeight: 'bold', fontSize: 15
            }}>
              {player.username}
            </div>
            <div style={{ color: '#888', fontSize: 12 }}>
              {player.block_count} blocks owned
            </div>
          </div>

          {/* Score */}
          <div style={{
            color: '#00FF88', fontWeight: 'bold', fontSize: 16
          }}>
            {Number(player.total_score).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  )
}