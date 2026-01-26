import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AITradersPage } from '../components/AITradersPage'
import { CompetitionPage } from '../components/CompetitionPage'
import { LoginPage } from '../components/LoginPage'
import { RegisterPage } from '../components/RegisterPage'
import { ResetPasswordPage } from '../components/ResetPasswordPage'
import AuthLayout from '../layouts/AuthLayout'
import MainLayout from '../layouts/MainLayout'
import { ProfilePage } from '../pages/ProfilePage'
import { RootRedirect } from '../pages/RootRedirect'
import TraderDashboard from '../pages/TraderDashboard'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootRedirect />,
  },
  // Auth routes - using AuthLayout
  {
    element: <AuthLayout />,
    children: [
      {
        path: '/login',
        element: <LoginPage />,
      },
      {
        path: '/register',
        element: <RegisterPage />,
      },
      {
        path: '/reset-password',
        element: <ResetPasswordPage />,
      },
    ],
  },
  // Main app routes - using MainLayout with nested routes
  {
    element: <MainLayout />,
    children: [
      {
        path: '/competition',
        element: <CompetitionPage />,
      },
      {
        path: '/traders',
        element: <AITradersPage />,
      },
      {
        path: '/dashboard',
        element: <TraderDashboard />,
      },
      {
        path: '/profile',
        element: <ProfilePage />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])
