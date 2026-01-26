import { RouterProvider } from 'react-router-dom'
import { ConfirmDialogProvider } from './components/ConfirmDialog'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { LanguageProvider, useLanguage } from './contexts/LanguageContext'
import { useSystemConfig } from './hooks/useSystemConfig'
import { t } from './i18n/translations'
import { router } from './routes'

function LoadingScreen() {
  const { language } = useLanguage()

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-center">
        <div className="w-16 h-16 bg-[#00C805] rounded-2xl mx-auto mb-4 flex items-center justify-center animate-pulse">
          <span className="text-black text-2xl font-bold">A</span>
        </div>
        <p className="text-white">{t('loading', language)}</p>
      </div>
    </div>
  )
}

function AppContent() {
  const { isLoading } = useAuth()
  const { loading: configLoading } = useSystemConfig()

  // Show loading spinner while checking auth or config
  if (isLoading || configLoading) {
    return <LoadingScreen />
  }

  return <RouterProvider router={router} />
}

import { ThemeProvider } from './contexts/ThemeContext'

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <ConfirmDialogProvider>
          <ThemeProvider>
            <AppContent />
          </ThemeProvider>
        </ConfirmDialogProvider>
      </AuthProvider>
    </LanguageProvider>
  )
}
