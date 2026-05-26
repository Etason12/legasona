import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, User, Eye, EyeOff, Loader2 } from 'lucide-react'
import { toast } from 'react-toastify'
import api from '../services/api'
import { useLanguage } from '../i18n/LanguageContext'

const Login = ({ onLogin }) => {
  const { t, lang, changeLanguage } = useLanguage()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const response = await api.post('/auth/login', { username, password })
      const { token, user } = response.data
      localStorage.setItem('token', token)
      onLogin(user)
      toast.success('Welcome back!')
      navigate('/')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-gray-100 dark:bg-gray-900">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] flex-shrink-0 p-12 bg-gray-800 dark:bg-gray-900 border-r border-gray-700">
        <div>
          <div className="flex items-center gap-3 mb-16">
            <div className="w-9 h-9 rounded flex items-center justify-center bg-brand-600">
              <Lock size={18} className="text-white" />
            </div>
            <span className="font-bold text-white tracking-widest text-sm">LEGASONA</span>
          </div>
          <h2 className="text-3xl font-bold text-white leading-tight mb-4">
            Enterprise<br />Management<br /><span className="text-brand-500">System</span>
          </h2>
          <p className="text-sm text-gray-400 leading-7">
            Inventory · Sales · Customers<br />
            Transfers · Reports · Finance
          </p>
        </div>
        <div className="space-y-3">
          {['Role-based Access Control', 'Multi-branch Support', 'Real-time Reporting'].map(f => (
            <div key={f} className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-600" />
              <span className="text-xs text-gray-400">{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right login panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-3 mb-10">
          <div className="w-9 h-9 rounded flex items-center justify-center bg-brand-600">
            <Lock size={18} className="text-white" />
          </div>
          <span className="font-bold text-gray-900 dark:text-white tracking-widest text-sm">LEGASONA</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{t('managementLogin')}</h1>
            <p className="text-sm text-gray-400">Sign in to your account to continue</p>
          </div>

          {/* Language switcher */}
          <div className="flex gap-1 mb-6 p-1 rounded-md w-fit bg-gray-800">
            {['en', 'am', 'ti'].map(l => (
              <button
                key={l}
                onClick={() => changeLanguage(l)}
                className="px-3 py-1.5 rounded text-xs font-medium transition-colors"
                style={lang === l ? { background: '#e11d48', color: '#ffffff' } : { color: '#737373' }}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">{t('username')}</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input
                  type="text"
                  className="w-full rounded-md py-2.5 pl-9 pr-4 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder={t('enterUsername')}
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">{t('password')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="w-full rounded-md py-2.5 pl-9 pr-10 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder={t('enterPassword')}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-md font-semibold text-sm text-white bg-brand-600 hover:bg-brand-700 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : t('signIn')}
            </button>
          </form>
        </div>

        <p className="mt-12 text-xs text-gray-500">
          © {new Date().getFullYear()} Legasona ERP · All rights reserved
        </p>
      </div>
    </div>
  )
}

export default Login
