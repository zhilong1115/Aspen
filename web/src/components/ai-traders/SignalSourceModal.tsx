import React, { useState } from 'react'
import { t, type Language } from '../../i18n/translations'

interface SignalSourceModalProps {
  coinPoolUrl: string
  oiTopUrl: string
  onSave: (coinPoolUrl: string, oiTopUrl: string) => void
  onClose: () => void
  language: Language
}

export function SignalSourceModal({
  coinPoolUrl,
  oiTopUrl,
  onSave,
  onClose,
  language,
}: SignalSourceModalProps) {
  const [coinPool, setCoinPool] = useState(coinPoolUrl || '')
  const [oiTop, setOiTop] = useState(oiTopUrl || '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(coinPool.trim(), oiTop.trim())
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div
        className="bg-[#1E2329] rounded-xl w-full max-w-lg relative my-8 border border-neutral-800"
        style={{
          maxHeight: 'calc(100vh - 4rem)',
        }}
      >
        <div className="p-6 pb-0">
          <h3 className="text-xl font-bold mb-4 text-white">
            {t('signalSourceConfig', language)}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6">
          <div
            className="space-y-4 overflow-y-auto"
            style={{ maxHeight: 'calc(100vh - 16rem)' }}
          >
            <div>
              <label className="block text-sm font-semibold mb-2 text-white">
                COIN POOL URL
              </label>
              <input
                type="url"
                value={coinPool}
                onChange={(e) => setCoinPool(e.target.value)}
                placeholder="https://api.example.com/coinpool"
                className="w-full px-3 py-2 rounded border border-neutral-800 bg-[#0B0E11] text-white focus:border-[#00C805] outline-none transition-all"
              />
              <div className="text-xs mt-1 text-neutral-500">
                {t('coinPoolDescription', language)}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2 text-white">
                OI TOP URL
              </label>
              <input
                type="url"
                value={oiTop}
                onChange={(e) => setOiTop(e.target.value)}
                placeholder="https://api.example.com/oitop"
                className="w-full px-3 py-2 rounded border border-neutral-800 bg-[#0B0E11] text-white focus:border-[#00C805] outline-none transition-all"
              />
              <div className="text-xs mt-1 text-neutral-500">
                {t('oiTopDescription', language)}
              </div>
            </div>

            <div className="p-4 rounded bg-[#00C805]/10 border border-[#00C805]/20">
              <div className="text-sm font-semibold mb-2 text-[#00C805]">
                ℹ️ {t('information', language)}
              </div>
              <div className="text-xs space-y-1 text-neutral-400">
                <div>{t('signalSourceInfo1', language)}</div>
                <div>{t('signalSourceInfo2', language)}</div>
                <div>{t('signalSourceInfo3', language)}</div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6 pt-4 sticky bottom-0 bg-[#1E2329] border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded text-sm font-semibold bg-neutral-800 text-neutral-400 hover:bg-neutral-700 transition-colors"
            >
              {t('cancel', language)}
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 rounded text-sm font-bold bg-[#00C805] text-black hover:opacity-90 transition-opacity"
            >
              {t('save', language)}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
