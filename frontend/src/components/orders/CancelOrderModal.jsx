import { useState } from 'react'
import { X, AlertTriangle, CreditCard, Landmark, Loader2, XCircle } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageContext'
import { capitalizeName } from '../../utils/format'

const CancelOrderModal = ({ order, onClose, onSubmit, submitting }) => {
  const { t } = useLanguage()
  const [reason, setReason] = useState('')
  const [refundAmount, setRefundAmount] = useState(order.deposit_amount || '')
  const [refundMethod, setRefundMethod] = useState('cash')
  const [refundBank, setRefundBank] = useState('')
  const [refundReference, setRefundReference] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = () => {
    if (!reason?.trim()) {
      setError('Cancellation reason is required')
      return
    }
    if (!refundAmount || parseFloat(refundAmount) < 0) {
      setError('Enter a valid refund amount')
      return
    }
    if (refundMethod === 'bank') {
      if (!refundBank) { setError('Bank name is required for bank refunds'); return }
      if (!refundReference) { setError('Transaction reference is required for bank refunds'); return }
    }
    setError('')
    onSubmit(reason, refundAmount, refundMethod, refundBank, refundReference)
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content max-w-lg">
        <div className="modal-header">
          <div>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white">{t('cancelOrder') || 'Cancel Order'}</h2>
            <p className="text-xs font-medium text-neutral-500 mt-0.5">#{order.sequence_number} — {capitalizeName(order.customer_name)}</p>
          </div>
          <button onClick={onClose} className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-2xl text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors border border-neutral-200 dark:border-neutral-700">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body space-y-6">
          <div className="p-4 bg-rose-50 dark:bg-rose-900/20 rounded-2xl border border-rose-200 dark:border-rose-800 flex items-start gap-3">
            <AlertTriangle size={20} className="text-rose-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-rose-700 dark:text-rose-300">{t('cancelWarning') || 'This will cancel the reservation and trigger re-sequencing.'}</p>
              <p className="text-xs text-rose-500 mt-1">{t('currentDeposit') || 'Current Deposit'}: ETB {(order.deposit_amount || 0).toLocaleString()}</p>
            </div>
          </div>

          <div>
            <label className="label">{t('reason') || 'Cancellation Reason'} *</label>
            <textarea className="input-field h-24 resize-none" value={reason} onChange={e => { setReason(e.target.value); setError('') }} placeholder="Why is this order being cancelled?" required />
          </div>

          <div>
            <label className="label">{t('refundAmount') || 'Refund Amount'} (ETB) *</label>
            <input type="number" className="input-field" value={refundAmount} onChange={e => { setRefundAmount(e.target.value); setError('') }} placeholder="0.00" required min="0" />
          </div>

          <div>
            <label className="label">{t('refundMethod') || 'Refund Method'}</label>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setRefundMethod('cash')}
                className={`p-3 rounded-xl border-2 text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  refundMethod === 'cash'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                    : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300'
                }`}>
                <CreditCard size={18} /> {t('cash') || 'Cash'}
              </button>
              <button type="button" onClick={() => setRefundMethod('bank')}
                className={`p-3 rounded-xl border-2 text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  refundMethod === 'bank'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300'
                }`}>
                <Landmark size={18} /> {t('bankTransfer') || 'Bank Transfer'}
              </button>
            </div>
          </div>

          {refundMethod === 'bank' && (
            <div className="space-y-4 p-4 bg-neutral-50 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
              <div>
                <label className="label">{t('bankName') || 'Bank Name'} *</label>
                <input type="text" className="input-field uppercase" list="bank-list-cancel" value={refundBank} onChange={e => setRefundBank(e.target.value.toUpperCase())} placeholder="e.g. CBE" />
                <datalist id="bank-list-cancel">
                  {['CBE','Awash','Abyssinia','Dashen','BOA','Hibret'].map(b => <option key={b} value={b} />)}
                </datalist>
              </div>
              <div>
                <label className="label">{t('transactionRef') || 'Transaction Reference'} *</label>
                <input type="text" className="input-field uppercase" value={refundReference} onChange={e => setRefundReference(e.target.value.toUpperCase())} placeholder="TX-123456789" />
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn-secondary">{t('close') || 'Close'}</button>
          <button onClick={handleSubmit} disabled={submitting} className="btn-danger flex items-center gap-2">
            {submitting ? <Loader2 className="animate-spin" size={16} /> : <XCircle size={16} />}
            {t('confirmCancel') || 'Confirm Cancellation'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CancelOrderModal
