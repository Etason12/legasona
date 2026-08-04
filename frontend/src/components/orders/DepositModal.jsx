import { useState } from 'react'
import { X, CreditCard, Landmark, Phone, Eye, Loader2 } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageContext'
import { capitalizeName } from '../../utils/format'

const DepositModal = ({ order, onClose, onSubmit, submitting, onViewCustomer }) => {
  const { t } = useLanguage()
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [bank, setBank] = useState('')
  const [accountHolder, setAccountHolder] = useState('')
  const [reference, setReference] = useState('')
  const [error, setError] = useState('')

  const remaining = order.total_amount - (order.total_deposits || 0)

  const handleSubmit = () => {
    const val = parseFloat(amount)
    if (!amount || isNaN(val) || val <= 0) {
      setError('Enter a valid amount')
      return
    }
    if (val > remaining) {
      setError(`Amount exceeds remaining balance of ETB ${remaining.toLocaleString()}`)
      return
    }
    if (method === 'bank') {
      if (!bank) { setError('Bank name is required'); return }
      if (!accountHolder) { setError('Account holder is required'); return }
      if (!reference) { setError('Transaction reference is required'); return }
    }
    setError('')
    onSubmit(order.id, val, method, bank, accountHolder, reference)
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content max-w-lg">
        <div className="modal-header">
          <div>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white">{t('addDeposit') || 'Add Deposit'}</h2>
            <p className="text-xs font-medium text-neutral-500 mt-0.5">#{order.sequence_number}</p>
          </div>
          <button onClick={onClose} className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-2xl text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors border border-neutral-200 dark:border-neutral-700">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body space-y-6">
          <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl border border-blue-200 dark:border-blue-800">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-lg font-bold text-neutral-900 dark:text-white">{capitalizeName(order.customer_name)}</p>
                <p className="text-sm text-neutral-500 mt-0.5 flex items-center gap-1.5">
                  <Phone size={13} /> {order.customer_phone}
                </p>
              </div>
              {order.customer_id && onViewCustomer && (
                <button type="button" onClick={() => onViewCustomer(order)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                  <Eye size={14} /> {t('viewDetails') || 'View Details'}
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between px-1">
            <span className="text-sm text-neutral-500">{t('currentDeposit') || 'Current Deposit'}:</span>
            <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">ETB {(order.deposit_amount || 0).toLocaleString()}</span>
          </div>

          <div>
            <label className="label">{t('additionalAmount') || 'Additional Amount'} (ETB) *</label>
            <input type="number" className="input-field" value={amount} onChange={e => { setAmount(e.target.value); setError('') }} placeholder="0.00" required min="1" />
          </div>

          <div>
            <label className="label">{t('paymentMethod') || 'Payment Method'}</label>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setMethod('cash')}
                className={`p-3 rounded-xl border-2 text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  method === 'cash'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                    : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300'
                }`}>
                <CreditCard size={18} /> {t('cash') || 'Cash'}
              </button>
              <button type="button" onClick={() => setMethod('bank')}
                className={`p-3 rounded-xl border-2 text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  method === 'bank'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300'
                }`}>
                <Landmark size={18} /> {t('bankTransfer') || 'Bank Transfer'}
              </button>
            </div>
          </div>

          {method === 'bank' && (
            <div className="space-y-4 p-4 bg-neutral-50 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
              <div>
                <label className="label">{t('bankName') || 'Bank Name'} *</label>
                <input type="text" className="input-field uppercase" list="bank-list-deposit" value={bank} onChange={e => setBank(e.target.value.toUpperCase())} placeholder="e.g. CBE" />
                <datalist id="bank-list-deposit">
                  {['CBE','Awash','Abyssinia','Dashen','BOA','Hibret'].map(b => <option key={b} value={b} />)}
                </datalist>
              </div>
              <div>
                <label className="label">{t('accountHolder') || 'Account Holder'} *</label>
                <input type="text" className="input-field uppercase" list="account-list-deposit" value={accountHolder} onChange={e => setAccountHolder(e.target.value.toUpperCase())} placeholder="Full name on account" />
                <datalist id="account-list-deposit">
                  <option value="TEWELDE" /><option value="BERIHU" /><option value="MULUGETA" />
                </datalist>
              </div>
              <div>
                <label className="label">{t('transactionRef') || 'Transaction Reference'} *</label>
                <input type="text" className="input-field uppercase" value={reference} onChange={e => setReference(e.target.value.toUpperCase())} placeholder="TX-123456789" />
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn-secondary">{t('cancel')}</button>
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary flex items-center gap-2">
            {submitting ? <Loader2 className="animate-spin" size={16} /> : <CreditCard size={16} />}
            {t('addDeposit') || 'Add Deposit'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default DepositModal
