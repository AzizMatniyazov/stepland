import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { useGPS, GRID_SIZE } from '../hooks/useGPS'
import { supabase } from '../lib/supabase'
import { requestWakeLock } from '../main.jsx'
import { useLanguage } from '../lib/LanguageContext'
import { LANGUAGES } from '../lib/i18n'
import Leaderboard from './Leaderboard'
import Profile from './Profile'

const GRID_DEGREES = GRID_SIZE

function drawGrid(map) {
  const bounds = map.getBounds()
  const minLat = bounds.getSouth() - GRID_DEGREES
  const maxLat = bounds.getNorth() + GRID_DEGREES
  const minLng = bounds.getWest() - GRID_DEGREES
  const maxLng = bounds.getEast() + GRID_DEGREES

  const startLat = Math.floor(minLat / GRID_DEGREES) * GRID_DEGREES
  const startLng = Math.floor(minLng / GRID_DEGREES) * GRID_DEGREES

  const lines = []
  for (let lat = startLat; lat <= maxLat; lat += GRID_DEGREES) {
    lines.push(L.polyline([[lat, minLng], [lat, maxLng]], {
      color: '#ffffff', weight: 0.8, opacity: 0.25
    }))
  }
  for (let lng = startLng; lng <= maxLng; lng += GRID_DEGREES) {
    lines.push(L.polyline([[minLat, lng], [maxLat, lng]], {
      color: '#ffffff', weight: 0.8, opacity: 0.25
    }))
  }
  return lines
}

export default function GameMap() {
  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const playerMarker = useRef(null)
  const pathPolyline = useRef(null)
  const territoriesLayer = useRef(null)
  const gridLayer = useRef(null)
  const wakeLockRef = useRef(null)
  const radarMarkersRef = useRef({})

  const { position, path, isRecording, error, startRecording, stopRecording, resetPath } = useGPS()
  const { lang, setLang, t } = useLanguage()
  const [statusMsg, setStatusMsg] = useState('')
  const [score, setScore] = useState(0)
  const [blockCount, setBlockCount] = useState(0)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [userId, setUserId] = useState(null)

  useEffect(() => {
    setStatusMsg(t.waitingGPS)
  }, [t])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, [])

  useEffect(() => {
    if (mapInstance.current) return

    mapInstance.current = L.map(mapRef.current, {
      center: [41.2995, 69.2401],
      zoom: 17,
      zoomControl: true
    })

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
      crossOrigin: true
    }).addTo(mapInstance.current)

    territoriesLayer.current = L.layerGroup().addTo(mapInstance.current)
    gridLayer.current = L.layerGroup().addTo(mapInstance.current)

    mapInstance.current.on('moveend zoomend', () => {
      gridLayer.current.clearLayers()
      const lines = drawGrid(mapInstance.current)
      lines.forEach(l => l.addTo(gridLayer.current))
      loadTerritories()
    })

    loadTerritories()
    loadScore()
  }, [])

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isRecording && !wakeLockRef.current) {
        wakeLockRef.current = await requestWakeLock()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isRecording])

  // Auto refresh score every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadScore()
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!position || !mapInstance.current) return

    setStatusMsg(isRecording
      ? `🔴 ${t.recording} — ${path.length}`
      : t.gpsLocked)

    if (!playerMarker.current) {
      const selfIcon = L.divIcon({
        className: '',
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;">
            <div style="font-size:24px;animation:walk 0.4s infinite alternate;">🚶</div>
            <div style="background:#00FF88;color:#000;font-size:10px;font-weight:bold;padding:2px 6px;border-radius:10px;white-space:nowrap;margin-top:2px;box-shadow:0 2px 6px rgba(0,255,136,0.4);">You</div>
          </div>
        `,
        iconSize: [40, 50],
        iconAnchor: [20, 45]
      })

      playerMarker.current = L.marker(
        [position.lat, position.lng],
        { icon: selfIcon, zIndexOffset: 1000 }
      ).addTo(mapInstance.current)

      gridLayer.current.clearLayers()
      const lines = drawGrid(mapInstance.current)
      lines.forEach(l => l.addTo(gridLayer.current))
    } else {
      playerMarker.current.setLatLng([position.lat, position.lng])
    }

    if (isRecording && path.length > 1) {
      const latLngs = path.map(p => [p.lat, p.lng])
      if (!pathPolyline.current) {
        pathPolyline.current = L.polyline(latLngs, {
          color: '#00FF88', weight: 3, opacity: 0.9, dashArray: '6,4'
        }).addTo(mapInstance.current)
      } else {
        pathPolyline.current.setLatLngs(latLngs)
      }
    }
  }, [position, path, isRecording, t])

  useEffect(() => {
    if (!position || !userId) return
    const broadcastLocation = async () => {
      const { data: profile } = await supabase
        .from('profiles').select('username, color').eq('id', userId).single()
      await supabase.from('player_locations').upsert({
        user_id: userId, lat: position.lat, lng: position.lng,
        username: profile?.username || 'Player',
        color: profile?.color || '#FF5733',
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })
    }
    broadcastLocation()
  }, [position, userId])

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel('player-locations')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'player_locations'
      }, (payload) => {
        if (!mapInstance.current) return
        const p = payload.new || payload.old
        if (!p || p.user_id === userId) return

        if (radarMarkersRef.current[p.user_id]) {
          radarMarkersRef.current[p.user_id].remove()
          delete radarMarkersRef.current[p.user_id]
        }
        if (payload.eventType === 'DELETE') return

        const playerIcon = L.divIcon({
          className: '',
          html: `
            <div style="display:flex;flex-direction:column;align-items:center;animation:bounce 0.6s infinite alternate;">
              <div style="font-size:22px;animation:walk 0.4s infinite alternate;">🚶</div>
              <div style="background:${p.color || '#FF5733'};color:#fff;font-size:10px;font-weight:bold;padding:2px 6px;border-radius:10px;white-space:nowrap;margin-top:2px;box-shadow:0 2px 4px rgba(0,0,0,0.3);">${p.username}</div>
            </div>
          `,
          iconSize: [40, 50],
          iconAnchor: [20, 45]
        })

        radarMarkersRef.current[p.user_id] = L.marker(
          [p.lat, p.lng], { icon: playerIcon }
        ).addTo(mapInstance.current)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      Object.values(radarMarkersRef.current).forEach(m => m.remove())
      radarMarkersRef.current = {}
    }
  }, [userId])

  function centerOnPlayer() {
    if (position && mapInstance.current) {
      mapInstance.current.setView([position.lat, position.lng], 18)
    }
  }

  async function loadScore() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('profiles')
      .select('total_score, last_score_updated_at').eq('id', user.id).single()
    const { count } = await supabase.from('territories')
      .select('*', { count: 'exact', head: true }).eq('controller_id', user.id)
    if (data) {
      const minutesHeld = (Date.now() - new Date(data.last_score_updated_at).getTime()) / 60000
      const liveScore = Math.floor((data.total_score || 0) + (minutesHeld * (count || 0)))
      setScore(liveScore)
      setBlockCount(count || 0)
    }
  }

  async function loadTerritories() {
    const { data, error } = await supabase
      .from('territories_view')
      .select('grid_id, lat, lng, color, controller_id')

    if (error) { console.error('Territory load error:', error); return }
    if (!data || data.length === 0) return

    territoriesLayer.current.clearLayers()

    const H = GRID_DEGREES / 2
    data.forEach(t => {
      if (!t.lat || !t.lng) return
      const color = t.color || '#FF5733'

      const rect = L.rectangle(
        [[t.lat - H, t.lng - H], [t.lat + H, t.lng + H]],
        { color, fillColor: color, fillOpacity: 0.5, weight: 1 }
      )

      rect.on('click', async () => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, total_score')
          .eq('id', t.controller_id)
          .single()

        if (profile) {
          rect.bindPopup(`
            <div style="text-align:center;padding:4px">
              <div style="font-weight:bold;font-size:15px;color:${color}">■ ${profile.username}</div>
              <div style="color:#aaa;font-size:12px;margin-top:4px">${Math.floor(profile.total_score || 0).toLocaleString()} pts</div>
              <div style="color:#888;font-size:11px;margin-top:2px">+1 pt/min</div>
            </div>
          `).openPopup()
        }
      })

      rect.addTo(territoriesLayer.current)
    })
  }

  async function handleClose() {
    if (path.length < 4) { setStatusMsg(t.loopTooSmall); return }

    const completedPath = [...path]
    stopRecording()

    if (wakeLockRef.current) { wakeLockRef.current.release(); wakeLockRef.current = null }

    const coordinates = completedPath.map(p => [p.lng, p.lat])
    coordinates.push(coordinates[0])

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setStatusMsg(t.mustLogin); return }

    setStatusMsg(t.capturing)

    const { data, error } = await supabase.rpc('capture_blocks_in_polygon', {
      loop_coordinates: coordinates,
      capturing_user_id: user.id
    })

    if (error) {
      setStatusMsg(t.captureFailed)
      console.error(error)
      return
    }

    const captured = data?.length || 0
    setStatusMsg(`✅ ${captured} ${t.captured}`)

    if (pathPolyline.current) { pathPolyline.current.remove(); pathPolyline.current = null }

    await supabase.rpc('update_player_score', {
      player_id: user.id,
      blocks_captured: captured
    })

    resetPath()
    loadTerritories()
    loadScore()
  }

  function handleCancel() {
    stopRecording()
    resetPath()
    if (pathPolyline.current) { pathPolyline.current.remove(); pathPolyline.current = null }
    if (wakeLockRef.current) { wakeLockRef.current.release(); wakeLockRef.current = null }
    setStatusMsg(t.cancelled)
  }

  async function handleLogout() {
    if (userId) await supabase.from('player_locations').delete().eq('user_id', userId)
    await supabase.auth.signOut()
  }

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100vw' }}>
      <div ref={mapRef} style={{ height: '100vh', width: '100vw', position: 'absolute', top: 0, left: 0 }} />

      {error && (
        <div style={{
          position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
          background: '#FF4444', color: '#fff', padding: '8px 16px',
          borderRadius: 8, zIndex: 1000, fontSize: 13, maxWidth: '90vw', textAlign: 'center'
        }}>
          ⚠️ {t.gpsLow}. {t.usePhone}
        </div>
      )}

      <div style={{
        position: 'absolute', top: error ? 56 : 16, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.75)', color: '#fff',
        padding: '8px 20px', borderRadius: 20, zIndex: 1000, fontSize: 14, whiteSpace: 'nowrap'
      }}>
        {statusMsg}
      </div>

      {/* My score — top left, small */}
      <div style={{
        position: 'absolute', top: 16, left: 16,
        background: 'rgba(0,0,0,0.82)', color: '#fff',
        padding: '8px 14px', borderRadius: 12,
        zIndex: 1000, fontSize: 13, lineHeight: 1.6
      }}>
        <div style={{ color: '#00FF88', fontWeight: 'bold', fontSize: 15 }}>
          {score.toLocaleString()} {t.points}
        </div>
        <div style={{ color: '#aaa', fontSize: 11 }}>
          {blockCount} {t.blocksOwned}
        </div>
      </div>

      <button onClick={centerOnPlayer} style={{
        position: 'absolute', top: 16, right: 16,
        background: 'rgba(0,0,0,0.75)', color: '#fff',
        border: 'none', borderRadius: 8, padding: '10px 14px',
        fontSize: 20, cursor: 'pointer', zIndex: 1000
      }}>🎯</button>

      <button onClick={() => setShowProfile(true)} style={{
        position: 'absolute', top: 70, right: 16,
        background: 'rgba(0,0,0,0.75)', color: '#fff',
        border: 'none', borderRadius: 8, padding: '10px 14px',
        fontSize: 20, cursor: 'pointer', zIndex: 1000
      }}>👤</button>

      <button onClick={() => setShowLeaderboard(true)} style={{
        position: 'absolute', top: 124, right: 16,
        background: 'rgba(0,0,0,0.75)', color: '#FFD700',
        border: 'none', borderRadius: 8, padding: '10px 14px',
        fontSize: 20, cursor: 'pointer', zIndex: 1000
      }}>🏆</button>

      <button onClick={handleLogout} style={{
        position: 'absolute', top: 178, right: 16,
        background: 'rgba(0,0,0,0.75)', color: '#aaa',
        border: 'none', borderRadius: 8, padding: '8px 12px',
        fontSize: 12, cursor: 'pointer', zIndex: 1000
      }}>{t.logout}</button>

      <div style={{
        position: 'absolute', bottom: 110, right: 16,
        display: 'flex', flexDirection: 'column', gap: 6, zIndex: 1000
      }}>
        {LANGUAGES.map(l => (
          <button key={l.code} onClick={() => setLang(l.code)} style={{
            background: lang === l.code ? '#00FF88' : 'rgba(0,0,0,0.75)',
            color: lang === l.code ? '#000' : '#fff',
            border: 'none', borderRadius: 8,
            padding: '6px 10px', cursor: 'pointer',
            fontSize: 12, fontWeight: 'bold'
          }}>
            {l.flag} {l.label}
          </button>
        ))}
      </div>

      <div style={{
        position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 12, zIndex: 1000
      }}>
        {!isRecording ? (
          <button onClick={async () => {
            startRecording(position)
            setStatusMsg(t.recordingStarted)
            wakeLockRef.current = await requestWakeLock()
          }} style={btn('#00FF88', '#000')}>
            {t.start}
          </button>
        ) : (
          <>
            <button onClick={handleClose} style={btn('#FFD700', '#000')}>{t.closeLoop}</button>
            <button onClick={handleCancel} style={btn('#FF4444', '#fff')}>{t.cancel}</button>
          </>
        )}
      </div>

      {showLeaderboard && <Leaderboard onClose={() => setShowLeaderboard(false)} />}
      {showProfile && userId && <Profile userId={userId} onClose={() => setShowProfile(false)} />}
    </div>
  )
}

function btn(bg, color) {
  return {
    background: bg, color, border: 'none',
    padding: '14px 28px', borderRadius: 30,
    fontSize: 16, fontWeight: 'bold',
    cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
  }
}