import { useLanguage } from '../../i18n/LanguageContext'

const OrdersStatsCards = ({ allWaitingCount, allDepositsSum, allFulfilledCount, allCancelledCount, allRefundsSum }) => {
  const { t } = useLanguage()

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
      <div className="glass-card p-6 border-l-4 border-amber-500">
        <p className="text-xs text-slate-500 uppercase font-bold">{t('activeWaitingList')}</p>
        <p className="text-3xl font-bold mt-2 text-slate-900 dark:text-white">{allWaitingCount}</p>
      </div>
      <div className="glass-card p-6 border-l-4 border-primary-500">
        <p className="text-xs text-slate-500 uppercase font-bold">{t('totalDeposits')}</p>
        <p className="text-3xl font-bold mt-2 text-slate-900 dark:text-white">ETB {allDepositsSum.toLocaleString()}</p>
      </div>
      <div className="glass-card p-6 border-l-4 border-emerald-500">
        <p className="text-xs text-slate-500 uppercase font-bold">{t('fulfilledAllTime')}</p>
        <p className="text-3xl font-bold mt-2 text-slate-900 dark:text-white">{allFulfilledCount}</p>
      </div>
      <div className="glass-card p-6 border-l-4 border-rose-500">
        <p className="text-xs text-slate-500 uppercase font-bold">{t('cancelled') || 'Cancelled'}</p>
        <p className="text-3xl font-bold mt-2 text-slate-900 dark:text-white">{allCancelledCount}</p>
      </div>
      <div className="glass-card p-6 border-l-4 border-purple-500">
        <p className="text-xs text-slate-500 uppercase font-bold">{t('totalRefunded') || 'Total Refunded'}</p>
        <p className="text-3xl font-bold mt-2 text-slate-900 dark:text-white">ETB {allRefundsSum.toLocaleString()}</p>
      </div>
    </div>
  )
}

export default OrdersStatsCards
