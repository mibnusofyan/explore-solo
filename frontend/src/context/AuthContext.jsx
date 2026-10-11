import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { auth } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  // Sesi disimpan server dalam cookie httpOnly; di sini cukup tanyakan siapa yang sedang masuk.
  useEffect(() => {
    auth
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setReady(true))
  }, [])

  const login = useCallback(async (email, password) => {
    const u = await auth.login(email, password)
    setUser(u)
    return u
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    auth.logout().catch(() => {})
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
