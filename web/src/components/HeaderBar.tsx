import { motion } from 'framer-motion'
import { ChevronDown, Menu, Moon, Sun, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import { t, type Language } from '../i18n/translations'
import { Container } from './Container'

interface HeaderBarProps {
  onLoginClick?: () => void
  isLoggedIn?: boolean
  isHomePage?: boolean
  currentPage?: string
  language?: Language
  onLanguageChange?: (lang: Language) => void
  user?: { email: string } | null
  onLogout?: () => void
  onPageChange?: (page: string) => void
}

export default function HeaderBar({
  isLoggedIn = false,
  isHomePage = false,
  currentPage,
  language = 'zh' as Language,
  onLanguageChange,
  user,
  onLogout,
  onPageChange,
}: HeaderBarProps) {
  const navigate = useNavigate()
  const { theme, toggleTheme, isAuto } = useTheme()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [languageDropdownOpen, setLanguageDropdownOpen] = useState(false)
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const userDropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setLanguageDropdownOpen(false)
      }
      if (
        userDropdownRef.current &&
        !userDropdownRef.current.contains(event.target as Node)
      ) {
        setUserDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const navButtonClass = (isActive: boolean) =>
    `text-sm font-medium transition-all duration-200 relative px-4 py-1.5 rounded-full flex items-center gap-2 ${isActive
      ? 'text-[var(--google-blue)] bg-[var(--surface-soft-blue)] font-semibold'
      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
    }`

  return (
    <nav className="fixed top-0 w-full z-50 bg-[var(--surface)]/95 backdrop-blur-sm border-b border-[var(--border-light)]">
      <Container className="flex items-center justify-between h-16">
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
        >
          <div className="flex items-center text-2xl font-bold tracking-tight" style={{ fontFamily: "'Google Sans', sans-serif" }}>
            <span className="text-[var(--google-blue)]">A</span>
            <span className="text-[var(--text-primary)]">Trade</span>
          </div>
          <span className="text-sm hidden sm:block text-[var(--text-secondary)] ml-1 font-medium border-l border-[var(--border)] pl-3 py-0.5">
            Agentic Trading OS
          </span>
        </Link>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center justify-between flex-1 ml-8">
          {/* Left Side - Navigation Tabs */}
          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              // Main app navigation when logged in
              <>
                <button
                  onClick={() => navigate('/competition')}
                  className={navButtonClass(currentPage === 'competition')}
                >
                  <img src="/icons/icon-live-google.png" alt="" className="w-4 h-4 opacity-70" />
                  {t('realtimeNav', language)}
                </button>

                <button
                  onClick={() => navigate('/traders')}
                  className={navButtonClass(currentPage === 'traders')}
                >
                  <img src="/icons/icon-config-google.png" alt="" className="w-4 h-4 opacity-70" onError={(e) => e.currentTarget.style.display = 'none'} />
                  {t('configNav', language)}
                </button>

                <button
                  onClick={() => navigate('/dashboard')}
                  className={navButtonClass(currentPage === 'trader')}
                >
                  <img src="/icons/icon-dashboard-google.png" alt="" className="w-4 h-4 opacity-70" onError={(e) => e.currentTarget.style.display = 'none'} />
                  {t('dashboardNav', language)}
                </button>
              </>
            ) : (
              // Landing page navigation when not logged in
              <>
                <a
                  href="/competition"
                  className={navButtonClass(currentPage === 'competition')}
                >
                  <img src="/icons/icon-live-google.png" alt="" className="w-4 h-4 opacity-70" />
                  {t('realtimeNav', language)}
                </a>
              </>
            )}
          </div>

          {/* Right Side - Original Navigation Items and Login */}
          <div className="flex items-center gap-4">
            {/* Only show original navigation items on home page */}
            {isHomePage &&
              [
                { key: 'features', label: t('features', language) },
                { key: 'howItWorks', label: t('howItWorks', language) },
                { key: 'GitHub', label: 'GitHub' },
                { key: 'community', label: t('community', language) },
              ].map((item) => (
                <a
                  key={item.key}
                  href={
                    item.key === 'GitHub'
                      ? 'https://github.com/tinkle-community/atrade'
                      : item.key === 'community'
                        ? 'https://t.me/atrade_dev_community'
                        : `#${item.key === 'features' ? 'features' : 'how-it-works'}`
                  }
                  target={
                    item.key === 'GitHub' || item.key === 'community'
                      ? '_blank'
                      : undefined
                  }
                  rel={
                    item.key === 'GitHub' || item.key === 'community'
                      ? 'noopener noreferrer'
                      : undefined
                  }
                  className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--google-blue)] transition-colors"
                >
                  {item.label}
                </a>
              ))}

            {/* User Info and Actions */}
            {isLoggedIn && user ? (
              <div className="flex items-center gap-3">
                {/* User Info with Dropdown */}
                <div className="relative" ref={userDropdownRef}>
                  <button
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    className="flex items-center gap-2 px-3 py-2 rounded-full border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
                  >
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-[var(--google-blue)] text-white">
                      {user.email[0].toUpperCase()}
                    </div>
                    <span className="text-sm text-[var(--text-primary)]">
                      {user.email}
                    </span>
                    <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
                  </button>

                  {userDropdownOpen && (
                    <div className="absolute right-0 top-full mt-2 w-48 rounded-lg shadow-[var(--shadow-dropdown)] bg-[var(--surface)] border border-[var(--border-light)] overflow-hidden z-50">
                      <div className="px-4 py-3 border-b border-[var(--border-light)]">
                        <div className="text-xs text-[var(--text-secondary)]">
                          {t('loggedInAs', language)}
                        </div>
                        <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                          {user.email}
                        </div>
                      </div>
                      {onLogout && (
                        <button
                          onClick={() => {
                            onLogout()
                            setUserDropdownOpen(false)
                          }}
                          className="w-full px-4 py-3 text-sm font-medium text-[var(--google-red)] hover:bg-red-50 transition-colors text-left"
                        >
                          {t('exitLogin', language)}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Show login/register buttons when not logged in and not on login/register pages */
              currentPage !== 'login' &&
              currentPage !== 'register' && (
                <div className="flex items-center gap-2">
                  <a
                    href="/login"
                    className="px-4 py-2 text-sm font-medium text-[var(--google-blue)] hover:bg-blue-50 rounded-md transition-colors"
                  >
                    {t('signIn', language)}
                  </a>
                  <a
                    href="/register"
                    className="px-4 py-2 text-sm font-medium text-white bg-[var(--google-blue)] hover:bg-blue-600 rounded-md transition-colors shadow-sm"
                  >
                    {t('signUp', language)}
                  </a>
                </div>
              )
            )}

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-[var(--surface-hover)] transition-colors text-[var(--text-secondary)]"
              title={isAuto ? t('autoTheme', language) : t('toggleTheme', language)}
            >
              {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
            </button>

            {/* Language Toggle */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setLanguageDropdownOpen(!languageDropdownOpen)}
                className="flex items-center gap-1 px-2 py-2 rounded-md hover:bg-[var(--surface-hover)] transition-colors"
              >
                <span className="text-lg">
                  {language === 'zh' ? '🇨🇳' : '🇺🇸'}
                </span>
                <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
              </button>

              {languageDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-32 rounded-lg shadow-[var(--shadow-dropdown)] bg-[var(--surface)] border border-[var(--border-light)] overflow-hidden z-50">
                  <button
                    onClick={() => {
                      onLanguageChange?.('zh')
                      setLanguageDropdownOpen(false)
                    }}
                    className={`w-full flex items-center gap-2 px-4 py-2 transition-colors hover:bg-[var(--surface-hover)] ${language === 'zh' ? 'bg-blue-50 text-[var(--google-blue)]' : 'text-[var(--text-primary)]'
                      }`}
                  >
                    <span className="text-base">🇨🇳</span>
                    <span className="text-sm">中文</span>
                  </button>
                  <button
                    onClick={() => {
                      onLanguageChange?.('en')
                      setLanguageDropdownOpen(false)
                    }}
                    className={`w-full flex items-center gap-2 px-4 py-2 transition-colors hover:bg-[var(--surface-hover)] ${language === 'en' ? 'bg-blue-50 text-[var(--google-blue)]' : 'text-[var(--text-primary)]'
                      }`}
                  >
                    <span className="text-base">🇺🇸</span>
                    <span className="text-sm">English</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Menu Button */}
        <motion.button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden text-[var(--text-secondary)]"
          whileTap={{ scale: 0.9 }}
        >
          {mobileMenuOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <Menu className="w-6 h-6" />
          )}
        </motion.button>
      </Container>

      {/* Mobile Menu */}
      <motion.div
        initial={false}
        animate={
          mobileMenuOpen
            ? { height: 'auto', opacity: 1 }
            : { height: 0, opacity: 0 }
        }
        transition={{ duration: 0.3 }}
        className="md:hidden overflow-hidden bg-[var(--surface)] border-t border-[var(--border-light)]"
      >
        <div className="px-4 py-4 space-y-2">
          {/* New Navigation Tabs */}
          {isLoggedIn ? (
            <button
              onClick={() => {
                onPageChange?.('competition')
                setMobileMenuOpen(false)
              }}
              className={`block w-full text-left px-4 py-3 rounded-md text-sm font-medium ${currentPage === 'competition'
                ? 'bg-blue-50 text-[var(--google-blue)]'
                : 'text-[var(--text-primary)]'
                }`}
            >
              {t('realtimeNav', language)}
            </button>
          ) : (
            <a
              href="/competition"
              className={`block w-full text-left px-4 py-3 rounded-md text-sm font-medium ${currentPage === 'competition'
                ? 'bg-blue-50 text-[var(--google-blue)]'
                : 'text-[var(--text-primary)]'
                }`}
            >
              {t('realtimeNav', language)}
            </a>
          )}
          {/* Only show 配置 and 看板 when logged in */}
          {isLoggedIn && (
            <>
              <button
                onClick={() => {
                  if (onPageChange) {
                    onPageChange('traders')
                  } else {
                    navigate('/traders')
                  }
                  setMobileMenuOpen(false)
                }}
                className={`block w-full text-left px-4 py-3 rounded-md text-sm font-medium ${currentPage === 'traders'
                  ? 'bg-blue-50 text-[var(--google-blue)]'
                  : 'text-[var(--text-primary)]'
                  }`}
              >
                {t('configNav', language)}
              </button>
              <button
                onClick={() => {
                  if (onPageChange) {
                    onPageChange('trader')
                  } else {
                    navigate('/dashboard')
                  }
                  setMobileMenuOpen(false)
                }}
                className={`block w-full text-left px-4 py-3 rounded-md text-sm font-medium ${currentPage === 'trader'
                  ? 'bg-blue-50 text-[var(--google-blue)]'
                  : 'text-[var(--text-primary)]'
                  }`}
              >
                {t('dashboardNav', language)}
              </button>
            </>
          )}

          {/* Original Navigation Items - Only on home page */}
          {isHomePage &&
            [
              { key: 'features', label: t('features', language) },
              { key: 'howItWorks', label: t('howItWorks', language) },
              { key: 'GitHub', label: 'GitHub' },
              { key: 'community', label: t('community', language) },
            ].map((item) => (
              <a
                key={item.key}
                href={
                  item.key === 'GitHub'
                    ? 'https://github.com/tinkle-community/atrade'
                    : item.key === 'community'
                      ? 'https://t.me/atrade_dev_community'
                      : `#${item.key === 'features' ? 'features' : 'how-it-works'}`
                }
                target={
                  item.key === 'GitHub' || item.key === 'community'
                    ? '_blank'
                    : undefined
                }
                rel={
                  item.key === 'GitHub' || item.key === 'community'
                    ? 'noopener noreferrer'
                    : undefined
                }
                className="block px-4 py-3 text-sm font-medium text-[var(--text-secondary)]"
              >
                {item.label}
              </a>
            ))}

          {/* Language Toggle */}
          <div className="px-4 py-3 border-t border-[var(--border-light)] mt-2">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  onLanguageChange?.('zh')
                  setMobileMenuOpen(false)
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${language === 'zh' ? 'bg-blue-50 text-[var(--google-blue)]' : 'text-[var(--text-primary)]'
                  }`}
              >
                <span>🇨🇳</span> 中文
              </button>
              <button
                onClick={() => {
                  onLanguageChange?.('en')
                  setMobileMenuOpen(false)
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${language === 'en' ? 'bg-blue-50 text-[var(--google-blue)]' : 'text-[var(--text-primary)]'
                  }`}
              >
                <span>🇺🇸</span> English
              </button>
            </div>
          </div>

          {/* User Info and Logout for Mobile */}
          {isLoggedIn && user && (
            <div className="pt-4 mt-4 border-t border-[var(--border-light)]">
              <div className="flex items-center gap-3 px-2 mb-4">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-[var(--google-blue)] text-white">
                  {user.email[0].toUpperCase()}
                </div>
                <div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    {t('loggedInAs', language)}
                  </div>
                  <div className="text-sm font-medium text-[var(--text-primary)]">
                    {user.email}
                  </div>
                </div>
              </div>
              {onLogout && (
                <button
                  onClick={() => {
                    onLogout()
                    setMobileMenuOpen(false)
                  }}
                  className="w-full px-4 py-2 text-sm font-medium text-[var(--google-red)] bg-red-50 rounded-md hover:bg-red-100 transition-colors"
                >
                  {t('exitLogin', language)}
                </button>
              )}
            </div>
          )}

          {/* Login/Register for Mobile */}
          {!isLoggedIn && currentPage !== 'login' && currentPage !== 'register' && (
            <div className="grid grid-cols-2 gap-3 pt-4 mt-4 border-t border-[var(--border-light)]">
              <a
                href="/login"
                className="flex items-center justify-center px-4 py-2 text-sm font-medium text-[var(--google-blue)] bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
              >
                {t('signIn', language)}
              </a>
              <a
                href="/register"
                className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-[var(--google-blue)] rounded-md hover:bg-blue-600 transition-colors shadow-sm"
              >
                {t('signUp', language)}
              </a>
            </div>
          )}
        </div>
      </motion.div>
    </nav >
  )
}
