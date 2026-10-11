import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { auth } from '../services/api'

const SESSION_KEY = 'explore-solo:session'
const AuthContext = createContext(null)

function readSession() {
  try {
    return localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

function writeSession(id) {
  try {
    if (id) localStorage.setItem(SESSION_KEY, id)
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    // Abaikan: sesi hanya bertahan di memori.
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(() => !readSession())

  useEffect(() => {
    const id = readSession()
    if (!id) return
    auth.me(id).then((u) => {
      if (!u) writeSession(null)
      setUser(u)
      setReady(true)
    })
  }, [])

  const login = useCallback(async (email, password) => {
    const u = await auth.login(email, password)
    writeSession(u.id)
    setUser(u)
    return u
  }, [])

  const logout = useCallback(() => {
    writeSession(null)
    setUser(null)
  }, [])

  const refresh = useCallback((u) => setUser(u), [])

  const value = useMemo(() => ({ user, ready, login, logout, refresh }), [user, ready, login, logout, refresh])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}

// eslint-disable-next-line react-refresh/only-export-components
export function homePathFor(user) {
  if (user?.role === 'admin') return '/admin'
  if (user?.role === 'pengelola') return '/pengelola'
  return '/'
}
