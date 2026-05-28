import React, { useState, useEffect } from 'react'
import {
  ShoppingCart,
  Package,
  DollarSign,
  Activity as ActivityIcon,
  Loader2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import api from '../services/api'
import { useLanguage } from '../i18n/LanguageContext'
import { formatDate } from '../utils/format'

const ACTION_ICONS = {
  VEHICLE_SALE: ShoppingCart,
  SPARE_PART_SALE: Package,
  ADD_PAYMENT: DollarSign,
  default: ActivityIcon,
}

const timeAgo = (iso) => {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (diff < 60)   return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return formatDate(iso)
}

const Activity = ({ user }) => {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const perPage = 20
  const { t } = useLanguage()

  useEffect(() => { fetchActivity(page) }, [page])

  const fetchActivity = async (p) => {
    setLoading(true)
    try {
      const branchId = user?.role?.toLowerCase() === 'admin' ? '' : (user?.branch_id || '')
      const res = await api.get(`/reports/activity?page=${p}&per_page=${perPage}&branch_id=${branchId}`)
      setItems(res.data.items)
      setTotal(res.data.total)
      setPages(res.data.pages)
    } catch (error) {
      console.error('Failed to fetch activity')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('activityLog') || 'Activity Log'}</h1>
        <p className="text-slate-500 text-sm mt-1">{total} records</p>
      </div>

      <div className="glass-card p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-brand-600" size={32} />
          </div>
        ) : items.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-20">No activity recorded yet.</p>
        ) : (
          <div className="space-y-4">
            {items.map((log, i) => {
              const Icon = ACTION_ICONS[log.action] || ACTION_ICONS.default
              return (
                <div key={log.id} className="flex gap-3">
                  <div className="relative flex-shrink-0">
                    <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center text-brand-600">
                      <Icon size={16} />
                    </div>
                    {i === 0 && page === 1 && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-neutral-900" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{log.description}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{timeAgo(log.timestamp)} · {log.username}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-700">
            <p className="text-sm text-slate-500">
              Page {page} of {pages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-md border border-neutral-200 dark:border-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage(p => Math.min(pages, p + 1))}
                disabled={page === pages}
                className="p-2 rounded-md border border-neutral-200 dark:border-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Activity