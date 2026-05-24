import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import GameMap from './components/GameMap'
import Auth from './components/Auth'
import Onboarding from './components/Onboarding'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) checkOnboarding(session.user.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        if (session) checkOnboarding(session.user.id)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function checkOnboarding(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('username, color')
      .eq('id', userId)
      .single()

    // Needs onboarding if username is auto-generated or color is default
    if (!data || data.username.startsWith('Player_') || !data.color) {
      setNeedsOnboarding(true)
    } else {
      setNeedsOnboarding(false)
    }
  }

  if (loading) return (
    <div style={{
      height: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: '#0a0a0a', color: '#fff', fontSize: 18
    }}>
      Loading...
    </div>
  )

  if (!session) return <Auth />

  if (needsOnboarding) return (
    <Onboarding
      userId={session.user.id}
      onComplete={() => setNeedsOnboarding(false)}
    />
  )

  return <GameMap session={session} />
}