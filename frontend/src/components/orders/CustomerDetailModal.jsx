import { X, User, Phone, Mail, MapPin, Award, CreditCard as CardIcon } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageContext'
import { capitalizeName } from '../../utils/format'

const CustomerDetailModal = ({ customer, deposits, onClose }) => {
  const { t } = useLanguage()

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white">{t('customerDetails') || 'Customer Details'}</h2>
          </div>
          <button onClick={onClose} className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-2xl text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors border border-neutral-200 dark:border-neutral-700">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {customer ? (
            <div className="space-y-5">
              <div className="flex items-center gap-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl border border-blue-200 dark:border-blue-800">
                <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <User size={28} />
                </div>
                <div>
                  <p className="text-lg font-bold text-neutral-900 dark:text-white">{capitalizeName(customer.full_name)}</p>
                  <span className={`inline-block mt-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                    customer.type === 'corporate' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  }`}>
                    {(customer.type || 'individual').toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-900 rounded-xl">
                  <Phone size={18} className="text-neutral-400" />
                  <div>
                    <p className="text-xs text-neutral-500">{t('phoneNumber') || 'Phone'}</p>
                    <p className="text-sm font-semibold text-neutral-900 dark:text-white">{customer.phone}</p>
                  </div>
                </div>

                {customer.email && (
                  <div className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-900 rounded-xl">
                    <Mail size={18} className="text-neutral-400" />
                    <div>
                      <p className="text-xs text-neutral-500">{t('email') || 'Email'}</p>
                      <p className="text-sm font-semibold text-neutral-900 dark:text-white">{customer.email}</p>
                    </div>
                  </div>
                )}

                {customer.address && (
                  <div className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-900 rounded-xl">
                    <MapPin size={18} className="text-neutral-400" />
                    <div>
                      <p className="text-xs text-neutral-500">{t('address') || 'Address'}</p>
                      <p className="text-sm font-semibold text-neutral-900 dark:text-white">{customer.address}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-900 rounded-xl">
                  <Award size={18} className="text-neutral-400" />
                  <div>
                    <p className="text-xs text-neutral-500">{t('loyaltyPoints') || 'Loyalty Points'}</p>
                    <p className="text-sm font-semibold text-neutral-900 dark:text-white">{customer.points || 0}</p>
                  </div>
                </div>

                {customer.credit_limit > 0 && (
                  <div className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-900 rounded-xl">
                    <CardIcon size={18} className="text-neutral-400" />
                    <div>
                      <p className="text-xs text-neutral-500">{t('creditLimit') || 'Credit Limit'}</p>
                      <p className="text-sm font-semibold text-neutral-900 dark:text-white">ETB {customer.credit_limit.toLocaleString()}</p>
                    </div>
                  </div>
                )}
              </div>

              {customer.history && (
                <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4">
                  <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">{t('history') || 'History'}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-center">
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{customer.history.sales?.length || 0}</p>
                      <p className="text-xs text-neutral-500">{t('sales') || 'Sales'}</p>
                    </div>
                    <div className="p-3 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-center">
                      <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{customer.history.orders?.length || 0}</p>
                      <p className="text-xs text-neutral-500">{t('orders') || 'Orders'}</p>
                    </div>
                  </div>
                </div>
              )}

              {deposits && deposits.length > 0 && (
                <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4">
                  <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">Deposit History</p>
                  <div className="space-y-2">
                    {deposits.map((d, i) => (
                      <div key={i} className="flex justify-between items-center bg-neutral-50 dark:bg-neutral-900 p-3 rounded-xl">
                        <div>
                          <p className="text-sm font-bold text-neutral-900 dark:text-white">ETB {d.amount.toLocaleString()}</p>
                          <p className="text-xs text-neutral-500">{new Date(d.date).toLocaleString('en-GB')}</p>
                        </div>
                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                          {d.method}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-10 text-center text-neutral-500">
              <User size={40} className="mx-auto mb-3 opacity-50" />
              <p>{t('noCustomerData') || 'No customer data available'}</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <div></div>
          <button onClick={onClose} className="btn-secondary">{t('close') || 'Close'}</button>
        </div>
      </div>
    </div>
  )
}

export default CustomerDetailModal
