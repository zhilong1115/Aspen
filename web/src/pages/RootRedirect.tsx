import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function RootRedirect() {
  const { user } = useAuth()
  return <Navigate to={user ? '/portfolio' : '/login'} replace />
}
