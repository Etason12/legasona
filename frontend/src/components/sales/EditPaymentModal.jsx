import { useRef } from 'react'
import { X, Pencil, Loader2, Upload, Camera } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageContext'

const EditPaymentModal = ({ payment, sale, method, onMethodChange, onClose, onSubmit, submitting, onCamera, receiptRef }) => {
  const { t } = useLanguage()

  return (
    <div className="modal-backdrop">
      <div className="modal-content max-w-3xl">
        <div className="modal-header">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('editPayment') || 'Edit Payment'}</h2>
            <p className="text-xs font-medium text-slate-500 mt-0.5">{t('receiptNum')}: <span className="text-blue-600 font-mono">#{sale.sale_number}</span></p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-slate-700"><X size={20} /></button>
        </div>
        <div className="modal-body">
          <form id="edit-pay-form" onSubmit={onSubmit} className="space-y-6">
            <div className="p-6 bg-neutral-50 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-5">
              <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">{t('paymentDetails')}</h3>
              <div>
                <label className="label">{t('amountToPay')}</label>
                <input type="number" name="amount" className="input-field" defaultValue={payment.amount} placeholder="0.00" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">{t('method')}</label>
                  <select name="method" className="input-field" value={method} onChange={e => onMethodChange(e.target.value)}>
                    <option value="cash">{t('cash')}</option>
                    <option value="bank">{t('bankTransfer')}</option>
                  </select>
                </div>
                <div>
                  <label className="label">{t('bankName')} *</label>
                  <input name="bank" className="input-field disabled:opacity-40" list="bank-list-edit" defaultValue={payment.bank || ''} placeholder={t('typeBankName')} disabled={method === 'cash'} required />
                  <datalist id="bank-list-edit">{['CBE','Awash','Abyssinia','Dashen','BOA','Hibret'].map(b => <option key={b} value={b} />)}</datalist>
                </div>
              </div>
              {method === 'bank' && (
                <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700 space-y-5">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('bankTransferDetails')}</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">{t('accountHolder')} *</label>
                      <input name="account_holder" className="input-field" list="account-list-edit" defaultValue={payment.account_holder || ''} placeholder="Select or type" required />
                      <datalist id="account-list-edit"><option value="Tewelde" /><option value="Berihu" /><option value="Mulugeta" /></datalist>
                    </div>
                    <div>
                      <label className="label">{t('referenceNumber')} *</label>
                      <input type="text" name="reference" className="input-field uppercase" defaultValue={payment.reference || ''} placeholder="TX-123456789" required />
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 bg-neutral-50 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-5">
              <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">{t('receipt')}</h3>
              {payment.receipt_image && (
                <div className="flex items-center gap-4">
                  <img src={payment.receipt_image} alt="Receipt" className="w-24 h-24 object-cover rounded-xl border border-neutral-200 dark:border-neutral-700 shrink-0" />
                  <span className="text-xs text-slate-500">{t('existingReceipt')}</span>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <label className="flex items-center justify-center gap-3 flex-1 py-4 px-4 border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-xl text-slate-500 hover:border-blue-500 hover:text-blue-600 transition-colors cursor-pointer min-w-[180px]">
                  <Upload size={20} />
                  <span className="text-sm font-medium">{t('uploadReceipt') || 'Upload Receipt'}</span>
                  <input type="file" name="receipt" accept="image/*" className="hidden" ref={receiptRef} onChange={e => {
                    if (e.target.files?.[0]) {
                      const reader = new FileReader()
                      reader.onload = ev => {
                        const event = new CustomEvent('edit-pay-receipt', { detail: ev.target.result })
                        window.dispatchEvent(event)
                      }
                      reader.readAsDataURL(e.target.files[0])
                    }
                  }} />
                </label>
                <button type="button" onClick={onCamera} className="flex items-center justify-center gap-2 py-4 px-4 border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-xl text-slate-500 hover:border-blue-500 hover:text-blue-600 transition-colors cursor-pointer">
                  <Camera size={20} /><span className="text-sm font-medium">{t('captureOrSelect')}</span>
                </button>
              </div>
              {payment.receipt_preview && (
                <div className="flex items-center gap-4">
                  <img src={payment.receipt_preview} alt="Preview" className="w-24 h-24 object-cover rounded-xl border border-neutral-200 dark:border-neutral-700 shrink-0" />
                  <button type="button" onClick={() => {
                    window.dispatchEvent(new CustomEvent('edit-pay-clear-receipt'))
                    if (receiptRef.current) receiptRef.current.value = ''
                  }} className="text-xs text-red-500 hover:text-red-700 font-medium">{t('remove')}</button>
                </div>
              )}
            </div>
            <div className="col-span-full">
              <div className="p-6 bg-neutral-50 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-4">
                <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">{t('remark')}</h3>
                <textarea name="remark" className="input-field h-20 resize-none" placeholder="Optional notes..." />
              </div>
            </div>
          </form>
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn-secondary">{t('cancel')}</button>
          <button form="edit-pay-form" type="submit" disabled={submitting} className="btn-primary flex items-center gap-2">
            {submitting ? <Loader2 className="animate-spin" size={16} /> : <Pencil size={16} />}
            {t('save') || 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default EditPaymentModal
