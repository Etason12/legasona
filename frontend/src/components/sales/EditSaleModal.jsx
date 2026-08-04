import { X, Pencil, Loader2 } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageContext'

const EditSaleModal = ({ sale, amount, remark, onAmountChange, onRemarkChange, onClose, onSubmit, submitting }) => {
  const { t } = useLanguage()

  return (
    <div className="modal-backdrop">
      <div className="modal-content max-w-2xl">
        <div className="modal-header">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('editSale')}</h2>
            <p className="text-xs font-medium text-slate-500 mt-0.5">{t('receiptNum')}: <span className="text-blue-600 font-mono">#{sale.sale_number}</span></p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-slate-700"><X size={20} /></button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="modal-body">
            <div className="p-6 bg-neutral-50 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-5">
              <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">{t('financials')}</h3>
              <div>
                <label className="label">{t('totalContract')}</label>
                <input type="number" className="input-field" value={amount} onChange={e => onAmountChange(e.target.value)} step="0.01" min="0" required />
              </div>
              <div>
                <label className="label">{t('remark')}</label>
                <textarea className="input-field h-20 resize-none" value={remark} onChange={e => onRemarkChange(e.target.value)} placeholder="Optional notes..." />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">{t('cancel')}</button>
            <button type="submit" disabled={submitting} className="btn-primary flex items-center gap-2">
              {submitting ? <Loader2 className="animate-spin" size={16} /> : <Pencil size={16} />}
              {t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditSaleModal
