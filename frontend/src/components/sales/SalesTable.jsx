import React from 'react'
import { CheckCircle2, Clock, Eye, CreditCard, Pencil, Trash2, Receipt, Package, Loader2 } from 'lucide-react'
import { formatDate, formatDateTime, capitalizeName } from '../../utils/format'
import { isAdmin } from '../../utils/roles'
import { generateReceipt } from '../../services/ReceiptService'
import { useLanguage } from '../../i18n/LanguageContext'

const ImageCell = ({ imageData, onClick }) => {
  const [error, setError] = React.useState(false)
  if (!imageData || error) return <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center text-neutral-600"><Package size={18}/></div>
  return (
    <img
      src={imageData} alt="item"
      className="w-10 h-10 rounded-lg object-cover border border-neutral-300 dark:border-neutral-700 cursor-zoom-in transition-colors"
      onClick={() => onClick(imageData)}
      onError={() => setError(true)}
    />
  )
}

const SalesTable = ({ sales, loading, user, onPreviewImage, onViewPayments, onCollectPayment, onEditSale, onCancelSale, onHardDeleteSale }) => {
  const { t } = useLanguage()

  if (loading) {
    return (
      <div className="glass-card overflow-hidden">
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="animate-spin text-brand-600" size={40} />
          <p className="text-slate-400 font-medium animate-pulse">Syncing transactions...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left min-w-[1000px]">
          <thead>
            <tr className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-xs font-bold text-slate-500">
              <th className="px-6 py-4 text-center">{t('statusHeader')}</th>
              <th className="px-6 py-4 hidden sm:table-cell">{t('photo')}</th>
              <th className="px-6 py-4">{t('receiptNum')}</th>
              <th className="px-6 py-4">{t('customerDetails')}</th>
              <th className="px-6 py-4 hidden md:table-cell">{t('financials')}</th>
              <th className="px-6 py-4 table-cell">{t('progress')}</th>
              <th className="px-6 py-4 hidden md:table-cell">{t('notes')}</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {sales.length === 0 ? (
              <tr><td colSpan="8" className="px-6 py-12 text-center text-slate-500">{t('noTransactionsFound')}</td></tr>
            ) : (
              sales.map(sale => (
                <tr key={sale.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-colors group">
                  <td className="px-6 py-4 text-center">
                    <div className={`w-10 h-10 rounded-xl mx-auto flex items-center justify-center ${
                      sale.status === 'completed'
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                    }`}>
                      {sale.status === 'completed' ? <CheckCircle2 size={20} /> : <Clock size={20} className="animate-pulse" />}
                    </div>
                  </td>
                  <td className="px-6 py-4 hidden sm:table-cell"><ImageCell imageData={sale.item_image} onClick={onPreviewImage} /></td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="font-mono text-brand-600 font-bold tracking-tighter">{sale.sale_number}</p>
                    <p className="text-xs text-slate-500 mt-1">{formatDate(sale.sale_date)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-slate-700 dark:text-slate-200 font-bold">{capitalizeName(sale.customer_name)}</p>
                    <p className="text-xs text-slate-500 mt-1 whitespace-nowrap">
                      {sale.sale_type === 'vehicle'
                        ? `${sale.sale_type.replace('_', ' ')} ${sale.vin ? `— ${sale.vin}` : ''}`
                        : `${sale.sale_type.replace('_', ' ')} ${sale.item_name ? `— ${sale.item_name}` : ''}`
                      }
                    </p>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell whitespace-nowrap">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{parseFloat(sale.total_amount).toLocaleString()}</p>
                    <p className="text-xs text-slate-500 mt-1">{t('totalContract')}</p>
                  </td>
                  <td className="px-6 py-4 table-cell">
                    <div className="w-32 space-y-2">
                      <span className={`text-xs font-bold ${sale.status === 'completed' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        Paid: ETB {sale.amount_paid.toLocaleString()}
                      </span>
                      <div className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${sale.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'}`}
                          style={{ width: `${Math.min(100, (sale.amount_paid / sale.total_amount) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell text-sm text-slate-600 dark:text-slate-300 max-w-[200px] truncate">
                    {sale.remark || '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => onViewPayments(sale)} className="p-2.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-slate-600 dark:text-slate-300 rounded-xl border border-neutral-200 dark:border-neutral-700 transition-colors" title="View Payments">
                        <Eye size={18} />
                      </button>
                      {(sale.status === 'pending' || (sale.status === 'completed' && isAdmin(user))) && (
                        <button onClick={() => onCollectPayment(sale)} className="p-2.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-200 dark:border-amber-800 transition-colors" title="Collect / Add Payment">
                          <CreditCard size={18} />
                        </button>
                      )}
                      {isAdmin(user) && (
                        <>
                          {sale.status !== 'cancelled' ? (
                            <>
                              {sale.status === 'completed' && (
                                <button onClick={() => onEditSale(sale)} className="p-2.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-200 dark:border-indigo-800 transition-colors" title={t('editSale')}>
                                  <Pencil size={18} />
                                </button>
                              )}
                              <button onClick={() => onCancelSale(sale)} className="p-2.5 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-200 dark:border-rose-800 transition-colors" title="Cancel Sale">
                                <Trash2 size={18} />
                              </button>
                            </>
                          ) : (
                            <button onClick={() => onHardDeleteSale(sale)} className="p-2.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-800 transition-colors" title="Delete Permanently">
                              <Trash2 size={18} />
                            </button>
                          )}
                        </>
                      )}
                      <button
                        className="p-2.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-200 dark:border-blue-800 transition-colors"
                        title="Generate PDF"
                        onClick={() => generateReceipt({
                          receiptNumber: sale.sale_number,
                          customerName: sale.customer_name,
                          customerPhone: sale.customer_phone || 'N/A',
                          cashierName: sale.cashier_name || user?.username,
                          itemName: sale.item_name,
                          vehicleModel: sale.item_name,
                          chassisNumber: sale.chassis_number,
                          motorNumber: sale.motor_number,
                          powerType: sale.power_type,
                          saleType: sale.sale_type,
                          totalAmount: sale.total_amount,
                          amountPaid: sale.amount_paid,
                          balance: sale.balance ?? sale.total_amount - sale.amount_paid,
                          date: formatDateTime(sale.sale_date),
                          branch: user?.branch_name,
                        })}
                      >
                        <Receipt size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default SalesTable
