import { AnimatePresence } from 'framer-motion'
import { ReactNode } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Container } from '../components/Container'
import { PageTransition } from '../components/ui/PageTransition'
import { useLanguage } from '../contexts/LanguageContext'

interface AuthLayoutProps {
  children?: ReactNode
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  const { language, setLanguage } = useLanguage()
  const location = useLocation()

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text-primary)]">
      {/* Simple Header with Logo and Language Selector */}
      <nav className="fixed top-0 w-full z-50 bg-[var(--surface)]/95 backdrop-blur-sm border-b border-[var(--border-light)]">
        <Container className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <img src="/icons/nofx.svg" alt="NOFX Logo" className="w-8 h-8" />
            <span className="text-xl font-bold text-[var(--google-blue)]">
              NOFX
            </span>
          </Link>

          {/* Language Selector */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
              className="px-3 py-1.5 rounded text-sm font-medium transition-colors btn-outline"
            >
              {language === 'zh' ? 'English' : '中文'}
            </button>
          </div>
        </Container>
      </nav>

      {/* Content with top padding to avoid overlap with fixed header */}
      <div className="pt-16">
        <AnimatePresence mode="wait">
          <PageTransition key={location.pathname}>
            {children || <Outlet />}
          </PageTransition>
        </AnimatePresence>
      </div>
    </div>
  )
}
