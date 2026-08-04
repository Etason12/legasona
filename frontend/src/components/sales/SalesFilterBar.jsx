import { Search } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageContext'

const SalesFilterBar = ({ statusFilter, onStatusChange, startDate, endDate, onStartDateChange, onEndDateChange, searchQuery, onSearchChange }) => {
  const { t } = useLanguage()

  return (
    <div className="flex flex-col lg:flex-row items-center gap-4 bg-neutral-50 dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800">
      <div className="flex bg-white dark:bg-neutral-900 p-1 rounded-xl border border-neutral-200 dark:border-neutral-800 w-full lg:w-auto">
        {[
          { label: t('all'),       val: '' },
          { label: t('pending'),   val: 'pending' },
          { label: t('completed'), val: 'completed' },
        ].map(({ label, val }) => (
          <button
            key={val}
            onClick={() => onStatusChange(val)}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              statusFilter === val
                ? val === '' ? 'bg-neutral-700 text-white'
                  : val === 'pending' ? 'bg-amber-500 text-white'
                  : 'bg-emerald-500 text-white'
                : 'text-slate-500 hover:text-slate-700 dark:text-neutral-400'
            }`}
          >{label}</button>
        ))}
      </div>

      <div className="flex items-center gap-2 w-full lg:w-auto">
        <input type="date" className="input-field w-auto" value={startDate} onChange={e => onStartDateChange(e.target.value)} />
        <span className="text-slate-500 text-xs font-bold">TO</span>
        <input type="date" className="input-field w-auto" value={endDate} onChange={e => onEndDateChange(e.target.value)} />
      </div>

      <div className="flex-1 relative w-full group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input
          type="text" placeholder={t('searchCustomer')}
          className="input-field input-with-icon"
          value={searchQuery} onChange={e => onSearchChange(e.target.value)}
        />
      </div>
    </div>
  )
}

export default SalesFilterBar
