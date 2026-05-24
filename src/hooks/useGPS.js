import { useState, useEffect, useRef } from 'react'

const GRID_SIZE = 0.00027
const SNAP_THRESHOLD = 5

function toRad(deg) { return deg * (Math.PI / 180) }

function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat/2)**2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

function snapToGrid(lat, lng) {
  const snappedLat = Math.round(lat / GRID_SIZE) * GRID_SIZE
  const snappedLng = Math.round(lng / GRID_SIZE) * GRID_SIZE
  const dist = getDistance(lat, lng, snappedLat, snappedLng)
  if (dist <= SNAP_THRESHOLD) {
    return { lat: snappedLat, lng: snappedLng, snapped: true }
  }
  return { lat, lng, snapped: false }
}

export { getDistance, GRID_SIZE }

export function useGPS() {
  const [position, setPosition] = useState(null)
  const [path, setPath] = useState([])
  const [isRecording, setIsRecording] = useState(false)
  const [error, setError] = useState(null)
  const watchId = useRef(null)
  const isRecordingRef = useRef(false)
  const lastPos = useRef(null)

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('GPS not supported')
      return
    }

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, speed, accuracy } = pos.coords

        // Ignore very inaccurate readings (desktop IP location)
        if (accuracy > 200) {
          setError(`GPS accuracy too low (${Math.round(accuracy)}m). Use a phone or move outside.`)
          return
        }

        setError(null)

        // Anti-cheat: speed cap 18 km/h
        if (speed && speed > 5) return

        // Ignore micro-jitter under 1m
        if (lastPos.current) {
          const d = getDistance(lastPos.current.lat, lastPos.current.lng, lat, lng)
          if (d < 1) return
        }

        const snapped = snapToGrid(lat, lng)
        lastPos.current = snapped
        setPosition(snapped)

        // Only add to path if actively recording
        if (isRecordingRef.current) {
          setPath(prev => [...prev, snapped])
        }
      },
      (err) => {
        if (err.code === 1) setError('GPS permission denied. Please allow location access.')
        else if (err.code === 2) setError('GPS unavailable. Try outside.')
        else setError('GPS timeout. Move to open area.')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )

    return () => {
      if (watchId.current) navigator.geolocation.clearWatch(watchId.current)
    }
  }, []) // ← empty array: start watch ONCE only

  const startRecording = (currentPos) => {
    isRecordingRef.current = true
    setIsRecording(true)
    setPath(currentPos ? [currentPos] : [])
  }

  const stopRecording = () => {
    isRecordingRef.current = false
    setIsRecording(false)
  }

  const resetPath = () => setPath([])

  return { position, path, isRecording, error, startRecording, stopRecording, resetPath }
}