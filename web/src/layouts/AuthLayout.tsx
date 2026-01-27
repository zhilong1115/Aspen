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
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <nav className="fixed top-0 w-full z-50 bg-black/90 backdrop-blur-md border-b border-neutral-900">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16 px-6">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <img src="/icons/aspen.svg" alt="Aspen" className="w-8 h-8" />
            <span className="font-bold text-xl tracking-tighter text-white">
              Aspen
            </span>
          </Link>

          {/* Language Selector */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
              className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors border border-neutral-700 text-gray-300 hover:border-neutral-500 hover:text-white"
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
