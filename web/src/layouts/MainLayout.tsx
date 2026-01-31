import { AnimatePresence } from 'framer-motion'
import { Brain, User, Users, Wallet } from 'lucide-react'
import { ReactNode, useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { PageTransition } from '../components/ui/PageTransition'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { t } from '../i18n/translations'

interface MainLayoutProps {
  children?: ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
  const { language } = useLanguage()
  const { user: _user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  )

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const isActive = (path: string) => location.pathname === path

  return (
    <div className="min-h-screen w-full bg-[var(--background)] text-[var(--text-primary)] font-sans flex flex-col">
      {/* Top Navigation */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isDesktop
            ? 'bg-[var(--background)]/90 backdrop-blur-md h-20 border-b border-[var(--border)]'
            : 'bg-[var(--background)] h-14'
        }`}
      >
        <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <img src="/icons/aspen.svg" alt="Aspen" className="w-8 h-8" />
            <span className="font-bold text-xl tracking-tighter hidden md:block text-[var(--text-primary)]">
              Aspen
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <NavBtn
              label={t('portfolio', language) || 'Portfolio'}
              active={isActive('/portfolio')}
              onClick={() => navigate('/portfolio')}
            />
            <NavBtn
              label={t('aiStrategyNav', language)}
              active={isActive('/traders')}
              onClick={() => navigate('/traders')}
            />
            <NavBtn
              label={t('communityNav', language)}
              active={isActive('/community')}
              onClick={() => navigate('/community')}
            />
            <NavBtn
              label={t('profile', language) || 'Profile'}
              active={isActive('/profile')}
              onClick={() => navigate('/profile')}
            />
          </div>

          {/* Mobile Profile Icon */}
          {!isDesktop && (
            <button
              onClick={() => navigate('/profile')}
              className="p-2"
            >
              <User
                size={24}
                className={
                  isActive('/profile') ? 'text-[#00C805]' : 'text-[var(--text-primary)]'
                }
              />
            </button>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main
        className={`flex-1 ${isDesktop ? 'mt-20' : 'mt-14'} ${!isDesktop ? 'mb-20' : ''} overflow-y-auto`}
      >
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <AnimatePresence mode="wait">
            <PageTransition key={location.pathname}>
              {children || <Outlet />}
            </PageTransition>
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      {!isDesktop && (
        <div className="fixed bottom-0 left-0 right-0 bg-[var(--surface)]/95 backdrop-blur-xl border-t border-[var(--border)] pb-safe pt-2 z-50">
          <div className="flex justify-around items-center h-16">
            <MobNavBtn
              icon={<Wallet size={22} />}
              label={t('portfolio', language) || 'Portfolio'}
              active={isActive('/portfolio')}
              onClick={() => navigate('/portfolio')}
            />
            <MobNavBtn
              icon={<Brain size={22} />}
              label={t('aiStrategyNav', language)}
              active={isActive('/traders')}
              onClick={() => navigate('/traders')}
            />
            <MobNavBtn
              icon={<Users size={22} />}
              label={t('communityNav', language)}
              active={isActive('/community')}
              onClick={() => navigate('/community')}
            />
            <MobNavBtn
              icon={<User size={22} />}
              label={t('profile', language) || 'Me'}
              active={isActive('/profile')}
              onClick={() => navigate('/profile')}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function NavBtn({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`text-sm font-bold transition-colors ${
        active ? 'text-[#00C805]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
      }`}
    >
      {label}
    </button>
  )
}

function MobNavBtn({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 w-20 transition-all ${
        active ? 'text-[#00C805] scale-110' : 'text-[var(--text-tertiary)]'
      }`}
    >
      {icon}
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  )
}
