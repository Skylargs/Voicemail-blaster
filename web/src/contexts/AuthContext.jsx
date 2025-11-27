import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [onboarding, setOnboarding] = useState({
    loading: true,
    onboardingCompleted: false,
    steps: {
      business: false,
      twilio: false,
      voicemail: false,
      campaign: false,
      leads: false,
      blast: false
    }
  })

  useEffect(() => {
    checkAuth()
  }, [])

  const fetchOnboarding = async () => {
    try {
      const res = await fetch('/onboarding/state', {
        credentials: 'include'
      })
      if (!res.ok) {
        throw new Error('Failed to fetch onboarding state')
      }
      const data = await res.json()
      setOnboarding(prev => ({
        loading: false,
        onboardingCompleted: data.onboardingCompleted,
        steps: data.steps || prev.steps
      }))
    } catch (err) {
      console.error('Error loading onboarding state:', err)
      setOnboarding(prev => ({
        ...prev,
        loading: false
      }))
    }
  }

  async function checkAuth() {
    try {
      const response = await fetch('/auth/me', {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
        await fetchOnboarding()
      } else {
        setUser(null)
        setOnboarding(prev => ({
          ...prev,
          loading: false
        }))
      }
    } catch (err) {
      console.error('Error checking session:', err)
      setUser(null)
      setOnboarding(prev => ({
        ...prev,
        loading: false
      }))
    } finally {
      setLoading(false)
    }
  }

  async function login(email, password) {
    const response = await fetch('/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    })

    if (response.ok) {
      const data = await response.json()
      setUser(data.user)
      await fetchOnboarding()
      return { success: true, user: data.user }
    } else {
      const data = await response.json()
      return { success: false, error: data.error || 'Login failed' }
    }
  }

  async function register(email, password) {
    const response = await fetch('/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    })

    if (response.ok) {
      const data = await response.json()
      setUser(data.user)
      await fetchOnboarding()
      return { success: true, user: data.user }
    } else {
      const data = await response.json()
      return { success: false, error: data.error || 'Registration failed' }
    }
  }

  async function logout() {
    try {
      await fetch('/auth/logout', {
        method: 'POST',
        credentials: 'include'
      })
    } catch (err) {
      console.error('Logout error:', err)
    }
    setUser(null)
    setOnboarding({
      loading: false,
      onboardingCompleted: false,
      steps: {
        business: false,
        twilio: false,
        voicemail: false,
        campaign: false,
        leads: false,
        blast: false
      }
    })
  }

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      onboarding,
      setOnboarding,
      refreshOnboarding: async () => {
        try {
          const res = await fetch('/onboarding/state', { credentials: 'include' })
          if (!res.ok) return
          const data = await res.json()
          setOnboarding(prev => ({
            loading: false,
            onboardingCompleted: data.onboardingCompleted,
            steps: data.steps || prev.steps
          }))
        } catch (err) {
          console.error('Error refreshing onboarding state:', err)
        }
      },
      login,
      register,
      logout,
      checkAuth
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}


