import React, { useState, useEffect } from 'react'
import { 
 Users, Search, Plus, Mail, Phone, MapPin, 
 History, CreditCard, Award, Loader2, X, Check,
 ExternalLink, Building2, User as UserIcon, Edit3, Trash2
} from 'lucide-react'
import api from '../services/api'
import { toast } from 'react-toastify'
import { useLanguage } from '../i18n/LanguageContext'
import { isAdmin } from '../utils/roles'

const Customers = ({ user }) => {
 const { t } = useLanguage()
 const [customers, setCustomers] = useState([])
 const [loading, setLoading] = useState(true)
 const [search, setSearch] = useState('')
 const [showModal, setShowModal] = useState(false)
 const [selectedCustomer, setSelectedCustomer] = useState(null)
 const [showDetails, setShowDetails] = useState(null) // customer ID
 const [customerDetails, setCustomerDetails] = useState(null)
 const [saving, setSaving] = useState(false)
 const [form, setForm] = useState({
  full_name: '', phone: '', email: '', address: '', type: 'individual', credit_limit: 0
 })

 useEffect(() => {
  fetchCustomers()
 }, [search])

 const fetchCustomers = async () => {
  setLoading(true)
  try {
   const res = await api.get(`/customers?search=${search}`)
   setCustomers(res.data)
  } catch {
   toast.error('Failed to load customers')
  } finally {
   setLoading(false)
  }
 }

 const fetchDetails = async (id) => {
  try {
   const res = await api.get(`/customers/${id}`)
   setCustomerDetails(res.data)
   setShowDetails(id)
  } catch {
   toast.error('Failed to load customer details')
  }
 }

 const handleDelete = async (id, e) => {
  e?.stopPropagation()
  if (!window.confirm(t('confirmDelete'))) return
  try {
   await api.delete(`/customers/${id}`)
   toast.success('Customer deleted')
   fetchCustomers()
  } catch (err) {
   toast.error(err.response?.data?.message || 'Failed to delete customer')
  }
 }

 const handleSubmit = async (e) => {
  e.preventDefault()
  setSaving(true)
  try {
   if (selectedCustomer) {
    await api.put(`/customers/${selectedCustomer.id}`, form)
    toast.success('Customer updated')
   } else {
    await api.post('/customers', { ...form, branch_id: user?.branch_id })
    toast.success('Customer added')
   }
   setShowModal(false)
   fetchCustomers()
  } catch (err) {
   toast.error(err.response?.data?.message || 'Failed to save customer')
  } finally {
   setSaving(false)
  }
 }

 return (
  <div className="space-y-8">
   <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
    <div>
     <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{t('customersTitle')}</h1>
     <p className="text-slate-400 mt-1 font-medium">{t('customersDesc')}</p>
    </div>
    <button 
     onClick={() => {
      setSelectedCustomer(null)
      setForm({ full_name: '', phone: '', email: '', address: '', type: 'individual', credit_limit: 0 })
      setShowModal(true)
     }}
     className="btn-primary flex items-center gap-2"
    >
     <Plus size={20} />
     {t('addCustomer')}
    </button>
   </div>

   <div className="relative max-w-md group">
    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-600 dark:text-blue-400 transition-colors" size={18} />
    <input 
     type="text" 
     placeholder={t('searchCustomer')} 
     className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-300 dark:border-slate-700 rounded-xl py-2.5 pl-12 pr-4 text-sm text-slate-900 dark:text-white focus:border-primary-500 outline-none transition-colors"
     value={search}
     onChange={(e) => setSearch(e.target.value)}
    />
   </div>

    <div className="glass-card overflow-hidden">
     {loading ? (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
       <Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={40} />
       <p className="text-slate-500 animate-pulse">Syncing customer database...</p>
      </div>
     ) : customers.length === 0 ? (
      <div className="text-center py-20 text-slate-500">{t('noCustomers')}</div>
     ) : (
      <div className="overflow-x-auto custom-scrollbar">
       <table className="w-full text-left min-w-[700px]">
        <thead>
         <tr className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-xs font-bold text-slate-500">
          <th className="px-6 py-4">{t('fullName')}</th>
          <th className="px-6 py-4 hidden sm:table-cell">{t('phoneNumber')}</th>
          <th className="px-6 py-4 hidden md:table-cell">{t('emailAddress')}</th>
          <th className="px-6 py-4">{t('customerType')}</th>
          <th className="px-6 py-4 text-center">{t('loyaltyPoints')}</th>
          <th className="px-6 py-4 text-right">{t('actions')}</th>
         </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
         {customers.map(c => (
          <tr key={c.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-colors group cursor-pointer" onClick={() => fetchDetails(c.id)}>
           <td className="px-6 py-4">
            <div className="flex items-center gap-3">
             <div className="w-9 h-9 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-blue-600 dark:text-blue-400 border border-neutral-200 dark:border-neutral-700">
              {c.type === 'corporate' ? <Building2 size={16} /> : <UserIcon size={16} />}
             </div>
             <div>
              <p className="text-slate-900 dark:text-white font-bold text-sm">{c.full_name}</p>
              {c.address && <p className="text-xs text-slate-500 mt-0.5">{c.address}</p>}
             </div>
            </div>
           </td>
           <td className="px-6 py-4 hidden sm:table-cell">
            <p className="text-slate-700 dark:text-slate-300 text-sm font-medium">{c.phone}</p>
           </td>
           <td className="px-6 py-4 hidden md:table-cell">
            <p className="text-slate-500 text-sm">{c.email || '—'}</p>
           </td>
           <td className="px-6 py-4">
            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase border ${
             c.type === 'corporate' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-slate-800 text-slate-400 border-slate-300 dark:border-slate-700'
            }`}>
             {c.type}
            </span>
           </td>
           <td className="px-6 py-4 text-center">
            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
             <Award size={14} className="text-amber-600 dark:text-amber-400" />
             {c.points ?? 0}
            </span>
           </td>
           <td className="px-6 py-4 text-right">
            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
             <button
              onClick={() => { setSelectedCustomer(c); setForm({ full_name: c.full_name, phone: c.phone, email: c.email || '', address: c.address || '', type: c.type, credit_limit: c.credit_limit || 0 }); setShowModal(true) }}
              className="p-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              title={t('edit')}
             ><Edit3 size={15}/></button>
             {isAdmin(user) && (
              <button onClick={(e) => handleDelete(c.id, e)} className="p-2 bg-rose-100 dark:bg-rose-900/30 hover:bg-rose-200 dark:hover:bg-rose-900/50 rounded-lg text-rose-600 transition-colors" title={t('delete')}><Trash2 size={15}/></button>
             )}
             <button className="p-2 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded-lg text-blue-600 dark:text-blue-400 transition-colors" title={t('viewHistory')}><ExternalLink size={15}/></button>
            </div>
           </td>
          </tr>
         ))}
        </tbody>
       </table>
      </div>
     )}
    </div>

   {/* Customer Details Modal */}
   {showDetails && customerDetails && (
    <div className="modal-backdrop">
     <div className="modal-content max-w-2xl">
      <div className="modal-header">
       <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white er">{t('viewHistory')}</h2>
         <p className="text-xs font-bold text-slate-500 mt-1">{t('crmProfile')}</p>
       </div>
       <button onClick={() => setShowDetails(null)} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-400 hover:text-slate-900 dark:text-white transition-colors shadow-xl border border-slate-200 dark:border-slate-300 dark:border-slate-700"><X size={24}/></button>
      </div>

      <div className="modal-body custom-scrollbar">
       <div className="space-y-10">
        <div className="p-8 bg-slate-100 dark:bg-slate-800 rounded-[2.5rem] border border-slate-200 dark:border-slate-300 dark:border-slate-700 ">
         <div className="flex items-center gap-6 mb-8">
          <div className="w-20 h-20 rounded-[2rem] bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shadow-2xl">
           <UserIcon size={40} />
          </div>
          <div>
           <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{customerDetails.full_name}</h3>
           <div className="flex items-center gap-2 mt-1">
            <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">{customerDetails.type}</span>
            <span className="text-xs font-bold text-slate-600 ">ID: {customerDetails.id}</span>
           </div>
          </div>
         </div>
         <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          <div><label className="label">{t('phoneNumber')}</label><p className="text-slate-900 dark:text-white font-bold">{customerDetails.phone}</p></div>
          <div><label className="label">{t('emailAddress')}</label><p className="text-slate-900 dark:text-white font-bold">{customerDetails.email || '—'}</p></div>
          <div className="sm:col-span-2"><label className="label">{t('operationalAddress')}</label><p className="text-slate-900 dark:text-white font-bold leading-relaxed">{customerDetails.address || '—'}</p></div>
         </div>
        </div>

        <div className="space-y-6">
         <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-4">
          <div className="flex items-center gap-3">
           <History size={20} className="text-blue-600 dark:text-blue-400" />
           <h4 className="font-bold uppercase text-xs tracking-[0.2em] text-slate-900 dark:text-white">{t('salesHistoryLabel')}</h4>
          </div>
          <span className="px-3 py-1 rounded-full bg-slate-800 text-xs font-bold text-slate-400">{customerDetails.history.sales.length} Records</span>
         </div>
         
         <div className="space-y-4">
          {customerDetails.history.sales.length === 0 ? (
           <div className="p-10 rounded-3xl bg-slate-50 dark:bg-slate-200 dark:bg-slate-700 border border-dashed border-slate-300 dark:border-slate-300 dark:border-slate-700 text-center">
             <p className="text-slate-600 text-sm font-bold ">{t('noTransactionHistory')}</p>
           </div>
          ) : customerDetails.history.sales.map(s => (
           <div key={s.id} className="p-6 rounded-[2rem] bg-slate-50 dark:bg-slate-200 dark:bg-slate-700 border border-slate-200 dark:border-slate-300 dark:border-slate-700 flex items-center justify-between hover:border-primary-500/30 transition-colors group">
            <div className="flex items-center gap-4">
             <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-500 group-hover:text-blue-600 dark:text-blue-400 transition-colors">
              <CreditCard size={18} />
             </div>
             <div>
               <p className="text-slate-900 dark:text-white font-bold text-sm tracking-tight">Invoice #{s.number}</p>
               <p className="text-xs text-slate-500 font-bold mt-0.5">{new Date(s.date).toLocaleDateString()}</p>
               {s.item_name && (
                <p className="text-xs text-blue-600 dark:text-blue-400 font-bold mt-1">
                 {s.item_name}{s.item_detail ? ` — ${s.item_detail}` : ''}
                </p>
               )}
              </div>
            </div>
            <div className="text-right">
             <p className="text-slate-900 dark:text-white font-bold text-sm tracking-tight">ETB {s.amount.toLocaleString()}</p>
             <div className="flex items-center gap-1.5 justify-end mt-1">
               <div className={`w-1.5 h-1.5 rounded-full ${s.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
               <span className={`text-xs font-bold ${s.status === 'completed' ? 'text-emerald-500' : 'text-amber-500'}`}>{s.status}</span>
             </div>
            </div>
           </div>
          ))}
         </div>
        </div>
       </div>
      </div>
     </div>
    </div>
   )}

   {/* Add/Edit Modal */}
   {showModal && (
    <div className="modal-backdrop">
     <div className="modal-content max-w-2xl">
      <div className="modal-header">
       <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white er">{selectedCustomer ? t('edit') : t('addCustomer')}</h2>
        <p className="text-xs font-bold text-slate-500 mt-1">{t('customersTitle')}</p>
       </div>
       <button onClick={() => setShowModal(false)} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-400 hover:text-slate-900 dark:text-white transition-colors shadow-xl border border-slate-200 dark:border-slate-300 dark:border-slate-700"><X size={24}/></button>
      </div>

      <div className="modal-body custom-scrollbar">
       <form id="customer-form" onSubmit={handleSubmit} className="space-y-10">
        <div className="p-8 bg-slate-100 dark:bg-slate-800 rounded-[2.5rem] border border-slate-200 dark:border-slate-300 dark:border-slate-700 space-y-6">
         <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 ">{t('coreIdentification')}</h3>
         <div className="grid grid-cols-1 gap-6">
          <div>
           <label className="label">{t('fullName')} *</label>
           <input required className="input-field" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} placeholder="e.g. Abebe Kebede" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
           <div><label className="label">{t('phoneNumber')} *</label><input required className="input-field" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="0911..." /></div>
            <div><label className="label">{t('emailAddress')}</label><input type="email" className="input-field" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="abebe@example.com" /></div>
          </div>
         </div>
        </div>

        <div className="p-8 bg-slate-100 dark:bg-slate-800 rounded-[2.5rem] border border-slate-200 dark:border-slate-300 dark:border-slate-700 space-y-6">
         <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 ">{t('profilingLimits')}</h3>
         <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
           <label className="label">{t('customerType')}</label>
           <select className="input-field bg-slate-900" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
            <option value="individual">{t('individual').toUpperCase()}</option>
            <option value="corporate">{t('corporate').toUpperCase()}</option>
           </select>
          </div>
          <div>
           <label className="label">{t('creditLimit')} (ETB)</label>
           <input type="number" className="input-field" value={form.credit_limit} onChange={e => setForm({...form, credit_limit: e.target.value})} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">{t('operationalAddress')}</label>
           <textarea className="input-field h-24 resize-none" value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="e.g. Addis Ababa, Bole" />
          </div>
         </div>
        </div>
       </form>
      </div>

      <div className="modal-footer">
       <button type="button" onClick={() => setShowModal(false)} className="px-8 py-3 text-slate-500 hover:text-slate-900 dark:text-white font-bold text-xs transition-colors">{t('cancel')}</button>
       <button form="customer-form" type="submit" disabled={saving} className="btn-primary px-12">
        {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
        {t('save')}
       </button>
      </div>
     </div>
    </div>
   )}
  </div>
 )
}

export default Customers
