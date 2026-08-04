import { useState } from 'react'
import { X, CreditCard, Landmark, Pencil, Trash2, Loader2 } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageContext'
import { formatDateTime } from '../../utils/format'
import { isAdmin } from '../../utils/roles'

const PaymentHistoryModal = ({ sale, payments, onClose, onEdit, onDelete, user, onPreviewImage }) => {
  const { t } = useLanguage()
  const totalCollected = payments.reduce((acc, p) => acc + p.amount, 0)

  return (
    <div className="modal-backdrop">
      <div className="modal-content max-w-4xl">
        <div className="modal-header">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('paymentAuditLog')}</h2>
            <p className="text-xs font-medium text-slate-500 mt-0.5">{t('receiptNum')}: <span className="text-blue-600 font-mono">#{sale.sale_number}</span></p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-slate-700"><X size={20} /></button>
        </div>

        <div className="modal-body">
          <div className="space-y-3">
            {payments.length === 0 ? (
              <div className="py-10 text-center text-slate-500">{t('noPaymentRecords')}</div>
            ) : (
              payments.map(p => (
                <div key={p.id} className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                      {p.method === 'cash' ? <CreditCard size={18} /> : <Landmark size={18} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-slate-900 dark:text-white font-bold">ETB {p.amount.toLocaleString()}</p>
                      <p className="text-xs text-slate-500 truncate">{p.method}{p.bank ? ` • ${p.bank}` : ''}{p.account_holder ? ` → ${p.account_holder}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:text-right sm:shrink-0">
                    <div className="min-w-0">
                      <p className="text-xs text-slate-400">{formatDateTime(p.date)}</p>
                      <p className="text-xs font-mono text-slate-500 mt-0.5 truncate max-w-[160px] sm:max-w-none">{(p.reference || 'NO REF').toUpperCase()}</p>
                    </div>
                    {p.receipt_image && (
                      <button
                        onClick={() => onPreviewImage(p.receipt_image)}
                        className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded-lg transition-colors shrink-0"
                        title="View Receipt"
                      >
                        <img src={p.receipt_image} alt="Receipt" className="w-9 h-9 object-cover rounded" />
                      </button>
                    )}
                    {isAdmin(user) && (
                      <button
                        onClick={() => onEdit(p)}
                        className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 rounded-lg transition-colors shrink-0"
                        title="Edit Payment"
                      ><Pencil size={16} /></button>
                    )}
                    {isAdmin(user) && (
                      <button
                        onClick={() => onDelete(p)}
                        className="p-2 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-900/50 rounded-lg transition-colors shrink-0"
                        title="Delete Payment"
                      ><Trash2 size={16} /></button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="modal-footer justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">{t('totalCollected')}</p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              ETB {totalCollected.toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="btn-secondary">{t('close')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PaymentHistoryModal
