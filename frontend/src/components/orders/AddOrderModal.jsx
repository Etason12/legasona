import { X, CreditCard, Landmark, Loader2 } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageContext'
import { capitalizeName } from '../../utils/format'

const AddOrderModal = ({ editingOrder, onClose, onSubmit, submitting, customers, selectedCustomerId, setSelectedCustomerId, newCustPhone, setNewCustPhone, phoneWarning, setPhoneWarning, branches, selectedBranchId, setSelectedBranchId, user, orderMethod, setOrderMethod, orderBank, setOrderBank, orderAccountHolder, setOrderAccountHolder, orderReference, setOrderReference }) => {
  const { t } = useLanguage()

  return (
    <div className="modal-backdrop">
      <div className="modal-content max-w-xl">
        <div className="modal-header">
          <div>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white">{editingOrder ? t('edit') : t('newReservation')}</h2>
            <p className="text-xs font-medium text-neutral-500 mt-0.5">{t('reservationQueue')}</p>
          </div>
          <button onClick={onClose} className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-2xl text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors border border-neutral-200 dark:border-neutral-700">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body custom-scrollbar">
          <form key={editingOrder?.id || 'new'} id="order-form" onSubmit={onSubmit} className="space-y-6">
            <div>
              <label className="label">{t('selectExistingCustomer')}</label>
              <select
                className="input-field"
                value={selectedCustomerId}
                onChange={(e) => {
                  setSelectedCustomerId(e.target.value)
                  setPhoneWarning('')
                  if (e.target.value) {
                    const c = customers.find(c => c.id === parseInt(e.target.value))
                    if (c) {
                      const form = e.target.closest('form')
                      form.customer_name.value = c.full_name
                      setNewCustPhone(c.phone)
                    }
                  }
                }}
              >
                <option value="">{t('newCustomer')}</option>
                {customers.map(c => <option key={c.id} value={c.id}>{capitalizeName(c.full_name)} ({c.phone})</option>)}
              </select>
            </div>

            {user?.role === 'admin' && (
              <div>
                <label className="label">{t('branch') || 'Branch'} *</label>
                <select
                  className="input-field"
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  required
                >
                  <option value="">{t('selectBranch') || 'Select Branch'}</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">{t('fullName')} *</label>
                <input type="text" name="customer_name" className="input-field" placeholder="e.g. Abebe Kebede" required defaultValue={editingOrder?.customer_name || ''} />
              </div>
              <div>
                <label className="label">{t('phoneNumber')} *</label>
                <input type="tel" name="customer_phone" className={`input-field ${phoneWarning ? 'border-amber-500 dark:border-amber-500' : ''}`}
                  placeholder="0911..." required
                  value={newCustPhone}
                  onChange={e => { setNewCustPhone(e.target.value); setPhoneWarning('') }}
                  onBlur={() => {
                    if (!newCustPhone.trim() || selectedCustomerId) { setPhoneWarning(''); return }
                    const match = customers.find(c => c.phone === newCustPhone.trim())
                    if (match) setPhoneWarning(`This phone belongs to ${capitalizeName(match.full_name)}. Select them from the dropdown above.`)
                    else setPhoneWarning('')
                  }} />
                {phoneWarning && <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">{phoneWarning}</p>}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">{t('initialDeposit')} (ETB)</label>
                <input type="number" name="deposit_amount" className="input-field" placeholder="0.00" defaultValue={editingOrder?.deposit_amount || ''} />
              </div>
              <div>
                <label className="label">{t('paymentMethod') || 'Payment Method'}</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setOrderMethod('cash')}
                    className={`p-3 rounded-xl border-2 text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                      orderMethod === 'cash'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                        : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300'
                    }`}>
                    <CreditCard size={18} /> {t('cash') || 'Cash'}
                  </button>
                  <button type="button" onClick={() => setOrderMethod('bank')}
                    className={`p-3 rounded-xl border-2 text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                      orderMethod === 'bank'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300'
                    }`}>
                    <Landmark size={18} /> {t('bankTransfer') || 'Bank Transfer'}
                  </button>
                </div>
              </div>
              {orderMethod === 'bank' && (
                <div className="space-y-4 p-4 bg-neutral-50 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
                  <div>
                    <label className="label">{t('bankName') || 'Bank Name'} *</label>
                    <input type="text" className="input-field uppercase" list="bank-list-order" value={orderBank} onChange={e => setOrderBank(e.target.value.toUpperCase())} placeholder="e.g. CBE" />
                    <datalist id="bank-list-order">
                      {['CBE','Awash','Abyssinia','Dashen','BOA','Hibret'].map(b => <option key={b} value={b} />)}
                    </datalist>
                  </div>
                  <div>
                    <label className="label">{t('accountHolder') || 'Account Holder'} *</label>
                    <input type="text" className="input-field uppercase" list="account-list-order" value={orderAccountHolder} onChange={e => setOrderAccountHolder(e.target.value.toUpperCase())} placeholder="Full name on account" />
                    <datalist id="account-list-order">
                      <option value="TEWELDE" /><option value="BERIHU" /><option value="MULUGETA" />
                    </datalist>
                  </div>
                  <div>
                    <label className="label">{t('transactionRef') || 'Transaction Reference'} *</label>
                    <input type="text" className="input-field uppercase" value={orderReference} onChange={e => setOrderReference(e.target.value.toUpperCase())} placeholder="TX-123456789" />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="label">{t('vehicleSpecs')} *</label>
              <textarea
                name="vehicle_specs"
                className="input-field h-28 resize-none"
                placeholder="Model, Color, Power type..."
                required
                defaultValue={editingOrder?.vehicle_specs || ''}
              />
            </div>

            <div>
              <label className="label">{t('remark')}</label>
              <textarea
                name="remark"
                className="input-field h-20 resize-none"
                placeholder="Optional notes..."
                defaultValue={editingOrder?.remark || ''}
              />
            </div>
          </form>
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn-secondary">
            {t('cancel')}
          </button>
          <button
            form="order-form"
            type="submit"
            disabled={submitting}
            className="btn-primary px-10"
          >
            {submitting ? <Loader2 className="animate-spin" size={18} /> : null}
            {editingOrder ? t('update') : t('createOrder')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AddOrderModal
