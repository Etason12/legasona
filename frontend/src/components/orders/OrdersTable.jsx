import { Eye, CreditCard, CheckCircle2, XCircle, Edit3, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageContext'
import { capitalizeName } from '../../utils/format'
import api from '../../services/api'
import { toast } from 'react-toastify'

const OrdersTable = ({ orders, onSelectOrder, onDeposit, onFulfill, onCancel, onDelete, onEdit, onReorder, user }) => {
  const { t } = useLanguage()

  if (orders.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500 dark:text-slate-400 font-medium">{t('noOrdersFound')}</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full text-left min-w-[1000px]">
        <thead>
          <tr className="bg-white dark:bg-slate-800 border-b border-slate-300 dark:border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-500">
            <th className="px-6 py-4 hidden sm:table-cell">{t('seqNo')}</th>
            <th className="px-6 py-4">{t('customerDetails')}</th>
            <th className="px-6 py-4 hidden md:table-cell">{t('vehicleSpecs')}</th>
            <th className="px-6 py-4 hidden lg:table-cell">{t('deposit')}</th>
            <th className="px-6 py-4">{t('statusHeader')}</th>
            <th className="px-6 py-4 hidden md:table-cell">{t('notes')}</th>
            <th className="px-6 py-4 text-right">{t('actions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {orders.map((order, idx) => (
            <tr key={order.id} className="hover:bg-slate-100 dark:bg-slate-800/50 transition-colors group">
              <td className="px-6 py-4 hidden sm:table-cell">
                <div className="flex items-center gap-1">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-300 dark:border-slate-700 flex items-center justify-center font-mono font-bold text-blue-600 dark:text-blue-400">
                    #{order.sequence_number}
                  </div>
                  {(user?.role === 'admin' || user?.role === 'manager') && order.status === 'waiting' && (
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => onReorder && onReorder(order.id, 'up')}
                        disabled={idx === 0}
                        className={`p-0.5 leading-none rounded ${idx === 0 ? 'text-slate-300' : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30'}`}
                        title="Move up"
                      >
                        <ChevronUp size={12} />
                      </button>
                      <button
                        onClick={() => onReorder && onReorder(order.id, 'down')}
                        disabled={idx === orders.length - 1}
                        className={`p-0.5 leading-none rounded ${idx === orders.length - 1 ? 'text-slate-300' : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30'}`}
                        title="Move down"
                      >
                        <ChevronDown size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </td>
              <td className="px-6 py-4">
                <button onClick={() => onSelectOrder(order)} className="text-left group">
                  <p className="text-slate-700 dark:text-slate-200 font-bold group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center gap-1.5">
                    {capitalizeName(order.customer_name)}
                    <Eye size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500" />
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{order.customer_phone}</p>
                </button>
              </td>
              <td className="px-6 py-4 text-slate-600 dark:text-slate-300 text-sm hidden md:table-cell">
                {order.vehicle_specs}
              </td>
              <td className="px-6 py-4 hidden lg:table-cell whitespace-nowrap">
                <p className="text-emerald-600 dark:text-emerald-400 font-bold">ETB {(order.deposit_amount || 0).toLocaleString()}</p>
                {order.deposit_method === 'bank' && (order.deposit_bank || order.deposit_account_holder || order.deposit_transaction_reference) && (
                  <p className="mt-2 text-[11px] text-slate-500 truncate">
                    {[order.deposit_bank, order.deposit_account_holder && `-> ${order.deposit_account_holder}`, order.deposit_transaction_reference && `ref: ${order.deposit_transaction_reference}`].filter(Boolean).join(' ')}
                  </p>
                )}
                {order.status === 'cancelled' && (
                  <div className="mt-2 text-[11px] text-rose-500 space-y-0.5">
                    {order.cancellation_reason && <p className="font-semibold">{order.cancellation_reason}</p>}
                    {order.cancelled_at && <p>{new Date(order.cancelled_at).toLocaleDateString()}</p>}
                    {order.refund_amount > 0 && <p>Refund: ETB {order.refund_amount.toLocaleString()} ({order.refund_method?.toUpperCase()})</p>}
                    {order.refund_method === 'BANK' && order.refund_bank && <p>{order.refund_bank} {order.refund_transaction_reference ? `Ref: ${order.refund_transaction_reference}` : ''}</p>}
                  </div>
                )}
              </td>
              <td className="px-6 py-4">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                  order.status === 'waiting' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                  : order.status === 'cancelled' ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                  : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                }`}>
                  {order.status}
                </span>
              </td>
              <td className="px-6 py-4 hidden md:table-cell text-sm text-slate-600 dark:text-slate-300 max-w-[200px] truncate">
                {order.remark || '-'}
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-1.5">
                  {order.status === 'waiting' && (
                    <>
                      <button
                        onClick={() => onDeposit(order)}
                        className="p-2.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-200 dark:border-amber-800 transition-colors"
                        title={t('deposit')}
                      >
                        <CreditCard size={16} />
                      </button>
                      <button
                        onClick={() => onFulfill(order.id)}
                        className="p-2.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-200 dark:border-emerald-800 transition-colors"
                        title={t('fulfill')}
                      >
                        <CheckCircle2 size={16} />
                      </button>
                      {(user?.role === 'admin' || user?.role === 'manager') && (
                        <button
                          onClick={() => onCancel(order)}
                          className="p-2.5 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-200 dark:border-rose-800 transition-colors"
                          title={t('cancel') || 'Cancel'}
                        >
                          <XCircle size={16} />
                        </button>
                      )}
                    </>
                  )}
                  {order.status !== 'cancelled' && (
                    <button
                      onClick={() => onEdit(order)}
                      className="p-2.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-200 dark:border-indigo-800 transition-colors"
                      title={t('edit')}
                    >
                      <Edit3 size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => onDelete(order.id)}
                    className="p-2.5 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-200 dark:border-rose-800 transition-colors"
                    title={t('delete')}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default OrdersTable
