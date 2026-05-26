import React from 'react'
import { Inbox } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'

const EmptyState = ({ message, icon: Icon = Inbox }) => {
  const { t } = useLanguage()
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-4">
        <Icon size={32} />
      </div>
      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-200">{t('noDataFound')}</h3>
      <p className="text-sm text-slate-500 mt-2 max-w-xs">
        {message || t('noResultsDescription')}
      </p>
    </div>
  )
}

export default EmptyState
