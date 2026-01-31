import { ChevronRight, LogOut, Moon, Sun } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useTheme } from '../contexts/ThemeContext'
import { t } from '../i18n/translations'

export function ProfilePage() {
  const { language, setLanguage } = useLanguage()
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const userInitials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : 'U'

  const settingsItems = [
    {
      icon: theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />,
      label: t('theme', language) || 'Theme',
      value: theme === 'dark' ? 'Dark' : 'Light',
      onClick: toggleTheme,
    },
  ]

  return (
    <div className="max-w-2xl mx-auto px-6 pt-8 pb-24 animate-fade-in">
      {/* Avatar & User Info */}
      <div className="text-center mb-10">
        <div className="w-24 h-24 bg-[var(--surface)] rounded-full mx-auto mb-4 flex items-center justify-center text-3xl font-bold text-[var(--text-primary)] border border-[var(--border)]">
          {userInitials}
        </div>
        <h1 className="text-3xl font-bold text-[var(--text-primary)]">
          {user?.email?.split('@')[0] || 'User'}
        </h1>
        <p className="text-[var(--text-secondary)] mt-1">{user?.email || ''}</p>
      </div>

      {/* Settings */}
      <div className="space-y-4">
        <h3 className="text-[var(--text-tertiary)] font-bold text-xs uppercase tracking-wider px-2">
          {t('settings', language) || 'Settings'}
        </h3>
        <div className="bg-[var(--surface)] rounded-2xl overflow-hidden border border-[var(--border)]">
          {settingsItems.map((item, idx) => (
            <div
              key={idx}
              onClick={item.onClick}
              className="p-4 flex items-center justify-between border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] active:bg-[var(--surface-active)] cursor-pointer transition"
            >
              <div className="flex items-center gap-3">
                <div className="text-[var(--text-secondary)]">{item.icon}</div>
                <span className="font-medium text-[var(--text-primary)]">{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--text-secondary)]">{item.value}</span>
                <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)]" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Language */}
      <div className="mt-6 space-y-4">
        <h3 className="text-[var(--text-tertiary)] font-bold text-xs uppercase tracking-wider px-2">
          {t('language', language) || 'Language'}
        </h3>
        <div className="bg-[var(--surface)] rounded-2xl overflow-hidden border border-[var(--border)]">
          <div
            onClick={() => setLanguage('en')}
            className={`p-4 flex items-center justify-between border-b border-[var(--border)] cursor-pointer transition ${language === 'en' ? 'bg-[var(--surface-hover)]' : 'hover:bg-[var(--surface-hover)] active:bg-[var(--surface-active)]'}`}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">🇺🇸</span>
              <span className="font-medium text-[var(--text-primary)]">English</span>
            </div>
            {language === 'en' && (
              <div className="w-2 h-2 rounded-full bg-[#00C805]" />
            )}
          </div>
          <div
            onClick={() => setLanguage('zh')}
            className={`p-4 flex items-center justify-between cursor-pointer transition ${language === 'zh' ? 'bg-[var(--surface-hover)]' : 'hover:bg-[var(--surface-hover)] active:bg-[var(--surface-active)]'}`}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">🇨🇳</span>
              <span className="font-medium text-[var(--text-primary)]">中文</span>
            </div>
            {language === 'zh' && (
              <div className="w-2 h-2 rounded-full bg-[#00C805]" />
            )}
          </div>
        </div>
      </div>

      {/* Logout */}
      <div className="mt-8">
        <button
          onClick={handleLogout}
          className="w-full p-4 bg-[var(--surface)] rounded-2xl border border-[var(--border)] flex items-center justify-center gap-2 text-[#FF5000] font-bold hover:bg-[var(--surface-hover)] transition"
        >
          <LogOut size={18} />
          {t('exitLogin', language) || 'Logout'}
        </button>
      </div>
    </div>
  )
}
