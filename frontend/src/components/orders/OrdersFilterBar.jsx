import { Search } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageContext'

const OrdersFilterBar = ({ statusFilter, onStatusChange, search, onSearchChange }) => {
  const { t } = useLanguage()

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 px-1">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">Filter:</span>
        {['all', 'waiting', 'fulfilled', 'cancelled'].map(s => (
          <button key={s} onClick={() => onStatusChange(s)}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${
              statusFilter === s
                ? s === 'all' ? 'bg-slate-800 text-white border-slate-800 dark:bg-white dark:text-slate-900 dark:border-white'
                : s === 'waiting' ? 'bg-amber-500 text-white border-amber-500'
                : s === 'fulfilled' ? 'bg-emerald-500 text-white border-emerald-500'
                : 'bg-rose-500 text-white border-rose-500'
                : 'bg-transparent text-slate-500 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}>
            {s === 'all' ? t('all') : t(s) || s}
          </button>
        ))}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-300 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('queueManagement')}</h3>
          <div className="relative w-full md:w-64 group">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-600 dark:text-blue-400 transition-colors" />
            <input
              type="text"
              placeholder={t('searchByName')}
              className="w-full bg-slate-50 dark:bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-300 dark:border-slate-700 rounded-xl py-2 input-with-icon text-sm text-slate-600 dark:text-slate-300 outline-none focus:border-primary-500 transition-colors"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        </div>
      </div>
    </>
  )
}

export default OrdersFilterBar
