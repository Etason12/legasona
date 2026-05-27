import React, { useState, useEffect, useMemo } from 'react'
import {
 ShoppingBag, Plus, Loader2, Trash2, X, Check, Search,
 ChevronDown, ChevronUp, Package, Truck, Image as ImageIcon
} from 'lucide-react'
import api from '../services/api'
import axios from 'axios'
import { toast } from 'react-toastify'
import { useLanguage } from '../i18n/LanguageContext'
import { formatDate } from '../utils/format'

const ITEM_TYPES = ['vehicle', 'spare_part', 'accessory', 'other']
const PAYMENT_METHODS = ['cash', 'bank_transfer', 'credit']

const canCreate = (role) => ['admin', 'manager', 'storekeeper'].includes(role?.toLowerCase())
const canDelete = (role) => ['admin', 'manager'].includes(role?.toLowerCase())

const Purchases = ({ user }) => {
 const [purchases, setPurchases] = useState([])
 const [loading, setLoading] = useState(true)
 const [showModal, setShowModal] = useState(false)
 const [saving, setSaving] = useState(false)
 const [expanded, setExpanded] = useState(null)
 const [previewImage, setPreviewImage] = useState(null)
 const [inventory, setInventory] = useState({ vehicles: [], spareParts: [] })
 const [branches, setBranches] = useState([])
 const [search, setSearch] = useState('')
 const [form, setForm] = useState({
  supplier_name: '', item_type: 'vehicle', payment_method: 'cash', branch_id: '',
  items: [{ description: '', quantity: 1, unit_cost: '', existing_id: null }]
 })

 const { t } = useLanguage()
 const role = user?.role
 const filteredPurchases = useMemo(() => purchases.filter(p =>
  p.supplier_name?.toLowerCase().includes(search.toLowerCase()) ||
  p.items?.some(it => it.description?.toLowerCase().includes(search.toLowerCase()))
 ), [purchases, search])

 useEffect(() => {
  Promise.all([fetchPurchases(), fetchInventory()])
 }, [])

 const fetchInventory = async () => {
  try {
   const [vRes, sRes, bRes] = await Promise.all([
    api.get('/inventory/vehicles'),
    api.get('/inventory/spare-parts'),
    api.get('/branches')
   ])
   setInventory({ vehicles: vRes.data, spareParts: sRes.data })
   setBranches(bRes.data)
   if (bRes.data.length > 0 && !form.branch_id) {
    setForm(f => ({ ...f, branch_id: bRes.data[0].id }))
   }
  } catch {}
 }

 const fetchPurchases = async () => {
  setLoading(true)
  try {
   const branchId = user?.role?.toLowerCase() === 'admin' ? '' : (user?.branch_id || '')
   const res = await api.get(`/purchases?branch_id=${branchId}`)
   setPurchases(res.data)
  } catch { toast.error('Failed to load purchases') }
  finally { setLoading(false) }
 }

 const addLineItem = () => setForm(f => ({ ...f, items: [...f.items, { description: '', quantity: 1, unit_cost: '', existing_id: null }] }))
 const removeLineItem = idx => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))
 const setItem = (idx, k, v) => setForm(f => {
  const items = [...f.items]
  items[idx] = { ...items[idx], [k]: v }
  return { ...f, items }
 })

 const lineTotal = form.items.reduce((sum, i) => sum + (parseFloat(i.quantity || 0) * parseFloat(i.unit_cost || 0)), 0)

 const handleSubmit = async e => {
  e.preventDefault()
  setSaving(true)
  try {
   const formData = new FormData()
   formData.append('data', JSON.stringify({ ...form, user_id: user?.id }))
   
   const fileInput = document.getElementById('receipt-upload')
   if (fileInput && fileInput.files[0]) {
    formData.append('receipt', fileInput.files[0])
   }

   await api.post('/purchases', formData)
   toast.success('Purchase recorded successfully')
   setShowModal(false)
   setForm({ supplier_name: '', item_type: 'vehicle', payment_method: 'cash', branch_id: 1, items: [{ description: '', quantity: 1, unit_cost: '', existing_id: null }] })
   fetchPurchases()
   fetchInventory()
  } catch (err) {
   toast.error(err.response?.data?.message || 'Failed to record purchase')
  } finally { setSaving(false) }
 }

 const handleDelete = async id => {
  if (!window.confirm(t('deletePurchaseConfirm'))) return
  try {
   await api.delete(`/purchases/${id}`)
   toast.success('Purchase deleted')
   fetchPurchases()
  } catch { toast.error('Failed to delete') }
 }

 const totalSpend = purchases.reduce((s, p) => s + (p.total_amount || 0), 0)

 return (
  <div className="space-y-8">
   {/* Header */}
   <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
    <div>
     <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{t('purchaseRecords')}</h1>
     <p className="text-slate-400 mt-1 font-medium">{t('purchaseDesc')}</p>
    </div>
    {canCreate(role) && (
     <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
      <Plus size={20}/> {t('recordPurchase')}
     </button>
    )}
   </div>

   {/* KPI strip */}
   <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
    <div className="glass-card px-6 py-5">
     <p className="text-xs text-slate-500 font-bold ">{t('totalSpend')}</p>
     <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">ETB {totalSpend.toLocaleString()}</p>
    </div>
    <div className="glass-card px-6 py-5">
     <p className="text-xs text-slate-500 font-bold ">{t('totalPurchases')}</p>
     <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">{purchases.length}</p>
    </div>
    <div className="glass-card px-6 py-5">
     <p className="text-xs text-slate-500 font-bold ">{t('thisMonth')}</p>
     <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
      ETB {purchases
       .filter(p => new Date(p.purchase_date).getMonth() === new Date().getMonth())
       .reduce((s, p) => s + p.total_amount, 0)
       .toLocaleString()}
     </p>
    </div>
   </div>
   
   <div className="flex justify-end">
    <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-300 dark:border-slate-700 px-4 py-2 rounded-xl w-full md:w-64">
     <Search size={18} className="text-slate-500" />
     <input 
      type="text" 
      placeholder={t('searchSupplierItem')} 
      className="bg-transparent border-none outline-none text-sm w-full text-slate-600 dark:text-slate-300"
      value={search}
      onChange={(e) => setSearch(e.target.value)}
     />
    </div>
   </div>

   {/* List */}
   <div className="space-y-3">
    {loading ? (
     <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={40}/></div>
     ) : filteredPurchases.length === 0 ? (
      <div className="glass-card py-20 text-center text-slate-500">{t('noPurchasesFound')}</div>
     ) : filteredPurchases.map(pu => (
     <div key={pu.id} className="glass-card overflow-hidden">
      <div
       className="flex items-center justify-between p-5 cursor-pointer hover:bg-slate-100 dark:bg-slate-800/50 transition-colors"
       onClick={() => setExpanded(expanded === pu.id ? null : pu.id)}
      >
       <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
         <Truck size={22}/>
        </div>
        <div>
         <p className="text-slate-900 dark:text-white font-bold">{pu.supplier_name}</p>
         <p className="text-xs text-slate-500 mt-0.5">
          {t(pu.item_type)} · {t(pu.payment_method === 'bank_transfer' ? 'bankTransferShort' : pu.payment_method)} · {formatDate(pu.purchase_date)}
         </p>
        </div>
       </div>
       <div className="flex items-center gap-4">
        <div className="text-right">
         <p className="text-slate-900 dark:text-white font-bold">ETB {parseFloat(pu.total_amount).toLocaleString()}</p>
         <p className="text-xs text-slate-500 uppercase">{pu.branch_id === 1 ? 'Shire' : 'Mekelle'}</p>
        </div>
        {pu.receipt_attachment && (
          <button 
           onClick={e => {
            e.stopPropagation();
            setPreviewImage(pu.receipt_attachment);
           }}
           className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:bg-blue-900/50 rounded-xl transition-colors"
           title="View Receipt"
          >
           <ImageIcon size={16}/>
          </button>
        )}
        {canDelete(role) && (
         <button
          onClick={e => { e.stopPropagation(); handleDelete(pu.id) }}
          className="p-2 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-200 dark:bg-rose-900/50 rounded-xl transition-colors"
         ><Trash2 size={16}/></button>
        )}
        {expanded === pu.id ? <ChevronUp size={18} className="text-slate-500"/> : <ChevronDown size={18} className="text-slate-500"/>}
       </div>
      </div>
      {expanded === pu.id && pu.items?.length > 0 && (
       <div className="border-t border-slate-300 dark:border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
        <table className="w-full text-left">
         <thead>
          <tr className="text-xs font-bold text-slate-500 border-b border-slate-300 dark:border-slate-300 dark:border-slate-700">
           <th className="px-6 py-3">{t('descSelect')}</th>
           <th className="px-6 py-3">{t('qty')}</th>
           <th className="px-6 py-3">{t('unitCost')}</th>
           <th className="px-6 py-3 text-right">{t('subtotal')}</th>
          </tr>
         </thead>
         <tbody className="divide-y divide-slate-800/50">
          {pu.items.map((it, idx) => (
           <tr key={idx} className="text-sm">
            <td className="px-6 py-3 text-slate-600 dark:text-slate-300">{it.description}</td>
            <td className="px-6 py-3 text-slate-400">{it.quantity}</td>
            <td className="px-6 py-3 text-slate-400">ETB {parseFloat(it.unit_cost).toLocaleString()}</td>
            <td className="px-6 py-3 text-right text-slate-900 dark:text-white font-bold">ETB {(it.quantity * it.unit_cost).toLocaleString()}</td>
           </tr>
          ))}
         </tbody>
        </table>
       </div>
      )}
     </div>
    ))}
   </div>

   {showModal && (
     <div className="modal-backdrop">
      <div className="modal-content max-w-5xl">
       <div className="modal-header">
        <div>
         <h2 className="text-xl font-bold text-slate-900 dark:text-white er">{t('recordNewPurchase')}</h2>
         <p className="text-xs font-medium text-slate-500 mt-0.5">{t('enterpriseProcurementSystem')}</p>
        </div>
        <button onClick={() => setShowModal(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-slate-700"><X size={20}/></button>
       </div>

      <div className="modal-body custom-scrollbar">
       <form id="purchase-form" onSubmit={handleSubmit} className="space-y-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
         {/* General Info */}
         <div className="lg:col-span-4 space-y-8">
          <div className="p-8 bg-slate-100 dark:bg-slate-800 rounded-[2.5rem] border border-slate-200 dark:border-slate-300 dark:border-slate-700 space-y-6">
           <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 ">{t('sourceAndLogistics')}</h3>
           <div className="space-y-4">
            <div>
             <label className="label">{t('supplierName')}</label>
             <input required className="input-field" placeholder="e.g. Addis Tyre Trading" value={form.supplier_name} onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))}/>
            </div>
            <div>
             <label className="label">{t('branch')}</label>
             <select className="input-field bg-slate-900" value={form.branch_id} onChange={e => setForm(f => ({ ...f, branch_id: parseInt(e.target.value) }))}>
              <option value="">{t('selectBranch')}</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name.toUpperCase()}</option>)}
             </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
             <div>
              <label className="label">{t('itemType')}</label>
              <select className="input-field bg-slate-900" value={form.item_type} onChange={e => setForm(f => ({ ...f, item_type: e.target.value }))}>
               {ITEM_TYPES.map(it => <option key={it} value={it}>{t(it).toUpperCase()}</option>)}
              </select>
             </div>
             <div>
              <label className="label">{t('paymentMethod')}</label>
              <select className="input-field bg-slate-900" value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
               {PAYMENT_METHODS.map(m => <option key={m} value={m}>{t(m === 'bank_transfer' ? 'bankTransferShort' : m).toUpperCase()}</option>)}
              </select>
             </div>
            </div>
           </div>
          </div>

          <div className="p-8 bg-slate-100 dark:bg-slate-800 rounded-[2.5rem] border border-slate-200 dark:border-slate-300 dark:border-slate-700 space-y-4">
           <label className="label">{t('receiptAttachment')}</label>
           <div className="relative group">
            <input type="file" id="receipt-upload" className="hidden" accept="image/*,application/pdf" />
            <label 
             htmlFor="receipt-upload"
             className="flex flex-col items-center justify-center gap-2 w-full py-6 border-2 border-dashed border-slate-300 dark:border-slate-300 dark:border-slate-700 rounded-3xl text-slate-500 hover:text-slate-900 dark:text-white hover:border-primary-500/50 transition-colors cursor-pointer bg-slate-900/20 group-hover:bg-primary-500/5"
            >
             <Package size={20} />
             <span className="text-xs font-bold ">{t('uploadInvoice')}</span>
            </label>
           </div>
          </div>
         </div>

         {/* Line Items */}
         <div className="lg:col-span-8 space-y-8">
          <div className="p-8 bg-slate-100 dark:bg-slate-800 rounded-[2.5rem] border border-slate-200 dark:border-slate-300 dark:border-slate-700 space-y-6">
           <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 ">{t('manifestItems')}</h3>
            <button type="button" onClick={addLineItem} className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 hover:bg-primary-600/20 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-400 transition-colors flex items-center gap-2">
             <Plus size={14}/> {t('addRow')}
            </button>
           </div>

           <div className="space-y-4">
            {form.items.map((item, idx) => (
             <div key={idx} className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-200 dark:bg-slate-700 border border-slate-200 dark:border-slate-300 dark:border-slate-700 relative group">
              <div className="grid grid-cols-12 gap-4 items-end">
               <div className="col-span-12 sm:col-span-5">
                <label className="label">{t('descSelect')}</label>
                <div className="flex gap-2">
                 <input className="input-field py-2" placeholder={t('descSelect')} value={item.description} onChange={e => setItem(idx, 'description', e.target.value)}/>
                 <select className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-300 dark:border-slate-700 rounded-xl px-2 text-xs text-slate-400 w-24"
                  onChange={(e) => {
                   if (!e.target.value) return;
                   const itm = JSON.parse(e.target.value);
                   setItem(idx, 'description', itm.name || itm.model);
                   setItem(idx, 'existing_id', itm.id);
                  }}>
                   <option value="">{t('inventoryTitle')}</option>
                  <optgroup label={t('sparePartsGroup')}>
                   {inventory.spareParts.map(p => <option key={p.id} value={JSON.stringify(p)}>{p.name}</option>)}
                  </optgroup>
                  <optgroup label={t('vehiclesGroup')}>
                   {inventory.vehicles.map(v => <option key={v.id} value={JSON.stringify(v)}>{v.model}</option>)}
                  </optgroup>
                 </select>
                </div>
               </div>
               <div className="col-span-4 sm:col-span-2">
                <label className="label">{t('qty')}</label>
                <input type="number" className="input-field py-2" placeholder="1" min="1" value={item.quantity} onChange={e => setItem(idx, 'quantity', e.target.value)}/>
               </div>
               <div className="col-span-8 sm:col-span-4">
                <label className="label">{t('unitCost')}</label>
                <input type="number" className="input-field py-2" placeholder="0.00" value={item.unit_cost} onChange={e => setItem(idx, 'unit_cost', e.target.value)}/>
               </div>
               <div className="col-span-12 sm:col-span-1 flex justify-end">
                {form.items.length > 1 && (
                 <button type="button" onClick={() => removeLineItem(idx)} className="p-2 text-rose-500/50 hover:text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:bg-rose-900/30 rounded-xl transition-colors"><Trash2 size={16}/></button>
                )}
               </div>
              </div>
             </div>
            ))}
           </div>
          </div>

          <div className="p-8 bg-blue-50 dark:bg-blue-900/20 rounded-[2.5rem] border border-blue-100 dark:border-blue-800 flex items-center justify-between">
           <div>
            <p className="text-xs font-bold text-slate-500 ">{t('totalAmount')}</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2 tracking-tighter">ETB {lineTotal.toLocaleString()}</p>
           </div>
           <div className="text-right">
            <p className="text-xs font-bold text-slate-500 ">{t('totalUnits')}</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-2">{form.items.reduce((s, i) => s + (parseInt(i.quantity) || 0), 0)}</p>
           </div>
          </div>
         </div>
        </div>
       </form>
      </div>

      <div className="modal-footer">
        <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">{t('cancel')}</button>
        <button form="purchase-form" type="submit" disabled={saving} className="btn-primary flex items-center gap-2 px-10">
         {saving ? <Loader2 size={16} className="animate-spin"/> : <Check size={16}/>}
         {t('recordPurchase')}
        </button>
       </div>
     </div>
    </div>
   )}

   {/* Image Preview Modal */}
   {previewImage && (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/90 dark:bg-slate-950/90 " onClick={() => setPreviewImage(null)}>
     <div className="relative max-w-4xl w-full" onClick={e => e.stopPropagation()}>
      <button 
       onClick={() => setPreviewImage(null)}
       className="absolute -top-12 right-0 p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-900 dark:text-white hover:bg-slate-800 transition-colors"
      >
       <X size={24} />
      </button>
      <img 
       src={previewImage} 
       alt="Receipt Preview" 
       className="w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-slate-300 dark:border-slate-300 dark:border-slate-700"
      />
     </div>
    </div>
   )}
  </div>
 )
}

export default Purchases
