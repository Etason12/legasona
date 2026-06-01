import React, { useState, useEffect, useMemo } from 'react'
import { ClipboardList, Plus, Search, User, Loader2, MoreVertical, Clock, CheckCircle2, X, CreditCard, Landmark, Eye, Phone, Mail, MapPin, Award, CreditCard as CardIcon, Edit3, Trash2 } from 'lucide-react'
import api from '../services/api'
import { toast } from 'react-toastify'
import { useLanguage } from '../i18n/LanguageContext'
import { capitalizeName } from '../utils/format'

const Orders = ({ user }) => {
 const { t } = useLanguage()
 const [orders, setOrders] = useState([])
 const [loading, setLoading] = useState(true)
 const [showAddModal, setShowAddModal] = useState(false)
 const [submitting, setSubmitting] = useState(false)
  const [customers, setCustomers] = useState([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [newCustPhone, setNewCustPhone] = useState('')
  const [phoneWarning, setPhoneWarning] = useState('')
  const [search, setSearch] = useState('')
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
  const filteredOrders = useMemo(() => orders.filter(o =>
    o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    o.vehicle_specs?.toLowerCase().includes(search.toLowerCase())
  ), [orders, search])

 useEffect(() => {
  Promise.all([fetchOrders(), fetchCustomers()])
 }, [])

 const fetchOrders = async () => {
  try {
   const res = await api.get('/orders')
   setOrders(res.data)
  } catch (error) {
   toast.error('Failed to fetch orders')
  } finally {
   setLoading(false)
  }
 }

 const fetchCustomers = async () => {
  try {
   const res = await api.get('/customers')
   setCustomers(res.data)
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
      branch_id: user?.branch_id || 1,
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

 return (
  <div className="space-y-8">
   <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
    <div>
     <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{t('ordersTitle')}</h1>
     <p className="text-slate-400 mt-1 font-medium">{t('ordersDesc')}</p>
    </div>
    <button 
      onClick={() => { setShowAddModal(true); setOrderMethod('cash'); setOrderBank(''); setOrderAccountHolder(''); setOrderReference(''); setSelectedCustomerId(''); setNewCustPhone(''); setPhoneWarning(''); }}
     className="btn-primary flex items-center gap-2"
    >
     <Plus size={20} />
     {t('newReservation')}
    </button>
   </div>

   <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
    <div className="glass-card p-6 border-l-4 border-amber-500">
     <p className="text-xs text-slate-500 uppercase font-bold ">{t('activeWaitingList')}</p>
     <p className="text-3xl font-bold mt-2 text-slate-900 dark:text-white">{orders.filter(o => o.status === 'waiting').length}</p>
    </div>
    <div className="glass-card p-6 border-l-4 border-primary-500">
     <p className="text-xs text-slate-500 uppercase font-bold ">{t('totalDeposits')}</p>
     <p className="text-3xl font-bold mt-2 text-slate-900 dark:text-white">ETB {orders.reduce((acc, curr) => acc + (curr.deposit_amount || 0), 0).toLocaleString()}</p>
    </div>
    <div className="glass-card p-6 border-l-4 border-emerald-500">
     <p className="text-xs text-slate-500 uppercase font-bold ">{t('fulfilledAllTime')}</p>
     <p className="text-3xl font-bold mt-2 text-slate-900 dark:text-white">{orders.filter(o => o.status === 'fulfilled').length}</p>
    </div>
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
        filteredOrders.map((order) => (
         <tr key={order.id} className="hover:bg-slate-100 dark:bg-slate-800/50 transition-colors group">
          <td className="px-6 py-4 hidden sm:table-cell">
           <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-300 dark:border-slate-700 flex items-center justify-center font-mono font-bold text-blue-600 dark:text-blue-400">
            #{order.sequence_number}
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
           <td className="px-6 py-4 hidden lg:table-cell">
            <p className="text-emerald-600 dark:text-emerald-400 font-bold">ETB {(order.deposit_amount || 0).toLocaleString()}</p>
            {order.deposit_method && (
             <span className={`mt-1 inline-block text-xs font-bold px-2 py-0.5 rounded-full ${
              order.deposit_method === 'bank'
               ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
               : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
             }`}>
              {order.deposit_method.toUpperCase()}
             </span>
            )}
            {order.deposit_method === 'bank' && (
             <div className="mt-2 text-[11px] text-slate-500 space-y-0.5">
              {order.deposit_bank && <p>{order.deposit_bank}</p>}
              {order.deposit_account_holder && <p>{order.deposit_account_holder}</p>}
              {order.deposit_transaction_reference && <p className="text-blue-500 font-mono">Ref: {order.deposit_transaction_reference}</p>}
             </div>
            )}
           </td>
           <td className="px-6 py-4">
            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
             order.status === 'waiting' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
            }`}>
             {order.status}
            </span>
           </td>
           <td className="px-6 py-4 hidden md:table-cell text-sm text-slate-600 dark:text-slate-300 max-w-[200px] truncate">
            {order.remark || '-'}
           </td>
             <td className="px-6 py-4 text-right">
             <div className="flex items-center justify-end gap-2">
              {order.status === 'waiting' && (
               <>
                 <button
                  onClick={() => { setDepositOrder(order); setDepositAmount(''); setDepositMethod('cash'); setDepositBank(''); setDepositAccountHolder(''); setDepositReference(''); setShowDepositModal(true) }}
                  className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-800 transition-colors flex items-center gap-1"
                 >
                  <CreditCard size={14} />{t('deposit')}
                </button>
                <button 
                 onClick={() => handleFulfill(order.id)}
                 className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg border border-blue-100 dark:border-blue-800 transition-colors"
                >
                 {t('fulfill')}
                </button>
               </>
              )}
               <button
                onClick={() => openEditOrder(order)}
                className="p-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                title={t('edit')}
               >
                <Edit3 size={15} />
               </button>
               <button
                onClick={() => handleDelete(order.id)}
                className="p-2 bg-rose-100 dark:bg-rose-900/30 hover:bg-rose-200 dark:hover:bg-rose-900/50 rounded-lg text-rose-600 transition-colors"
                title={t('delete')}
               >
                <Trash2 size={15} />
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
           <button onClick={() => { setShowAddModal(false); setEditingOrder(null); setOrderMethod('cash'); setOrderBank(''); setOrderAccountHolder(''); setOrderReference(''); setNewCustPhone(''); setPhoneWarning(''); }} className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-2xl text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors border border-neutral-200 dark:border-neutral-700">
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
             <input type="text" className="input-field" value={orderBank} onChange={e => setOrderBank(e.target.value)} placeholder="e.g. CBE" />
            </div>
            <div>
             <label className="label">{t('accountHolder') || 'Account Holder'} *</label>
             <input type="text" className="input-field" value={orderAccountHolder} onChange={e => setOrderAccountHolder(e.target.value)} placeholder="Full name on account" />
            </div>
            <div>
             <label className="label">{t('transactionRef') || 'Transaction Reference'} *</label>
             <input type="text" className="input-field" value={orderReference} onChange={e => setOrderReference(e.target.value)} placeholder="Transaction ID" />
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
            onClick={() => { setShowAddModal(false); setEditingOrder(null); setOrderMethod('cash'); setOrderBank(''); setOrderAccountHolder(''); setOrderReference(''); setNewCustPhone(''); setPhoneWarning(''); }}
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
           <input type="text" className="input-field" value={depositBank} onChange={e => setDepositBank(e.target.value)} placeholder="e.g. CBE" />
          </div>
          <div>
           <label className="label">{t('accountHolder') || 'Account Holder'} *</label>
           <input type="text" className="input-field" value={depositAccountHolder} onChange={e => setDepositAccountHolder(e.target.value)} placeholder="Full name on account" />
          </div>
          <div>
           <label className="label">{t('transactionRef') || 'Transaction Reference'} *</label>
           <input type="text" className="input-field" value={depositReference} onChange={e => setDepositReference(e.target.value)} placeholder="Transaction ID" />
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
