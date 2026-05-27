import React, { useState, useEffect, useRef } from 'react'
import {
  Search, Plus, Package, Car, Loader2, Download,
  Edit3, Trash2, X, Check, ImagePlus, AlertTriangle
} from 'lucide-react'
import api from '../services/api'
import { toast } from 'react-toastify'
import { exportInventoryToExcel } from '../services/ExportService'
import { useLanguage } from '../i18n/LanguageContext'
import EmptyState from '../components/EmptyState'

const VEHICLE_TYPES = ['2-wheel', '3-wheel', '4-wheel']
const POWER_TYPES   = ['electric', 'non-electric']
const STATUSES      = ['available', 'reserved', 'sold', 'in-transit']

const canEdit   = (role) => ['admin', 'manager', 'storekeeper'].includes(role?.toLowerCase())
const canDelete = (role) => ['admin', 'manager'].includes(role?.toLowerCase())

const ImageCell = ({ imageData, onClick }) => {
  const [error, setError] = useState(false)
  if (!imageData || error)
    return <div className="w-12 h-12 rounded-lg bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-neutral-400"><Package size={20}/></div>
  return (
    <img
      src={imageData} alt="item"
      className="w-12 h-12 rounded-lg object-cover border border-neutral-200 dark:border-neutral-700 cursor-zoom-in transition-colors"
      onClick={() => onClick(imageData)}
      onError={() => setError(true)}
    />
  )
}

const ItemModal = ({ mode, item, type, onClose, onSaved, branches }) => {
  const isEdit  = mode === 'edit'
  const fileRef = useRef()
  const [preview, setPreview] = useState(null)
  const [saving, setSaving]   = useState(false)
  const user = JSON.parse(localStorage.getItem('user'))
  const { t } = useLanguage()
  const [form, setForm] = useState(
    type === 'vehicles'
      ? { vin: '', model: '', type: '4-wheel', power_type: 'non-electric', color: '', chassis_number: '', engine_number: '', cost_price: '', selling_price: '', branch_id: item?.branch_id || (user?.branch_id || 1), status: 'available', ...item, chassis_number: item?.vin || item?.chassis_number || '' }
      : { part_number: '', name: '', category: '', quantity: '', unit_price: '', cost_price: '', branch_id: item?.branch_id || (user?.branch_id || 1), ...item }
  )

  const set = (k, v) => setForm(f => {
    const next = { ...f, [k]: v }
    if (type === 'vehicles' && k === 'vin') next.chassis_number = v
    return next
  })

  const handleFile = e => {
    const f = e.target.files[0]
    if (f) setPreview(URL.createObjectURL(f))
  }

  const handleSubmit = async e => {
    e.preventDefault()
    setSaving(true)
    const fd = new FormData()
    const payload = type === 'vehicles' ? { ...form, chassis_number: form.vin } : form
    Object.entries(payload).forEach(([k, v]) => { if (v !== undefined && v !== null) fd.append(k, v) })
    if (fileRef.current?.files[0]) fd.append('image', fileRef.current.files[0])
    try {
      if (isEdit) {
        await api.put(`/inventory/${type === 'vehicles' ? 'vehicles' : 'spare-parts'}/${item.id}`, fd)
        toast.success('Item updated')
      } else {
        await api.post(`/inventory/${type === 'vehicles' ? 'vehicles' : 'spare-parts'}`, fd)
        toast.success('Item added')
      }
      onSaved()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save item')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content max-w-5xl">
        <div className="modal-header">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{isEdit ? t('edit') : t('add')} {type === 'vehicles' ? t('vehicle') : t('sparePart')}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{t('productConfig')}</p>
          </div>
          <button onClick={onClose} className="p-2.5 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors border border-neutral-200 dark:border-neutral-700"><X size={22}/></button>
        </div>

        <div className="modal-body custom-scrollbar">
          <form id="item-form" onSubmit={handleSubmit} className="space-y-10">
            {/* Image Upload */}
            <div className="flex flex-col md:flex-row items-center gap-8 p-8 bg-neutral-50 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
              <div className="w-36 h-36 rounded-2xl bg-white dark:bg-neutral-800 border-2 border-dashed border-neutral-300 dark:border-neutral-700 flex items-center justify-center overflow-hidden relative">
                {preview ? <img src={preview} alt="preview" className="w-full h-full object-cover" /> : <ImagePlus className="text-neutral-400" size={36}/>}
                <input type="file" ref={fileRef} accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" id="item-img" onChange={handleFile}/>
              </div>
              <div className="text-center md:text-left">
                <h4 className="text-slate-900 dark:text-white font-bold">{preview ? t('changeItemMedia') : t('uploadItemMedia')}</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">{t('highResImageInfo')}</p>
                <label htmlFor="item-img" className="mt-4 inline-block cursor-pointer px-5 py-2.5 bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-400 transition-colors">
                  {preview ? t('selectNewImage') : t('startUpload')}
                </label>
              </div>
            </div>

            {type === 'vehicles' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                <div className="space-y-6">
                  <div><label className="label">{t('vinChassisNumber')} *</label><input required className="input-field" value={form.vin||''} onChange={e=>set('vin',e.target.value)} placeholder="ABC1234567890"/></div>
                  <div><label className="label">{t('vehicleModelName')} *</label><input required className="input-field" value={form.model||''} onChange={e=>set('model',e.target.value)} placeholder="e.g. Toyota Hilux 2024"/></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">{t('bodyClassification')}</label>
                      <select className="input-field" value={form.type||'4-wheel'} onChange={e=>set('type',e.target.value)}>
                        {VEHICLE_TYPES.map(t=><option key={t} value={t}>{t.toUpperCase()}</option>)}
                      </select>
                    </div>
                    <div><label className="label">{t('propulsionType')}</label>
                      <select className="input-field" value={form.power_type||'non-electric'} onChange={e=>set('power_type',e.target.value)}>
                        {POWER_TYPES.map(t=><option key={t} value={t}>{t.toUpperCase()}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="space-y-6">
                  <div>
                    <label className="label">{t('motorNumber')}</label>
                    <input name="engine_number" className="input-field" value={form.engine_number||''} onChange={e => set('engine_number',e.target.value)} placeholder="Motor #"/>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">{t('primaryColor')}</label><input className="input-field" value={form.color||''} onChange={e=>set('color',e.target.value)} placeholder="e.g. Silver"/></div>
                    <div><label className="label">{t('operationalStatus')}</label>
                      <select className="input-field" value={form.status||'available'} onChange={e=>set('status',e.target.value)}>
                        {STATUSES.map(s=><option key={s} value={s}>{s.toUpperCase()}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">{t('acquisitionCost')}</label><input type="number" className="input-field" value={form.cost_price||''} onChange={e=>set('cost_price',e.target.value)} placeholder="0.00"/></div>
                    <div><label className="label">{t('sellingPrice')} *</label><input required type="number" className="input-field" value={form.selling_price||''} onChange={e=>set('selling_price',e.target.value)} placeholder="0.00"/></div>
                  </div>
                  <div><label className="label">{t('targetBranch')}</label>
                    <select className="input-field" value={form.branch_id||1} onChange={e=>set('branch_id',e.target.value)}>
                      {branches.map(b=><option key={b.id} value={b.id}>{b.name.toUpperCase()}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                <div className="space-y-6">
                  <div><label className="label">{t('partNumberSku')} *</label><input required className="input-field" value={form.part_number||''} onChange={e=>set('part_number',e.target.value)} placeholder="SKU-8821"/></div>
                  <div><label className="label">{t('componentName')} *</label><input required className="input-field" value={form.name||''} onChange={e=>set('name',e.target.value)} placeholder="e.g. Brake Pads"/></div>
                  <div><label className="label">{t('category')}</label><input className="input-field" value={form.category||''} onChange={e=>set('category',e.target.value)} placeholder="e.g. Braking System"/></div>
                </div>
                <div className="space-y-6">
                  <div><label className="label">{t('stockLevel')}</label><input type="number" className="input-field" value={form.quantity||''} onChange={e=>set('quantity',e.target.value)} placeholder="0"/></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">{t('landedCost')}</label><input type="number" className="input-field" value={form.cost_price||''} onChange={e=>set('cost_price',e.target.value)} placeholder="0.00"/></div>
                    <div><label className="label">{t('unitRetailPrice')} *</label><input required type="number" className="input-field" value={form.unit_price||''} onChange={e=>set('unit_price',e.target.value)} placeholder="0.00"/></div>
                  </div>
                  <div><label className="label">{t('storageBranch')}</label>
                    <select className="input-field" value={form.branch_id||1} onChange={e=>set('branch_id',e.target.value)}>
                      {branches.map(b=><option key={b.id} value={b.id}>{b.name.toUpperCase()}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn-secondary">{t('cancel')}</button>
          <button form="item-form" type="submit" disabled={saving} className="btn-primary px-10">
            {saving ? <Loader2 size={16} className="animate-spin"/> : <Check size={16}/>}
            {isEdit ? t('update') : t('addItem')}
          </button>
        </div>
      </div>
    </div>
  )
}

const Inventory = ({ user }) => {
  const [activeTab, setActiveTab]       = useState('vehicles')
  const [vehicles, setVehicles]         = useState([])
  const [spareParts, setSpareParts]     = useState([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [modal, setModal]               = useState(null)
  const [branches, setBranches]         = useState([])
  const [previewImage, setPreviewImage] = useState(null)
  const { t } = useLanguage()

  const role = user?.role

  const [branchFilter, setBranchFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('available')
  const [stats, setStats]               = useState({ available: 0, reserved: 0, sold: 0, 'in-transit': 0 })

  useEffect(() => { fetchData() }, [branchFilter, statusFilter])

  const fetchData = async () => {
    setLoading(true)
    try {
      const bId = branchFilter
      const sId = activeTab === 'vehicles' ? statusFilter : ''
      const [vRes, sRes, bRes, statsRes] = await Promise.all([
        api.get(`/inventory/vehicles?branch_id=${bId}&status=${sId}`),
        api.get(`/inventory/spare-parts?branch_id=${bId}`),
        api.get('/branches'),
        api.get(`/inventory/vehicles?branch_id=${bId}&status=`),
      ])
      setVehicles(vRes.data)
      setSpareParts(sRes.data)
      setBranches(bRes.data)
      const all = statsRes.data
      setStats({
        available:  all.filter(v => v.status === 'available').length,
        reserved:   all.filter(v => v.status === 'reserved').length,
        sold:       all.filter(v => v.status === 'sold').length,
        'in-transit': all.filter(v => v.status === 'in-transit').length,
      })
    } catch { toast.error('Failed to load inventory') }
    finally { setLoading(false) }
  }

  const handleDelete = async (id) => {
    if (!window.confirm(t('confirmDelete'))) return
    try {
      await api.delete(`/inventory/${activeTab === 'vehicles' ? 'vehicles' : 'spare-parts'}/${id}`)
      toast.success('Item deleted')
      fetchData()
    } catch { toast.error('Failed to delete') }
  }

  // Helper: look up branch name from fetched list
  const getBranchName = (id) => branches.find(b => b.id === id)?.name ?? `Branch ${id}`

  const baseItems = (activeTab === 'vehicles' ? vehicles : spareParts).filter(i => {
    const q = search.toLowerCase()
    const matchesSearch = !q || (activeTab === 'vehicles'
      ? (i.model?.toLowerCase().includes(q) || i.vin?.toLowerCase().includes(q)
        || i.chassis_number?.toLowerCase().includes(q) || i.engine_number?.toLowerCase().includes(q))
      : (i.name?.toLowerCase().includes(q) || i.part_number?.toLowerCase().includes(q)))
    if (!matchesSearch) return false
    if (branchFilter && String(i.branch_id) !== branchFilter) return false
    return true
  })

  const items = baseItems.filter(i => {
    if (activeTab === 'vehicles' && statusFilter && i.status !== statusFilter) return false
    return true
  })

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{t('inventoryTitle')}</h1>
          <p className="text-slate-400 mt-1 font-medium">{t('inventoryDesc')}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => exportInventoryToExcel(items, activeTab, t)} className="px-4 py-2.5 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 transition-colors flex items-center gap-2">
            <Download size={18}/> {t('export')}
          </button>
          {canEdit(role) && (
            <button onClick={() => setModal({ mode: 'add', item: null })} className="btn-primary flex items-center gap-2">
              <Plus size={20}/> {activeTab === 'vehicles' ? t('addVehicle') : t('addSparePart')}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800">
        {[{ key: 'vehicles', label: t('vehicles'), icon: Car }, { key: 'parts', label: t('spareParts'), icon: Package }].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-8 py-4 font-semibold text-sm transition-colors relative ${
              activeTab === tab.key ? 'text-brand-600' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <tab.icon size={18}/>{tab.label}
            {activeTab === tab.key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600"/>}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row items-center gap-4 bg-neutral-50 dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div>
            <select className="input-field text-xs" value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
              <option value="">{t('allBranches')}</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          {activeTab === 'vehicles' && (
            <div>
              <select className="input-field text-xs" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                {STATUSES.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="flex-1 relative w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
          <input type="text" placeholder={t('searchPlaceholder')}
            className="input-field input-with-icon w-full"
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="animate-spin text-brand-600" size={40}/>
            <p className="text-slate-400 animate-pulse">Loading inventory...</p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left min-w-[800px]">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-xs font-bold text-slate-500">
                  <th className="px-5 py-4 hidden sm:table-cell">{t('photo')}</th>
                  <th className="px-5 py-4">{t('itemDetails')}</th>
                  <th className="px-5 py-4 hidden md:table-cell">{t('branch')}</th>
                  <th className="px-5 py-4">{t('statusStock')}</th>
                  <th className="px-5 py-4 hidden lg:table-cell">{t('price')}</th>
                  {canEdit(role) && <th className="px-5 py-4 text-right">{t('actions')}</th>}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan="6"><EmptyState message={t('noItemsFoundDesc')} /></td></tr>
                ) : items.map(item => (
                  <tr key={item.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-colors group border-b border-neutral-100 dark:border-neutral-800 last:border-0">
                    <td className="px-6 py-5 hidden sm:table-cell"><ImageCell imageData={item.image} onClick={setPreviewImage}/></td>
                    <td className="px-6 py-5">
                      <p className="text-slate-900 dark:text-white font-bold text-sm">{activeTab === 'vehicles' ? item.model : item.name}</p>
                      <p className="text-xs font-mono text-slate-500 mt-0.5">{activeTab === 'vehicles' ? `VIN: ${item.vin}` : `Part #: ${item.part_number}`}</p>
                      {activeTab === 'vehicles' && <p className="text-xs text-slate-400 mt-0.5">Motor: {item.engine_number || '—'}</p>}
                      {activeTab === 'vehicles' && <p className="text-xs text-slate-400 mt-0.5">{item.type} · {item.power_type}</p>}
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell">
                      {/* Use fetched branch data — no hardcoding */}
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-neutral-100 dark:bg-neutral-800 text-slate-500 border border-neutral-200 dark:border-neutral-700 uppercase">
                        {getBranchName(item.branch_id)}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {activeTab === 'vehicles' ? (
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase border ${
                          item.status === 'available' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' :
                          item.status === 'sold'      ? 'bg-neutral-100 dark:bg-neutral-800 text-slate-400 border-neutral-200 dark:border-neutral-700' :
                          'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                        }`}>{item.status}</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${item.quantity < 20 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {item.quantity} units
                          </span>
                          {item.quantity < 20 && <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="Low stock"/>}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 hidden lg:table-cell">
                      <p className="text-slate-900 dark:text-white font-bold text-sm">
                        ETB {parseFloat(activeTab === 'vehicles' ? item.selling_price : item.unit_price).toLocaleString()}
                      </p>
                      {(item.cost_price > 0) && <p className="text-xs text-slate-500 mt-0.5">Cost: ETB {parseFloat(item.cost_price).toLocaleString()}</p>}
                    </td>
                    {canEdit(role) && (
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => setModal({ mode: 'edit', item })} className="p-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors" title="Edit"><Edit3 size={15}/></button>
                          {canDelete(role) && (
                            <button onClick={() => handleDelete(item.id)} className="p-2 bg-rose-100 dark:bg-rose-900/30 hover:bg-rose-200 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 rounded-xl transition-colors" title="Delete"><Trash2 size={15}/></button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stats bar — shows breakdown for all statuses in current branch/search */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(activeTab === 'vehicles' ? [
          { label: 'Available',  value: stats.available,  color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Reserved',   value: stats.reserved,   color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Sold',       value: stats.sold,       color: 'text-slate-400' },
          { label: 'In Transit', value: stats['in-transit'], color: 'text-blue-600 dark:text-blue-400' },
        ] : [
          { label: 'Total SKUs',   value: baseItems.length,                                      color: 'text-slate-900 dark:text-white' },
          { label: 'Low Stock',    value: baseItems.filter(p=>p.quantity<20).length,              color: 'text-rose-600 dark:text-rose-400' },
          { label: 'Total Units',  value: baseItems.reduce((a,p)=>a+(p.quantity||0),0),          color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Branches',     value: new Set(baseItems.map(i=>i.branch_id)).size,            color: 'text-slate-400' },
        ]).map(s => (
          <div key={s.label} className="glass-card px-5 py-4">
            <p className="text-xs text-slate-500 font-bold">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {modal && (
        <ItemModal
          mode={modal.mode} item={modal.item}
          type={activeTab === 'vehicles' ? 'vehicles' : 'spare-parts'}
          branches={branches}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchData() }}
        />
      )}

      {/* Image Preview */}
      {previewImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPreviewImage(null)} className="absolute -top-12 right-0 p-2 bg-white dark:bg-neutral-800 rounded-full text-slate-900 dark:text-white transition-colors"><X size={22}/></button>
            <img src={previewImage} alt="Item Preview" className="w-full h-auto max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-700"/>
          </div>
        </div>
      )}
    </div>
  )
}

export default Inventory
