import React, { useState, useEffect } from 'react'
import { ArrowLeftRight, Plus, Search, Filter, Clock, CheckCircle2, XCircle, Loader2, X } from 'lucide-react'
import api from '../services/api'
import { toast } from 'react-toastify'
import { useLanguage } from '../i18n/LanguageContext'

const Transfers = ({ user }) => {
 const { t } = useLanguage()
 const [transfers, setTransfers] = useState([])
 const [loading, setLoading] = useState(true)
 const [showNewRequest, setShowNewRequest] = useState(false)
 const [vehicles, setVehicles] = useState([])
 const [branches, setBranches] = useState([])
 const [submitting, setSubmitting] = useState(false)
 const [requestItemType, setRequestItemType] = useState('vehicle')

 useEffect(() => {
  fetchTransfers()
  fetchInventory()
 }, [])

 const fetchTransfers = async () => {
  setLoading(true)
  try {
   const res = await api.get('/transfers')
   setTransfers(res.data)
  } catch (error) {
   toast.error('Failed to fetch transfers')
  } finally {
   setLoading(false)
  }
 }

 const [spareParts, setSpareParts] = useState([])
 const fetchInventory = async () => {
  try {
   const [vRes, sRes, bRes] = await Promise.all([
    api.get('/inventory/vehicles'),
    api.get('/inventory/spare-parts'),
    api.get('/branches')
   ])
   setVehicles(vRes.data)
   setSpareParts(sRes.data)
   setBranches(bRes.data)
  } catch (error) {
   console.error('Failed to fetch inventory/branches')
  }
 }

 const getBranchName = (id) => {
  return branches.find(b => b.id === id)?.name || `Branch ${id}`
 }

 const handleRequest = async (e) => {
  e.preventDefault()
  setSubmitting(true)
  const form = e.target;
  const fromBranchId = parseInt(form.from_branch_id.value)
  const toBranchId = parseInt(form.to_branch_id.value)

  if (fromBranchId === toBranchId) {
   toast.error('Cannot transfer to the same branch')
   setSubmitting(false)
   return
  }

  const formData = {
   from_branch_id: fromBranchId,
   to_branch_id: toBranchId,
   item_type: form.item_type.value,
   item_id: parseInt(form.item_id.value),
   quantity: parseInt(form.quantity.value || 1),
   user_id: user?.id
  }

  try {
   await api.post('/transfers/request', formData)
   toast.success('Transfer request sent')
   setShowNewRequest(false)
   fetchTransfers()
  } catch (error) {
   toast.error('Failed to send request')
  } finally {
   setSubmitting(false)
  }
 }

 const handleApprove = async (id) => {
  try {
   await api.put(`/transfers/${id}/approve`)
   toast.success('Transfer approved and inventory updated')
   fetchTransfers()
  } catch (error) {
   toast.error('Approval failed')
  }
 }

 return (
  <div className="space-y-6">
   <div className="flex items-center justify-between">
    <div>
     <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{t('transfersTitle')}</h1>
     <p className="text-slate-400 mt-1">{t('transfersDesc')}</p>
    </div>
    <button 
     onClick={() => setShowNewRequest(true)}
     className="btn-primary flex items-center gap-2"
    >
     <Plus size={20} />
     {t('newTransfer')}
    </button>
   </div>

   <div className="glass-card overflow-hidden">
    {loading ? (
     <div className="flex flex-col items-center justify-center py-20">
      <Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={40} />
     </div>
    ) : (
     <table className="w-full text-left">
      <thead>
       <tr className="bg-white/5 border-b border-slate-200 dark:border-slate-300 dark:border-slate-700 text-xs text-slate-400 uppercase">
        <th className="px-6 py-4">{t('date')}</th>
        <th className="px-6 py-4">{t('fromBranch')}</th>
        <th className="px-6 py-4">{t('toBranch')}</th>
        <th className="px-6 py-4">{t('item')}</th>
        <th className="px-6 py-4">{t('statusHeader')}</th>
        <th className="px-6 py-4 text-right">{t('actions')}</th>
       </tr>
      </thead>
      <tbody className="divide-y divide-white/5">
       {(transfers || []).map(transfer => (
        <tr key={transfer.id} className="hover:bg-white/5 transition-colors">
         <td className="px-6 py-4 text-slate-400 text-sm">{new Date(transfer.date).toLocaleDateString()}</td>
         <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{getBranchName(transfer.from_branch)}</td>
         <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{getBranchName(transfer.to_branch)}</td>
         <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
          {transfer.item_type === 'vehicle' ? `Vehicle (ID: ${transfer.item_id})` : `Spare Part`}
         </td>
         <td className="px-6 py-4">
          <span className={`flex items-center gap-1.5 text-xs font-bold uppercase ${
           transfer.status === 'pending' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
          }`}>
           {transfer.status === 'pending' ? <Clock size={14} /> : <CheckCircle2 size={14} />}
           {transfer.status}
          </span>
         </td>
         <td className="px-6 py-4 text-right">
          {transfer.status === 'pending' && user?.role === 'admin' && (
           <button 
            onClick={() => handleApprove(transfer.id)}
            className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:bg-emerald-900/50 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 transition-colors"
           >
            {t('approve')}
           </button>
          )}
         </td>
        </tr>
       ))}
      </tbody>
     </table>
    )}
   </div>

   {/* Request Transfer Modal */}
    {showNewRequest && (
     <div className="modal-backdrop">
      <div className="modal-content max-w-xl">
       <div className="modal-header">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('requestTransfer')}</h2>
          <p className="text-xs font-medium text-slate-500 mt-0.5">{t('interBranchLogistics')}</p>
        </div>
        <button onClick={() => setShowNewRequest(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-slate-700">
         <X size={20} />
        </button>
       </div>

       <div className="modal-body custom-scrollbar">
        <form id="transfer-form" onSubmit={handleRequest} className="space-y-6">
         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
           <div>
            <label className="label">{t('fromBranchLabel')} *</label>
            <select name="from_branch_id" className="input-field" defaultValue={user?.branch_id || ''}>
             <option value="">{t('selectBranch')}</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name.toUpperCase()}</option>)}
           </select>
          </div>
           <div>
            <label className="label">{t('toBranchLabel')} *</label>
            <select name="to_branch_id" className="input-field">
             <option value="">{t('selectBranch')}</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name.toUpperCase()}</option>)}
           </select>
          </div>
         </div>
         
         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
           <div>
            <label className="label">{t('itemType')} *</label>
            <select 
             name="item_type" 
             className="input-field" 
             value={requestItemType}
             onChange={(e) => setRequestItemType(e.target.value)}
            >
             <option value="vehicle">{t('vehicle').toUpperCase()}</option>
             <option value="spare_part">{t('sparePart').toUpperCase()}</option>
            </select>
          </div>
           <div>
            <label className="label">{t('qty')} *</label>
            <input type="number" name="quantity" min="1" defaultValue="1" className="input-field" />
           </div>
          </div>

         <div>
          <label className="label">{t('item')} *</label>
          <select name="item_id" required className="input-field">
           <option value="">{t('chooseItem')}</option>
           {requestItemType === 'vehicle' ? (
            vehicles.length > 0 ? (
             vehicles.map(v => (
              <option key={`v-${v.id}`} value={v.id}>{v.model.toUpperCase()} ({v.vin})</option>
             ))
            ) : (
             <option disabled>{t('noVehiclesAvailable')}</option>
            )
           ) : (
            spareParts.length > 0 ? (
             spareParts.map(p => (
              <option key={`p-${p.id}`} value={p.id}>{p.name.toUpperCase()} - {t('qty')}: {p.quantity}</option>
             ))
            ) : (
             <option disabled>{t('noSparePartsAvailable')}</option>
            )
           )}
         </select>
        </div>
        </form>
       </div>

       <div className="modal-footer">
        <button type="button" onClick={() => setShowNewRequest(false)} className="btn-secondary">{t('cancel')}</button>
        <button form="transfer-form" type="submit" disabled={submitting} className="btn-primary flex items-center gap-2 px-10">
         {submitting ? <Loader2 className="animate-spin" size={16} /> : null}
         {t('sendRequest')}
        </button>
       </div>
      </div>
     </div>
    )}
  </div>
 )
}

export default Transfers
