import { useState, useEffect } from 'react'
import { X, CheckCircle2, Loader2, Car, Phone, CreditCard } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageContext'
import { capitalizeName } from '../../utils/format'
import api from '../../services/api'

const FulfillOrderModal = ({ order, onClose, onSubmit, submitting }) => {
  const { t } = useLanguage()
  const [vehicles, setVehicles] = useState([])
  const [loadingVehicles, setLoadingVehicles] = useState(true)
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const res = await api.get(`/orders/available-vehicles?branch_id=${order.branch_id}`)
        setVehicles(res.data)
      } catch {
        setVehicles([])
      } finally {
        setLoadingVehicles(false)
      }
    }
    fetchVehicles()
  }, [order.branch_id])

  const selectedVehicle = vehicles.find(v => v.id === Number(selectedVehicleId))
  const deposit = parseFloat(order.deposit_amount || 0)
  const price = selectedVehicle?.selling_price || 0
  const remaining = price - deposit
  const isFullyPaid = deposit >= price && price > 0

  const handleSubmit = () => {
    if (!selectedVehicleId) {
      setError('Please select a vehicle')
      return
    }
    setError('')
    onSubmit(order.id, parseInt(selectedVehicleId))
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content max-w-lg">
        <div className="modal-header">
          <div>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white">{t('fulfillOrder') || 'Fulfill Order'}</h2>
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
            </div>
            {order.vehicle_specs && (
              <p className="text-xs text-neutral-500 mt-2">{order.vehicle_specs}</p>
            )}
          </div>

          <div>
            <label className="label">{t('selectVehicle') || 'Select Vehicle'} *</label>
            {loadingVehicles ? (
              <div className="p-4 text-center text-sm text-neutral-500">
                <Loader2 className="animate-spin inline-block mb-1" size={16} />
                <p>{t('loadingVehicles') || 'Loading available vehicles...'}</p>
              </div>
            ) : vehicles.length === 0 ? (
              <div className="p-4 text-center text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                {t('noAvailableVehicles') || 'No available vehicles in this branch'}
              </div>
            ) : (
              <select
                className="input-field"
                value={selectedVehicleId}
                onChange={e => { setSelectedVehicleId(e.target.value); setError('') }}
                required
              >
                <option value="">{t('chooseVehicle') || '-- Choose a vehicle --'}</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.model} — {v.color || 'N/A'} — VIN: {v.vin} — ETB {v.selling_price?.toLocaleString()}
                  </option>
                ))}
              </select>
            )}
          </div>

          {selectedVehicle && (
            <div className="p-4 bg-neutral-50 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-neutral-700 dark:text-neutral-300">
                <Car size={16} />
                <span>{selectedVehicle.model}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-neutral-500">
                <div><span className="font-semibold">{t('vin') || 'VIN'}:</span> {selectedVehicle.vin}</div>
                <div><span className="font-semibold">{t('color') || 'Color'}:</span> {selectedVehicle.color || '-'}</div>
                {selectedVehicle.chassis_number && <div><span className="font-semibold">{t('chassisNo') || 'Chassis'}:</span> {selectedVehicle.chassis_number}</div>}
                {selectedVehicle.engine_number && <div><span className="font-semibold">{t('engineNo') || 'Engine'}:</span> {selectedVehicle.engine_number}</div>}
              </div>
            </div>
          )}

          {selectedVehicle && (
            <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-2xl border border-emerald-200 dark:border-emerald-800 space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-300">
                <CreditCard size={16} />
                <span>{t('paymentSummary') || 'Payment Summary'}</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600 dark:text-neutral-400">{t('vehiclePrice') || 'Vehicle Price'}</span>
                  <span className="font-bold text-neutral-900 dark:text-white">ETB {price.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600 dark:text-neutral-400">{t('depositPaid') || 'Deposit Paid'}</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">- ETB {deposit.toLocaleString()}</span>
                </div>
                <div className="border-t border-emerald-200 dark:border-emerald-700 pt-2 flex justify-between">
                  <span className="text-sm font-bold text-neutral-700 dark:text-neutral-300">{t('remaining') || 'Remaining'}</span>
                  <span className={`text-lg font-bold ${isFullyPaid ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    ETB {remaining > 0 ? remaining.toLocaleString() : '0'}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-xs text-neutral-500">{t('saleStatus') || 'Sale Status'}</span>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase ${
                    isFullyPaid
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                  }`}>
                    {isFullyPaid ? 'completed' : 'pending'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {order.deposit_receipt_image && (
            <div className="p-3 bg-neutral-50 dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
              <p className="text-xs font-semibold text-neutral-500 mb-2">{t('depositReceipt') || 'Deposit Receipt'}</p>
              <img src={order.deposit_receipt_image} alt="Deposit receipt" className="max-h-32 rounded-lg object-contain" />
            </div>
          )}

          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn-secondary">{t('cancel')}</button>
          <button onClick={handleSubmit} disabled={submitting || !selectedVehicleId || vehicles.length === 0} className="btn-primary flex items-center gap-2">
            {submitting ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
            {t('fulfillAndCreateSale') || 'Fulfill & Create Sale'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default FulfillOrderModal
