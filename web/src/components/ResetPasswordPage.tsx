import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { t } from '../i18n/translations'
import { ArrowLeft, KeyRound, Eye, EyeOff } from 'lucide-react'
import PasswordChecklist from 'react-password-checklist'
import { Input } from './ui/input'
import { toast } from 'sonner'

export function ResetPasswordPage() {
  const { language } = useLanguage()
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordValid, setPasswordValid] = useState(false)

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (newPassword !== confirmPassword) {
      setError(t('passwordMismatch', language))
      return
    }

    setLoading(true)

    const result = await resetPassword(email, newPassword, otpCode)

    if (result.success) {
      setSuccess(true)
      toast.success(t('resetPasswordSuccess', language) || '重置成功')
      setTimeout(() => {
        window.history.pushState({}, '', '/login')
        window.dispatchEvent(new PopStateEvent('popstate'))
      }, 3000)
    } else {
      const msg = result.message || t('resetPasswordFailed', language)
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
        {/* Back to Login */}
        <button
          onClick={() => {
            window.history.pushState({}, '', '/login')
            window.dispatchEvent(new PopStateEvent('popstate'))
          }}
          className="flex items-center gap-2 mb-6 text-sm text-gray-500 hover:text-[#00C805] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('backToLogin', language)}
        </button>

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-[#00C805]/10 border border-[#00C805]/20">
            <KeyRound className="w-8 h-8 text-[#00C805]" />
          </div>
          <h1 className="text-2xl font-bold text-white">
            {t('resetPasswordTitle', language)}
          </h1>
          <p className="text-sm mt-2 text-gray-500">
            使用邮箱和 Google Authenticator 重置密码
          </p>
        </div>

        {/* Reset Password Form */}
        <div className="rounded-2xl p-6 bg-neutral-900 border border-neutral-800">
          {success ? (
            <div className="text-center py-8">
              <div className="text-5xl mb-4">✅</div>
              <p className="text-lg font-semibold mb-2 text-white">
                {t('resetPasswordSuccess', language)}
              </p>
              <p className="text-sm text-gray-500">
                3秒后将自动跳转到登录页面...
              </p>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
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
                  {t('newPassword', language)}
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-12 rounded-xl bg-black border border-neutral-800 text-white placeholder-gray-600 focus:outline-none focus:border-[#00C805] transition"
                    placeholder={t('newPasswordPlaceholder', language)}
                    required
                  />
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-white transition"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-white">
                  {t('confirmPassword', language)}
                </label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-12 rounded-xl bg-black border border-neutral-800 text-white placeholder-gray-600 focus:outline-none focus:border-[#00C805] transition"
                    placeholder={t('confirmPasswordPlaceholder', language)}
                    required
                  />
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-white transition"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Password rules */}
              <div className="mt-1 text-xs text-gray-400">
                <div className="mb-1 text-white">
                  {t('passwordRequirements', language)}
                </div>
                <PasswordChecklist
                  rules={[
                    'minLength',
                    'capital',
                    'lowercase',
                    'number',
                    'specialChar',
                    'match',
                  ]}
                  minLength={8}
                  value={newPassword}
                  valueAgain={confirmPassword}
                  messages={{
                    minLength: t('passwordRuleMinLength', language),
                    capital: t('passwordRuleUppercase', language),
                    lowercase: t('passwordRuleLowercase', language),
                    number: t('passwordRuleNumber', language),
                    specialChar: t('passwordRuleSpecial', language),
                    match: t('passwordRuleMatch', language),
                  }}
                  className="space-y-1"
                  onChange={(isValid) => setPasswordValid(isValid)}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-white">
                  {t('otpCode', language)}
                </label>
                <div className="text-center mb-3">
                  <div className="text-3xl">📱</div>
                  <p className="text-xs mt-1 text-gray-500">
                    打开 Google Authenticator 获取6位验证码
                  </p>
                </div>
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

              <button
                type="submit"
                disabled={loading || otpCode.length !== 6 || !passwordValid}
                className="w-full px-4 py-3 rounded-full text-sm font-bold transition-all hover:scale-105 disabled:opacity-50 bg-[#00C805] text-black"
              >
                {loading
                  ? t('loading', language)
                  : t('resetPasswordButton', language)}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
