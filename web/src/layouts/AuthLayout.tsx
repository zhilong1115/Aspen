import { AnimatePresence } from 'framer-motion'

import { ReactNode } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
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
      {/* Header */}
      <nav className="fixed top-0 w-full z-50 bg-[var(--background)]/90 backdrop-blur-md border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16 px-6">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <img src="/icons/aspen.svg" alt="Aspen" className="w-8 h-8" />
            <span className="font-bold text-xl tracking-tighter text-[var(--text-primary)]">
              Aspen
            </span>
          </Link>

          {/* Language Selector */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
              className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            >
              {language === 'zh' ? 'English' : '中文'}
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
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
