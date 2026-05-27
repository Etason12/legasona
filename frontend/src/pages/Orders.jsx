import React, { useState, useEffect, useMemo } from 'react'
import { ClipboardList, Plus, Search, User, Loader2, MoreVertical, Clock, CheckCircle2, X, CreditCard } from 'lucide-react'
import api from '../services/api'
import { toast } from 'react-toastify'
import { useLanguage } from '../i18n/LanguageContext'

const Orders = ({ user }) => {
 const { t } = useLanguage()
 const [orders, setOrders] = useState([])
 const [loading, setLoading] = useState(true)
 const [showAddModal, setShowAddModal] = useState(false)
 const [submitting, setSubmitting] = useState(false)
 const [customers, setCustomers] = useState([])
 const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [search, setSearch] = useState('')
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [depositOrder, setDepositOrder] = useState(null)
  const [depositAmount, setDepositAmount] = useState('')
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
   branch_id: user?.branch_id || 1
  }

  try {
   await api.post('/orders', data)
   toast.success('Order added to waiting list')
   setShowAddModal(false)
   fetchOrders()
  } catch (error) {
   toast.error('Failed to create order')
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

  const handleAddDeposit = async (e) => {
   e.preventDefault()
   if (!depositAmount || parseFloat(depositAmount) <= 0) {
    toast.error('Enter a valid deposit amount')
    return
   }
   setSubmitting(true)
   try {
    const res = await api.post(`/orders/${depositOrder.id}/deposit`, { amount: parseFloat(depositAmount) })
    toast.success(`Deposit added. Total: ETB ${res.data.deposit_amount.toLocaleString()}`)
    setShowDepositModal(false)
    setDepositOrder(null)
    setDepositAmount('')
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
     onClick={() => setShowAddModal(true)}
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
     <table className="w-full text-left min-w-[900px]">
      <thead>
       <tr className="bg-white dark:bg-slate-800 border-b border-slate-300 dark:border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-500 ">
        <th className="px-6 py-4 hidden sm:table-cell">{t('seqNo')}</th>
        <th className="px-6 py-4">{t('customerDetails')}</th>
        <th className="px-6 py-4 hidden md:table-cell">{t('vehicleSpecs')}</th>
        <th className="px-6 py-4 hidden lg:table-cell">{t('deposit')}</th>
        <th className="px-6 py-4">{t('statusHeader')}</th>
        <th className="px-6 py-4 text-right">{t('actions')}</th>
       </tr>
      </thead>
      <tbody className="divide-y divide-slate-800/50">
       {loading ? (
        <tr>
         <td colSpan="6" className="px-6 py-12 text-center">
          <Loader2 className="animate-spin inline-block text-blue-600 dark:text-blue-400 mb-2" size={32} />
           <p className="text-slate-500 text-sm">{t('syncingQueue')}</p>
         </td>
        </tr>
        ) : filteredOrders.length === 0 ? (
        <tr>
          <td colSpan="6" className="px-6 py-12 text-center text-slate-500">{t('noOrdersFound')}</td>
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
           <p className="text-slate-700 dark:text-slate-200 font-bold">{order.customer_name}</p>
           <p className="text-xs text-slate-500 mt-1 er">{order.customer_phone}</p>
          </td>
          <td className="px-6 py-4 text-slate-600 dark:text-slate-300 text-sm hidden md:table-cell">
           {order.vehicle_specs}
          </td>
          <td className="px-6 py-4 hidden lg:table-cell">
           <p className="text-emerald-600 dark:text-emerald-400 font-bold">ETB {(order.deposit_amount || 0).toLocaleString()}</p>
          </td>
          <td className="px-6 py-4">
           <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
            order.status === 'waiting' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
           }`}>
            {order.status}
           </span>
          </td>
           <td className="px-6 py-4 text-right">
            <div className="flex items-center justify-end gap-2">
             {order.status === 'waiting' && (
              <>
               <button
                onClick={() => { setDepositOrder(order); setDepositAmount(''); setShowDepositModal(true) }}
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
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('newReservation')}</h2>
         <p className="text-xs text-slate-500 mt-0.5">{t('reservationQueue')}</p>
       </div>
       <button onClick={() => setShowAddModal(false)} className="p-2.5 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors border border-neutral-200 dark:border-neutral-700">
        <X size={22} />
       </button>
      </div>

      <div className="modal-body custom-scrollbar">
       <form id="order-form" onSubmit={handleSubmit} className="space-y-6">
        <div>
         <label className="label">{t('selectExistingCustomer')}</label>
         <select 
          className="input-field" 
          value={selectedCustomerId}
          onChange={(e) => {
           setSelectedCustomerId(e.target.value)
           if (e.target.value) {
            const c = customers.find(c => c.id === parseInt(e.target.value))
            if (c) {
             const form = e.target.closest('form')
             form.customer_name.value = c.full_name
             form.customer_phone.value = c.phone
            }
           }
          }}
         >
          <option value="">{t('newCustomer')}</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.full_name} ({c.phone})</option>)}
         </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
         <div>
          <label className="label">{t('fullName')} *</label>
          <input type="text" name="customer_name" className="input-field" placeholder="e.g. Abebe Kebede" required />
         </div>
         <div>
          <label className="label">{t('phoneNumber')} *</label>
          <input type="tel" name="customer_phone" className="input-field" placeholder="0911..." required />
         </div>
        </div>

        <div>
         <label className="label">{t('initialDeposit')} (ETB)</label>
         <input type="number" name="deposit_amount" className="input-field" placeholder="0.00" />
        </div>

        <div>
         <label className="label">{t('vehicleSpecs')} *</label>
         <textarea 
          name="vehicle_specs" 
          className="input-field h-28 resize-none" 
          placeholder="Model, Color, Power type..." 
          required
         />
        </div>
       </form>
      </div>

      <div className="modal-footer">
       <button 
        type="button" 
        onClick={() => setShowAddModal(false)}
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
        {t('createOrder')}
       </button>
      </div>
     </div>
    </div>
    )}

   {/* Add Deposit Modal */}
   {showDepositModal && depositOrder && (
    <div className="modal-backdrop">
     <div className="modal-content max-w-sm">
      <div className="modal-header">
       <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('addDeposit') || 'Add Deposit'}</h2>
        <p className="text-sm text-slate-500 mt-0.5">{depositOrder.customer_name} — #{depositOrder.sequence_number}</p>
       </div>
       <button onClick={() => setShowDepositModal(false)} className="p-2.5 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors border border-neutral-200 dark:border-neutral-700">
        <X size={22} />
       </button>
      </div>
      <div className="modal-body">
       <form id="deposit-form" onSubmit={handleAddDeposit} className="space-y-6">
        <div className="p-6 bg-neutral-50 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
         <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-slate-500">{t('currentDeposit') || 'Current Deposit'}:</span>
          <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">ETB {(depositOrder.deposit_amount || 0).toLocaleString()}</span>
         </div>
         <div>
          <label className="label">{t('additionalAmount') || 'Additional Amount'} (ETB) *</label>
          <input type="number" className="input-field" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} placeholder="0.00" required min="1" />
         </div>
        </div>
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
  </div>
  )
}

export default Orders
