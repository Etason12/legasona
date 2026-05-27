import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp,
  Users,
  Package,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  ShoppingCart,
  Activity,
  Loader2,
  Plus
} from 'lucide-react'
import api from '../services/api'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import { exportSalesToExcel } from '../services/ExportService'
import { useLanguage } from '../i18n/LanguageContext'
import { formatDate } from '../utils/format'

// Theme-aware Recharts tooltip
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 shadow-md text-sm">
      <p className="font-bold text-slate-700 dark:text-white mb-1">{label}</p>
      <p className="text-brand-600">ETB {Number(payload[0].value).toLocaleString()}</p>
    </div>
  )
}

const ACTION_ICONS = {
  VEHICLE_SALE: ShoppingCart,
  SPARE_PART_SALE: Package,
  ADD_PAYMENT: DollarSign,
  default: Activity,
}

const Dashboard = ({ user }) => {
  const navigate = useNavigate()
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [activity, setActivity]   = useState([])
  const { t } = useLanguage()

  useEffect(() => { fetchStats() }, [])

  const fetchStats = async () => {
    try {
      const branchId = user?.role?.toLowerCase() === 'admin' ? '' : (user?.branch_id || '')
      const [statsRes, activityRes] = await Promise.all([
        api.get(`/reports/dashboard?branch_id=${branchId}`),
        api.get(`/reports/activity?limit=6&branch_id=${branchId}`)
      ])
      setData(statsRes.data)
      setActivity(activityRes.data)
    } catch (error) {
      console.error('Failed to fetch dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const translateStatName = (name) => {
    if (!name) return name
    if (name.includes('Company Sales')) return t('totalCompanySales')
    if (name.includes('Branch') && name.includes('Sales')) return `${t('branchSales')} (${name.split(' ')[1]})`
    if (name === 'Active Waiting List') return t('activeWaitingList')
    if (name === 'Inventory Value (Available)') return t('inventoryValue')
    if (name === 'Last 30 Days Revenue') return t('last30Days')
    return name
  }

  const statIcon = (name) => {
    if (name?.includes('Sales') || name?.includes('Revenue')) return DollarSign
    if (name?.includes('Orders') || name?.includes('Waiting')) return ShoppingCart
    if (name?.includes('Inventory')) return Package
    return TrendingUp
  }

  const timeAgo = (iso) => {
    const diff = Math.floor((Date.now() - new Date(iso)) / 1000)
    if (diff < 60)   return 'Just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return formatDate(iso)
  }

  const SkeletonCard = () => (
    <div className="glass-card p-6 h-32 flex flex-col justify-between">
      <div className="flex justify-between">
        <div className="w-10 h-10 rounded-md skeleton" />
        <div className="w-16 h-6 rounded-md skeleton" />
      </div>
      <div className="space-y-2 mt-4">
        <div className="w-24 h-4 rounded skeleton" />
        <div className="w-32 h-6 rounded skeleton" />
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('dashboard')}</h1>
          <p className="text-slate-500 text-sm mt-1">{t('welcomeBack')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={async () => { const res = await api.get('/sales'); exportSalesToExcel(res.data, t) }}
            className="px-4 py-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors flex items-center gap-2"
          >
            <Activity size={16} className="text-brand-600" />
            {t('exportSales')}
          </button>
          <button onClick={() => navigate('/sales')} className="btn-primary">
            <Plus size={16} />
            {t('newSale')}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {loading ? (
          [1,2,3,4].map(i => <SkeletonCard key={i} />)
        ) : (
          data?.stats.map((stat, idx) => {
            const Icon = statIcon(stat.name)
            return (
              <div key={idx} className="glass-card p-6 flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-md bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center text-brand-600">
                    <Icon size={20} />
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md ${
                    stat.trend === 'up'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {stat.change}
                    {stat.trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-sm text-slate-500 dark:text-slate-400">{translateStatName(stat.name)}</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stat.value}</p>
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 glass-card p-6 h-[400px]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('revenuePerformance')}</h3>
              <p className="text-sm text-slate-500 mt-1">Monthly Growth Overview</p>
            </div>
          </div>
          {loading ? (
            <div className="w-full h-[280px] skeleton rounded-md" />
          ) : (
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.chart_data}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#e11d48" stopOpacity={0.18}/>
                      <stop offset="95%" stopColor="#e11d48" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-neutral-200 dark:text-neutral-800" />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={val => `${val/1000}k`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="sales" stroke="#e11d48" fillOpacity={1} fill="url(#colorSales)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Real Activity Feed */}
        <div className="glass-card p-6 flex flex-col h-[400px]">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('recentActivities')}</h3>
            <p className="text-sm text-slate-500 mt-1">Real-time Operations Log</p>
          </div>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
            {loading ? (
              [1,2,3,4].map(i => <div key={i} className="h-12 skeleton rounded-lg" />)
            ) : activity.length === 0 ? (
              <p className="text-center text-slate-400 text-sm mt-8">No activity recorded yet.</p>
            ) : (
              activity.map((log, i) => {
                const Icon = ACTION_ICONS[log.action] || ACTION_ICONS.default
                return (
                  <div key={log.id} className="flex gap-3">
                    <div className="relative flex-shrink-0">
                      <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center text-brand-600">
                        <Icon size={16} />
                      </div>
                      {i === 0 && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-neutral-900" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{log.description}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{timeAgo(log.timestamp)} · {log.username}</p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
          <button onClick={fetchStats} className="w-full mt-4 py-2 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-md text-sm font-medium text-slate-500 dark:text-slate-400 transition-colors">
            {t('viewAllActivity')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
