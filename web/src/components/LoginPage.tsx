import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { t } from '../i18n/translations'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from './ui/input'
import { toast } from 'sonner'

export function LoginPage() {
  const { language } = useLanguage()
  const { login, loginAdmin, verifyOTP } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState<'login' | 'otp'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [userID, setUserID] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [adminPassword, setAdminPassword] = useState('')
  const adminMode = false

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await loginAdmin(adminPassword)
    if (!result.success) {
      const msg = result.message || t('loginFailed', language)
      setError(msg)
      toast.error(msg)
    }
    setLoading(false)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await login(email, password)

    if (result.success) {
      if (result.requiresOTP && result.userID) {
        setUserID(result.userID)
        setStep('otp')
      }
    } else {
      const msg = result.message || t('loginFailed', language)
      setError(msg)
      toast.error(msg)
    }

    setLoading(false)
  }

  const handleOTPVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await verifyOTP(userID, otpCode)

    if (!result.success) {
      const msg = result.message || t('verificationFailed', language)
      setError(msg)
      toast.error(msg)
    }

    setLoading(false)
  }

  return (
    <div
      className="flex items-center justify-center py-12"
      style={{ minHeight: 'calc(100vh - 64px)' }}
    >
      <div className="w-full max-w-md px-6">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/icons/aspen.svg" alt="Aspen" className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white">
            {t('signIn', language) || '登录'} Aspen
          </h1>
          <p className="text-sm mt-2 text-gray-500">
            {step === 'login' ? '请输入您的邮箱和密码' : '请输入两步验证码'}
          </p>
        </div>

        {/* Login Form */}
        <div className="rounded-2xl p-6 bg-neutral-900 border border-neutral-800">
          {adminMode ? (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2 text-white">
                  管理员密码
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-black border border-neutral-800 text-white focus:outline-none focus:border-[#00C805] transition"
                  placeholder="请输入管理员密码"
                  required
                />
              </div>

              {error && (
                <div className="text-sm px-4 py-3 rounded-xl bg-[#FF5000]/10 text-[#FF5000]">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-3 rounded-full text-sm font-bold transition-all hover:scale-105 disabled:opacity-50 bg-[#00C805] text-black"
              >
                {loading ? t('loading', language) : '登录'}
              </button>
            </form>
          ) : step === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2 text-white">
                  {t('email', language)}
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-black border border-neutral-800 text-white placeholder-gray-600 focus:outline-none focus:border-[#00C805] transition"
                  placeholder={t('emailPlaceholder', language)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-white">
                  {t('password', language)}
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-12 rounded-xl bg-black border border-neutral-800 text-white placeholder-gray-600 focus:outline-none focus:border-[#00C805] transition"
                    placeholder={t('passwordPlaceholder', language)}
                    required
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? '隐藏密码' : '显示密码'}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-white transition"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <div className="text-right mt-2">
                  <button
                    type="button"
                    onClick={() => navigate('/reset-password')}
                    className="text-xs text-[#00C805] hover:underline"
                  >
                    {t('forgotPassword', language)}
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-sm px-4 py-3 rounded-xl bg-[#FF5000]/10 text-[#FF5000]">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-3 rounded-full text-sm font-bold transition-all hover:scale-105 disabled:opacity-50 bg-[#00C805] text-black"
              >
                {loading ? t('loading', language) : t('loginButton', language)}
              </button>
            </form>
          ) : (
            <form onSubmit={handleOTPVerify} className="space-y-4">
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">📱</div>
                <p className="text-sm text-gray-500">
                  {t('scanQRCodeInstructions', language)}
                  <br />
                  {t('enterOTPCode', language)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-white">
                  {t('otpCode', language)}
                </label>
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) =>
                    setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  className="w-full px-4 py-3 rounded-xl text-center text-2xl font-mono bg-black border border-neutral-800 text-white focus:outline-none focus:border-[#00C805] transition"
                  placeholder={t('otpPlaceholder', language)}
                  maxLength={6}
                  required
                />
              </div>

              {error && (
                <div className="text-sm px-4 py-3 rounded-xl bg-[#FF5000]/10 text-[#FF5000]">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('login')}
                  className="flex-1 px-4 py-3 rounded-full text-sm font-bold bg-neutral-800 text-gray-300 hover:bg-neutral-700 transition"
                >
                  {t('back', language)}
                </button>
                <button
                  type="submit"
                  disabled={loading || otpCode.length !== 6}
                  className="flex-1 px-4 py-3 rounded-full text-sm font-bold transition-all hover:scale-105 disabled:opacity-50 bg-[#00C805] text-black"
                >
                  {loading ? t('loading', language) : t('verifyOTP', language)}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Register Link */}
        {!adminMode && (
          <div className="text-center mt-6">
            <p className="text-sm text-gray-500">
              还没有账户？{' '}
              <button
                onClick={() => navigate('/register')}
                className="font-semibold hover:underline transition-colors text-[#00C805]"
              >
                立即注册
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
