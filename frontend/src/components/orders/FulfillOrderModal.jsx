import { CheckCircle2, Loader2, Phone } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageContext'
import { capitalizeName } from '../../utils/format'

const FulfillOrderModal = ({ order, onClose, onSubmit, submitting }) => {
  const { t } = useLanguage()

  const handleSubmit = () => {
    onSubmit(order.id)
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content max-w-lg">
        <div className="modal-header">
          <div>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white">{t('fulfillOrder') || 'Fulfill Order'}</h2>
            <p className="text-xs font-medium text-neutral-500 mt-0.5">#{order.sequence_number}</p>
          </div>
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
            </div>
            {order.vehicle_specs && (
              <p className="text-xs text-neutral-500 mt-2">{order.vehicle_specs}</p>
            )}
          </div>

          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {t('confirmFulfill') || 'Mark this order as fulfilled?'}
          </p>
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn-secondary">{t('cancel')}</button>
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary flex items-center gap-2">
            {submitting ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
            {t('fulfillOrder') || 'Fulfill Order'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default FulfillOrderModal
