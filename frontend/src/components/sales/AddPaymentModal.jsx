import { useState, useRef } from 'react'
import { X, CreditCard, Loader2, Upload, Camera } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageContext'

const AddPaymentModal = ({ sale, onClose, onSubmit, submitting, pickImage }) => {
  const { t } = useLanguage()
  const [method, setMethod] = useState('cash')
  const [receiptPreview, setReceiptPreview] = useState(null)
  const receiptRef = useRef(null)
  const receiptInputRef = useRef(null)

  const handleCamera = async () => {
    const result = await pickImage()
    if (!result) return
    const file = new File([result.blob], 'receipt.jpg', { type: 'image/jpeg' })
    const dt = new DataTransfer()
    dt.items.add(file)
    const input = receiptInputRef.current
    if (input) input.files = dt.files
    receiptRef.current = result.dataUrl
    setReceiptPreview(result.dataUrl)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    await onSubmit(e, () => {
      setMethod('cash')
      setReceiptPreview(null)
    })
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content max-w-3xl">
        <div className="modal-header">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('collectPayment')}</h2>
            <p className="text-xs font-medium text-slate-500 mt-0.5">{t('receiptNum')}: <span className="text-blue-600 font-mono">#{sale.sale_number}</span></p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-slate-700"><X size={20} /></button>
        </div>

        <div className="modal-body">
          <div className="p-5 mb-6 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-200 dark:border-amber-800/40 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{t('outstandingBalance')}</span>
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">ETB {(sale.total_amount - sale.amount_paid).toLocaleString()}</span>
          </div>

          <form id="add-pay-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="p-6 bg-neutral-50 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-5">
              <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">{t('paymentDetails')}</h3>

              <div>
                <label className="label">{t('amountToPay')}</label>
                <input type="number" name="amount" className="input-field" max={sale.total_amount - sale.amount_paid} placeholder="0.00" required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">{t('method')}</label>
                  <select name="method" className="input-field" value={method} onChange={e => setMethod(e.target.value)}>
                    <option value="cash">{t('cash')}</option>
                    <option value="bank">{t('bankTransfer')}</option>
                  </select>
                </div>
                <div>
                  <label className="label">{t('bankName')} *</label>
                  <input name="bank" className="input-field disabled:opacity-40" list="bank-list-add" placeholder={t('typeBankName')} disabled={method === 'cash'} required />
                  <datalist id="bank-list-add">
                    {['CBE','Awash','Abyssinia','Dashen','BOA','Hibret'].map(b => <option key={b} value={b} />)}
                  </datalist>
                </div>
              </div>

              {method === 'bank' && (
                <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700 space-y-5">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('bankTransferDetails')}</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">{t('accountHolder')} *</label>
                      <input name="account_holder" className="input-field" list="account-list-add" placeholder="Select or type" required />
                      <datalist id="account-list-add">
                        <option value="Tewelde" /><option value="Berihu" /><option value="Mulugeta" />
                      </datalist>
                    </div>
                    <div>
                      <label className="label">{t('referenceNumber')} *</label>
                      <input type="text" name="reference" className="input-field uppercase" placeholder="TX-123456789" required />
                    </div>
                  </div>
                  <div>
                    <label className="label">{t('bankReceiptImage')}</label>
                    <div className="relative">
                      <input type="file" name="receipt" accept="image/*" className="hidden" id="receipt-upload-add" ref={receiptInputRef} onChange={e => {
                        if (e.target.files?.[0]) {
                          const url = URL.createObjectURL(e.target.files[0])
                          receiptRef.current = url
                          setReceiptPreview(url)
                        } else { setReceiptPreview(null) }
                      }} />
                      {receiptPreview ? (
                        <div className="flex items-center gap-4">
                          <img src={receiptPreview} alt="Preview" className="w-24 h-24 object-cover rounded-xl border border-neutral-200 dark:border-neutral-700 shrink-0" />
                          <button type="button" onClick={() => { URL.revokeObjectURL(receiptPreview); receiptRef.current = null; if (receiptInputRef.current) receiptInputRef.current.value = ''; setReceiptPreview(null) }} className="text-xs text-red-500 hover:text-red-700 font-medium">{t('remove')}</button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <label htmlFor="receipt-upload-add" className="flex items-center justify-center gap-3 flex-1 py-4 px-4 border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-xl text-slate-500 hover:border-blue-500 hover:text-blue-600 transition-colors cursor-pointer min-w-[180px]">
                            <Upload size={20} /><span className="text-sm font-medium">{t('selectImageFile')}</span>
                          </label>
                          <button type="button" onClick={handleCamera} className="flex items-center justify-center gap-2 py-4 px-4 border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-xl text-slate-500 hover:border-blue-500 hover:text-blue-600 transition-colors cursor-pointer">
                            <Camera size={20} /><span className="text-sm font-medium">{t('captureOrSelect')}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </form>
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn-secondary">{t('cancel')}</button>
          <button form="add-pay-form" type="submit" disabled={submitting} className="btn-primary flex items-center gap-2">
            {submitting ? <Loader2 className="animate-spin" size={16} /> : <CreditCard size={16} />}
            {t('postPayment')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AddPaymentModal
