import React, { useState, useEffect, useMemo } from 'react'
import { ClipboardList, Plus, Search, User, Loader2, MoreVertical, Clock, CheckCircle2, X, CreditCard, Landmark, Eye, Phone, Mail, MapPin, Award, CreditCard as CardIcon, Edit3, Trash2, Download, XCircle, AlertTriangle, ChevronUp, ChevronDown } from 'lucide-react'
import api from '../services/api'
import { toast } from 'react-toastify'
import { useLanguage } from '../i18n/LanguageContext'
import { capitalizeName } from '../utils/format'
import { exportOrdersToExcel } from '../services/ExportService'

const Orders = ({ user }) => {
 const { t } = useLanguage()
 const [orders, setOrders] = useState([])
 const [loading, setLoading] = useState(true)
 const [showAddModal, setShowAddModal] = useState(false)
 const [submitting, setSubmitting] = useState(false)
  const [branches, setBranches] = useState([])
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [search, setSearch] = useState('')
  const [totalPages, setTotalPages] = useState(1)
  const [allWaitingCount, setAllWaitingCount] = useState(0)
  const [allFulfilledCount, setAllFulfilledCount] = useState(0)
  const [allCancelledCount, setAllCancelledCount] = useState(0)
  const [allDepositsSum, setAllDepositsSum] = useState(0)
  const [allRefundsSum, setAllRefundsSum] = useState(0)
  const [statusFilter, setStatusFilter] = useState('all')
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [editingOrder, setEditingOrder] = useState(null)
  const [depositOrder, setDepositOrder] = useState(null)
  const [depositAmount, setDepositAmount] = useState('')
  const [depositMethod, setDepositMethod] = useState('cash')
  const [depositBank, setDepositBank] = useState('')
  const [depositAccountHolder, setDepositAccountHolder] = useState('')
  const [depositReference, setDepositReference] = useState('')
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [customerDetail, setCustomerDetail] = useState(null)
  const [orderMethod, setOrderMethod] = useState('cash')
  const [orderBank, setOrderBank] = useState('')
  const [orderAccountHolder, setOrderAccountHolder] = useState('')
  const [orderReference, setOrderReference] = useState('')
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancellingOrder, setCancellingOrder] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [refundAmount, setRefundAmount] = useState('')
  const [refundMethod, setRefundMethod] = useState('cash')
  const [refundBank, setRefundBank] = useState('')
  const [refundReference, setRefundReference] = useState('')
  const [customers, setCustomers] = useState([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [newCustPhone, setNewCustPhone] = useState('')
  const [phoneWarning, setPhoneWarning] = useState('')
  const filteredOrders = useMemo(() => orders.filter(o =>
    (statusFilter === 'all' || o.status === statusFilter) &&
    (o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
     o.vehicle_specs?.toLowerCase().includes(search.toLowerCase()))
  ), [orders, search, statusFilter])

  useEffect(() => {
   Promise.all([fetchOrders(), fetchCustomers(), fetchBranches()])
  }, [])

  const fetchBranches = async () => {
    try {
      const res = await api.get('/branches')
      setBranches(res.data)
    } catch (err) {
      console.error('Failed to fetch branches')
    }
  }

  const fetchOrders = async () => {
   try {
    const res = await api.get('/orders?per_page=10000')
    setOrders(res.data.items || [])
    setTotalPages(res.data.pages || 1)
    setAllWaitingCount(res.data.all_waiting_count ?? 0)
    setAllFulfilledCount(res.data.all_fulfilled_count ?? 0)
    setAllCancelledCount(res.data.all_cancelled_count ?? 0)
    setAllDepositsSum(res.data.all_deposits_sum ?? 0)
    setAllRefundsSum(res.data.all_refunds_sum ?? 0)
   } catch (error) {
    toast.error('Failed to fetch orders')
   } finally {
    setLoading(false)
   }
  }

  const fetchCustomers = async () => {
   try {
    const res = await api.get('/customers')
    setCustomers(res.data.items || [])
   } catch (err) {
    console.error('Failed to fetch customers')
   }
  }

  const handleSubmit = async (e) => {
   e.preventDefault()
   setSubmitting(true)
   const formData = new FormData(e.target)
    const data = {
     customer_name: formData.get('customer_name'),
     customer_phone: formData.get('customer_phone'),
     customer_id: selectedCustomerId || null,
     vehicle_specs: formData.get('vehicle_specs'),
      deposit_amount: parseFloat(formData.get('deposit_amount') || 0),
      deposit_method: orderMethod,
      deposit_bank: orderBank,
      deposit_account_holder: orderAccountHolder,
      deposit_transaction_reference: orderReference,
      branch_id: selectedBranchId || user?.branch_id || null,
      remark: formData.get('remark')
     }

   try {
     if (editingOrder) {
       await api.put(`/orders/${editingOrder.id}`, data)
       toast.success('Order updated')
     } else {
       await api.post('/orders', data)
       toast.success('Order added to waiting list')
     }
     setShowAddModal(false)
     setEditingOrder(null)
     setSelectedCustomerId(''); setNewCustPhone(''); setPhoneWarning('')
     setOrderMethod('cash'); setOrderBank(''); setOrderAccountHolder(''); setOrderReference('')
     fetchOrders()
   } catch (error) {
    toast.error(error.response?.data?.message || (editingOrder ? 'Failed to update order' : 'Failed to create order'))
   } finally {
    setSubmitting(false)
   }
  }


  const handleFulfill = async (orderId) => {
   if (!window.confirm('Mark this order as fulfilled?')) return
   try {
    await api.post(`/orders/${orderId}/fulfill`)
    toast.success('Order fulfilled successfully')
    fetchOrders()
   } catch (error) {
    toast.error('Failed to fulfill order')
   }
  }

  const handleDelete = async (orderId) => {
   if (!window.confirm('Delete this reservation? This cannot be undone.')) return
   try {
    await api.delete(`/orders/${orderId}`)
    toast.success('Reservation deleted')
    if (editingOrder?.id === orderId) { setShowAddModal(false); setEditingOrder(null) }
    fetchOrders()
   } catch (error) {
    toast.error(error.response?.data?.message || 'Failed to delete order')
   }
  }

  const openEditOrder = (order) => {
   setEditingOrder(order)
   setSelectedCustomerId(order.customer_id || '')
   setNewCustPhone(order.customer_phone || '')
   setSelectedBranchId(order.branch_id || '')
   setOrderMethod(order.deposit_method || 'cash')
   setOrderBank(order.deposit_bank || '')
   setOrderAccountHolder(order.deposit_account_holder || '')
   setOrderReference(order.deposit_transaction_reference || '')
   setPhoneWarning('')
   setShowAddModal(true)
  }


  const viewCustomerDetail = async (order) => {
    if (order.customer_id) {
      try {
        const res = await api.get(`/customers/${order.customer_id}`)
        setCustomerDetail(res.data)
      } catch {
        setCustomerDetail(null)
      }
    } else {
      setCustomerDetail(null)
    }
    setShowCustomerModal(true)
  }

  const handleAddDeposit = async (e) => {
    e.preventDefault()
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
     toast.error('Enter a valid deposit amount')
     return
    }
    if (depositMethod === 'bank') {
      if (!depositBank) { toast.error('Bank name is required'); return }
      if (!depositAccountHolder) { toast.error('Account holder is required'); return }
      if (!depositReference) { toast.error('Transaction reference is required'); return }
    }
    setSubmitting(true)
    try {
     const res = await api.post(`/orders/${depositOrder.id}/deposit`, {
       amount: parseFloat(depositAmount),
       method: depositMethod,
       bank: depositBank,
       account_holder: depositAccountHolder,
       reference: depositReference
     })
     toast.success(`Deposit added. Total: ETB ${res.data.deposit_amount.toLocaleString()}`)
     setShowDepositModal(false)
     setDepositOrder(null)
     setDepositAmount('')
     setDepositMethod('cash')
     setDepositBank('')
     setDepositAccountHolder('')
     setDepositReference('')
     fetchOrders()
   } catch (error) {
    toast.error('Failed to add deposit')
   } finally {
    setSubmitting(false)
   }
  }

  const handleCancelOrder = async (e) => {
    e.preventDefault()
    if (!cancelReason?.trim()) {
      toast.error('Cancellation reason is required'); return
    }
    if (!refundAmount || parseFloat(refundAmount) < 0) {
      toast.error('Enter a valid refund amount'); return
    }
    if (refundMethod === 'bank') {
      if (!refundBank) { toast.error('Bank name is required for bank refunds'); return }
      if (!refundReference) { toast.error('Transaction reference is required for bank refunds'); return }
    }
    setSubmitting(true)
    try {
      const data = {
        reason: cancelReason,
        refund_amount: parseFloat(refundAmount),
        refund_method: refundMethod,
      }
      if (refundMethod === 'bank') {
        data.refund_bank = refundBank
        data.refund_transaction_reference = refundReference
      }
      await api.post(`/orders/${cancellingOrder.id}/cancel`, data)
      toast.success('Order cancelled')
      setShowCancelModal(false)
      setCancellingOrder(null)
      setCancelReason('')
      setRefundAmount('')
      setRefundMethod('cash')
      setRefundBank('')
      setRefundReference('')
      fetchOrders()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to cancel order')
    } finally {
      setSubmitting(false)
    }
  }

  const defaultBranchId = branches?.[0]?.id || user?.branch_id || ''

  return (
   <div className="space-y-8">
     <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
     <div>
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{t('ordersTitle')}</h1>
      <p className="text-slate-400 mt-1 font-medium">{t('ordersDesc')}</p>
     </div>

      <div className="flex items-center gap-3">
       <button
        onClick={() => exportOrdersToExcel(orders, t)}
        className="px-4 py-2.5 bg-slate-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 transition-colors flex items-center gap-2 hover:bg-slate-200 dark:hover:bg-neutral-700"
       >
        <Download size={18} />
        {t('exportReport')}
       </button>
       <button 
        onClick={() => { setShowAddModal(true); setOrderMethod('cash'); setOrderBank(''); setOrderAccountHolder(''); setOrderReference(''); setSelectedCustomerId(''); setNewCustPhone(''); setPhoneWarning(''); setSelectedBranchId(defaultBranchId); }}
        className="btn-primary flex items-center gap-2"
       >
        <Plus size={20} />
        {t('newReservation')}
       </button>
      </div>

   </div>

     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
      <div className="glass-card p-6 border-l-4 border-amber-500">
       <p className="text-xs text-slate-500 uppercase font-bold ">{t('activeWaitingList')}</p>
       <p className="text-3xl font-bold mt-2 text-slate-900 dark:text-white">{allWaitingCount}</p>
      </div>
      <div className="glass-card p-6 border-l-4 border-primary-500">
       <p className="text-xs text-slate-500 uppercase font-bold ">{t('totalDeposits')}</p>
       <p className="text-3xl font-bold mt-2 text-slate-900 dark:text-white">ETB {allDepositsSum.toLocaleString()}</p>
      </div>
      <div className="glass-card p-6 border-l-4 border-emerald-500">
       <p className="text-xs text-slate-500 uppercase font-bold ">{t('fulfilledAllTime')}</p>
       <p className="text-3xl font-bold mt-2 text-slate-900 dark:text-white">{allFulfilledCount}</p>
      </div>
      <div className="glass-card p-6 border-l-4 border-rose-500">
       <p className="text-xs text-slate-500 uppercase font-bold ">{t('cancelled') || 'Cancelled'}</p>
       <p className="text-3xl font-bold mt-2 text-slate-900 dark:text-white">{allCancelledCount}</p>
      </div>
      <div className="glass-card p-6 border-l-4 border-purple-500">
       <p className="text-xs text-slate-500 uppercase font-bold ">{t('totalRefunded') || 'Total Refunded'}</p>
       <p className="text-3xl font-bold mt-2 text-slate-900 dark:text-white">ETB {allRefundsSum.toLocaleString()}</p>
      </div>
     </div>

   {/* Status Filter */}
   <div className="flex flex-wrap items-center gap-2 px-1">
    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">Filter:</span>
    {['all', 'waiting', 'fulfilled', 'cancelled'].map(s => (
     <button key={s} onClick={() => setStatusFilter(s)}
      className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${
       statusFilter === s
        ? s === 'all' ? 'bg-slate-800 text-white border-slate-800 dark:bg-white dark:text-slate-900 dark:border-white'
        : s === 'waiting' ? 'bg-amber-500 text-white border-amber-500'
        : s === 'fulfilled' ? 'bg-emerald-500 text-white border-emerald-500'
        : 'bg-rose-500 text-white border-rose-500'
        : 'bg-transparent text-slate-500 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
      }`}>
      {s === 'all' ? t('all') : t(s) || s}
     </button>
    ))}
   </div>

   <div className="glass-card overflow-hidden">
    <div className="p-6 border-b border-slate-200 dark:border-slate-300 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
     <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('queueManagement')}</h3>
     <div className="relative w-full md:w-64 group">
      <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-600 dark:text-blue-400 transition-colors" />
      <input 
       type="text" 
        placeholder={t('searchByName')} 
       className="w-full bg-slate-50 dark:bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-300 dark:border-slate-700 rounded-xl py-2 input-with-icon text-sm text-slate-600 dark:text-slate-300 outline-none focus:border-primary-500 transition-colors"
       value={search}
       onChange={(e) => setSearch(e.target.value)}
      />
     </div>
    </div>

     <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full text-left min-w-[1000px]">
       <thead>
        <tr className="bg-white dark:bg-slate-800 border-b border-slate-300 dark:border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-500 ">
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
        {loading ? (
         <tr>
          <td colSpan="7" className="px-6 py-12 text-center">
          <Loader2 className="animate-spin inline-block text-blue-600 dark:text-blue-400 mb-2" size={32} />
           <p className="text-slate-500 text-sm">{t('syncingQueue')}</p>
         </td>
        </tr>
         ) : filteredOrders.length === 0 ? (
         <tr>
           <td colSpan="7" className="px-6 py-12 text-center text-slate-500">{t('noOrdersFound')}</td>
         </tr>
        ) : (
         filteredOrders.map((order, idx) => (
          <tr key={order.id} className="hover:bg-slate-100 dark:bg-slate-800/50 transition-colors group">
           <td className="px-6 py-4 hidden sm:table-cell">
            <div className="flex items-center gap-1">
             <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-300 dark:border-slate-700 flex items-center justify-center font-mono font-bold text-blue-600 dark:text-blue-400">
              #{order.sequence_number}
             </div>
             {(user?.role === 'admin' || user?.role === 'manager') && order.status === 'waiting' && (
              <div className="flex flex-col gap-0.5">
                <button
                 onClick={async () => {
                  if (idx === 0) return
                  try {
                   await api.post('/orders/reorder', { id: order.id, direction: 'up' })
                   fetchOrders()
                  } catch { toast.error('Failed to reorder') }
                 }}
                 disabled={idx === 0}
                 className={`p-0.5 leading-none rounded ${idx === 0 ? 'text-slate-300' : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30'}`}
                 title="Move up"
                >
                 <ChevronUp size={12} />
                </button>
                <button
                 onClick={async () => {
                  if (idx === filteredOrders.length - 1) return
                  try {
                   await api.post('/orders/reorder', { id: order.id, direction: 'down' })
                   fetchOrders()
                  } catch { toast.error('Failed to reorder') }
                 }}
                 disabled={idx === filteredOrders.length - 1}
                 className={`p-0.5 leading-none rounded ${idx === filteredOrders.length - 1 ? 'text-slate-300' : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30'}`}
                 title="Move down"
                >
                 <ChevronDown size={12} />
                </button>
              </div>
             )}
            </div>
           </td>
           <td className="px-6 py-4">
            <button onClick={() => viewCustomerDetail(order)} className="text-left group">
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
              order.status === 'waiting' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800' : order.status === 'cancelled' ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
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
                  onClick={() => { setDepositOrder(order); setDepositAmount(''); setDepositMethod('cash'); setDepositBank(''); setDepositAccountHolder(''); setDepositReference(''); setShowDepositModal(true) }}
                  className="p-2.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-200 dark:border-amber-800 transition-colors"
                  title={t('deposit')}
                 >
                  <CreditCard size={16} />
                 </button>
                 <button
                  onClick={() => handleFulfill(order.id)}
                  className="p-2.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-200 dark:border-emerald-800 transition-colors"
                  title={t('fulfill')}
                 >
                  <CheckCircle2 size={16} />
                 </button>
                 {(user?.role === 'admin' || user?.role === 'manager') && (
                  <button
                   onClick={() => { setCancellingOrder(order); setCancelReason(''); setRefundAmount(order.deposit_amount || ''); setRefundMethod('cash'); setRefundBank(''); setRefundReference(''); setShowCancelModal(true) }}
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
                 onClick={() => openEditOrder(order)}
                 className="p-2.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-200 dark:border-indigo-800 transition-colors"
                 title={t('edit')}
                >
                 <Edit3 size={16} />
                </button>
               )}
                <button
                 onClick={() => handleDelete(order.id)}
                 className="p-2.5 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-200 dark:border-rose-800 transition-colors"
                 title={t('delete')}
                >
                 <Trash2 size={16} />
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



   {/* Add Order Modal */}
   {showAddModal && (
     <div className="modal-backdrop">
      <div className="modal-content max-w-xl">
       <div className="modal-header">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white">{editingOrder ? t('edit') : t('newReservation')}</h2>
           <p className="text-xs font-medium text-neutral-500 mt-0.5">{t('reservationQueue')}</p>
         </div>
            <button onClick={() => { setShowAddModal(false); setEditingOrder(null); setOrderMethod('cash'); setOrderBank(''); setOrderAccountHolder(''); setOrderReference(''); setNewCustPhone(''); setPhoneWarning(''); setSelectedBranchId(''); }} className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-2xl text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors border border-neutral-200 dark:border-neutral-700">
         <X size={20} />
        </button>

       </div>

      <div className="modal-body custom-scrollbar">
       <form key={editingOrder?.id || 'new'} id="order-form" onSubmit={handleSubmit} className="space-y-6">
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
         <button 
          type="button" 
            onClick={() => { setShowAddModal(false); setEditingOrder(null); setOrderMethod('cash'); setOrderBank(''); setOrderAccountHolder(''); setOrderReference(''); setNewCustPhone(''); setPhoneWarning(''); setSelectedBranchId(''); }}
           className="btn-secondary"
         >
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
    )}

   {/* Add Deposit Modal */}
   {showDepositModal && depositOrder && (
     <div className="modal-backdrop">
      <div className="modal-content max-w-lg">
       <div className="modal-header">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white">{t('addDeposit') || 'Add Deposit'}</h2>
          <p className="text-xs font-medium text-neutral-500 mt-0.5">#{depositOrder.sequence_number}</p>
         </div>
         <button onClick={() => setShowDepositModal(false)} className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-2xl text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors border border-neutral-200 dark:border-neutral-700">
         <X size={20} />
        </button>
       </div>
      <div className="modal-body">
       <form id="deposit-form" onSubmit={handleAddDeposit} className="space-y-6">
        {/* Customer Details Card */}
         <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl border border-blue-200 dark:border-blue-800">
          <div className="flex items-start justify-between">
           <div>
            <p className="text-lg font-bold text-neutral-900 dark:text-white">{capitalizeName(depositOrder.customer_name)}</p>
            <p className="text-sm text-neutral-500 mt-0.5 flex items-center gap-1.5">
            <Phone size={13} /> {depositOrder.customer_phone}
           </p>
          </div>
          {depositOrder.customer_id && (
           <button type="button" onClick={() => viewCustomerDetail(depositOrder)}
             className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
            <Eye size={14} /> {t('viewDetails') || 'View Details'}
           </button>
          )}
         </div>
        </div>

        {/* Current Deposit */}
        <div className="flex items-center justify-between px-1">
          <span className="text-sm text-neutral-500">{t('currentDeposit') || 'Current Deposit'}:</span>
         <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">ETB {(depositOrder.deposit_amount || 0).toLocaleString()}</span>
        </div>

        {/* Amount */}
        <div>
         <label className="label">{t('additionalAmount') || 'Additional Amount'} (ETB) *</label>
         <input type="number" className="input-field" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} placeholder="0.00" required min="1" />
        </div>

        {/* Payment Method */}
        <div>
         <label className="label">{t('paymentMethod') || 'Payment Method'}</label>
         <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => setDepositMethod('cash')}
            className={`p-3 rounded-xl border-2 text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              depositMethod === 'cash'
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
               : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300'
             }`}>
            <CreditCard size={18} /> {t('cash') || 'Cash'}
           </button>
           <button type="button" onClick={() => setDepositMethod('bank')}
             className={`p-3 rounded-xl border-2 text-sm font-bold transition-all flex items-center justify-center gap-2 ${
               depositMethod === 'bank'
                 ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                 : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300'
            }`}>
           <Landmark size={18} /> {t('bankTransfer') || 'Bank Transfer'}
          </button>
         </div>
        </div>

        {/* Bank Fields */}
        {depositMethod === 'bank' && (
          <div className="space-y-4 p-4 bg-neutral-50 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
           <div>
            <label className="label">{t('bankName') || 'Bank Name'} *</label>
            <input type="text" className="input-field uppercase" list="bank-list-deposit" value={depositBank} onChange={e => setDepositBank(e.target.value.toUpperCase())} placeholder="e.g. CBE" />
            <datalist id="bank-list-deposit">
             {['CBE','Awash','Abyssinia','Dashen','BOA','Hibret'].map(b => <option key={b} value={b} />)}
            </datalist>
           </div>
           <div>
            <label className="label">{t('accountHolder') || 'Account Holder'} *</label>
            <input type="text" className="input-field uppercase" list="account-list-deposit" value={depositAccountHolder} onChange={e => setDepositAccountHolder(e.target.value.toUpperCase())} placeholder="Full name on account" />
            <datalist id="account-list-deposit">
             <option value="TEWELDE" /><option value="BERIHU" /><option value="MULUGETA" />
            </datalist>
           </div>
           <div>
            <label className="label">{t('transactionRef') || 'Transaction Reference'} *</label>
            <input type="text" className="input-field uppercase" value={depositReference} onChange={e => setDepositReference(e.target.value.toUpperCase())} placeholder="TX-123456789" />
           </div>
          </div>
         )}
       </form>
      </div>
      <div className="modal-footer">
       <button type="button" onClick={() => setShowDepositModal(false)} className="btn-secondary">{t('cancel')}</button>
       <button form="deposit-form" type="submit" disabled={submitting} className="btn-primary flex items-center gap-2">
        {submitting ? <Loader2 className="animate-spin" size={16} /> : <CreditCard size={16} />}
        {t('addDeposit') || 'Add Deposit'}
       </button>
      </div>
     </div>
    </div>
   )}

   {/* Cancel Order Modal */}
   {showCancelModal && cancellingOrder && (
     <div className="modal-backdrop">
      <div className="modal-content max-w-lg">
       <div className="modal-header">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white">{t('cancelOrder') || 'Cancel Order'}</h2>
          <p className="text-xs font-medium text-neutral-500 mt-0.5">#{cancellingOrder.sequence_number} — {capitalizeName(cancellingOrder.customer_name)}</p>
         </div>
         <button onClick={() => setShowCancelModal(false)} className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-2xl text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors border border-neutral-200 dark:border-neutral-700">
          <X size={20} />
         </button>
       </div>
      <div className="modal-body">
       <form id="cancel-form" onSubmit={handleCancelOrder} className="space-y-6">
        <div className="p-4 bg-rose-50 dark:bg-rose-900/20 rounded-2xl border border-rose-200 dark:border-rose-800 flex items-start gap-3">
         <AlertTriangle size={20} className="text-rose-500 mt-0.5 shrink-0" />
         <div>
          <p className="text-sm font-bold text-rose-700 dark:text-rose-300">{t('cancelWarning') || 'This will cancel the reservation and trigger re-sequencing.'}</p>
          <p className="text-xs text-rose-500 mt-1">{t('currentDeposit') || 'Current Deposit'}: ETB {(cancellingOrder.deposit_amount || 0).toLocaleString()}</p>
         </div>
        </div>

        <div>
         <label className="label">{t('reason') || 'Cancellation Reason'} *</label>
         <textarea className="input-field h-24 resize-none" value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Why is this order being cancelled?" required />
        </div>

        <div>
         <label className="label">{t('refundAmount') || 'Refund Amount'} (ETB) *</label>
         <input type="number" className="input-field" value={refundAmount} onChange={e => setRefundAmount(e.target.value)} placeholder="0.00" required min="0" />
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
       </form>
      </div>
      <div className="modal-footer">
       <button type="button" onClick={() => setShowCancelModal(false)} className="btn-secondary">{t('close') || 'Close'}</button>
       <button form="cancel-form" type="submit" disabled={submitting} className="btn-danger flex items-center gap-2">
        {submitting ? <Loader2 className="animate-spin" size={16} /> : <XCircle size={16} />}
        {t('confirmCancel') || 'Confirm Cancellation'}
       </button>
      </div>
     </div>
    </div>
   )}

   {/* Customer Detail Modal */}
   {showCustomerModal && (
     <div className="modal-backdrop" onClick={() => setShowCustomerModal(false)}>
      <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
       <div className="modal-header">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white">{t('customerDetails') || 'Customer Details'}</h2>
         </div>
         <button onClick={() => setShowCustomerModal(false)} className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-2xl text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors border border-neutral-200 dark:border-neutral-700">
         <X size={20} />
        </button>
       </div>
      <div className="modal-body">
       {customerDetail ? (
        <div className="space-y-5">
         <div className="flex items-center gap-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl border border-blue-200 dark:border-blue-800">
          <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
           <User size={28} />
          </div>
          <div>
            <p className="text-lg font-bold text-neutral-900 dark:text-white">{capitalizeName(customerDetail.full_name)}</p>
           <span className={`inline-block mt-1 text-xs font-bold px-2 py-0.5 rounded-full ${
             customerDetail.type === 'corporate' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
           }`}>
            {(customerDetail.type || 'individual').toUpperCase()}
           </span>
          </div>
         </div>

         <div className="grid grid-cols-1 gap-4">
           <div className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-900 rounded-xl">
            <Phone size={18} className="text-neutral-400" />
            <div>
             <p className="text-xs text-neutral-500">{t('phoneNumber') || 'Phone'}</p>
             <p className="text-sm font-semibold text-neutral-900 dark:text-white">{customerDetail.phone}</p>
            </div>
           </div>

           {customerDetail.email && (
            <div className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-900 rounded-xl">
             <Mail size={18} className="text-neutral-400" />
             <div>
              <p className="text-xs text-neutral-500">{t('email') || 'Email'}</p>
              <p className="text-sm font-semibold text-neutral-900 dark:text-white">{customerDetail.email}</p>
             </div>
            </div>
           )}

           {customerDetail.address && (
            <div className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-900 rounded-xl">
             <MapPin size={18} className="text-neutral-400" />
             <div>
              <p className="text-xs text-neutral-500">{t('address') || 'Address'}</p>
              <p className="text-sm font-semibold text-neutral-900 dark:text-white">{customerDetail.address}</p>
             </div>
            </div>
           )}

           <div className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-900 rounded-xl">
            <Award size={18} className="text-neutral-400" />
            <div>
             <p className="text-xs text-neutral-500">{t('loyaltyPoints') || 'Loyalty Points'}</p>
             <p className="text-sm font-semibold text-neutral-900 dark:text-white">{customerDetail.points || 0}</p>
            </div>
           </div>

           {customerDetail.credit_limit > 0 && (
            <div className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-900 rounded-xl">
             <CardIcon size={18} className="text-neutral-400" />
             <div>
              <p className="text-xs text-neutral-500">{t('creditLimit') || 'Credit Limit'}</p>
              <p className="text-sm font-semibold text-neutral-900 dark:text-white">ETB {customerDetail.credit_limit.toLocaleString()}</p>
             </div>
            </div>
           )}
         </div>

         {/* History Summary */}
         {customerDetail.history && (
           <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4">
            <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">{t('history') || 'History'}</p>
           <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-center">
             <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{customerDetail.history.sales?.length || 0}</p>
              <p className="text-xs text-neutral-500">{t('sales') || 'Sales'}</p>
             </div>
             <div className="p-3 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-center">
              <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{customerDetail.history.orders?.length || 0}</p>
              <p className="text-xs text-neutral-500">{t('orders') || 'Orders'}</p>
            </div>
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
        <button onClick={() => setShowCustomerModal(false)} className="btn-secondary">{t('close') || 'Close'}</button>
       </div>
     </div>
    </div>
   )}
  </div>
  )
}

export default Orders
