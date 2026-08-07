import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Plus, Download, Loader2, CheckCircle2, Truck, Wrench, X, Trash2, Upload, Camera, Search } from 'lucide-react'
import { toast } from 'react-toastify'
import api from '../services/api'
import { exportSalesToExcel } from '../services/ExportService'
import { useLanguage } from '../i18n/LanguageContext'
import { useImagePicker } from '../hooks/useImagePicker'
import { capitalizeName, daysAgo } from '../utils/format'

import SalesFilterBar from '../components/sales/SalesFilterBar'
import SalesTable from '../components/sales/SalesTable'
import SalesPagination from '../components/sales/SalesPagination'
import PaymentHistoryModal from '../components/sales/PaymentHistoryModal'
import AddPaymentModal from '../components/sales/AddPaymentModal'
import EditPaymentModal from '../components/sales/EditPaymentModal'
import EditSaleModal from '../components/sales/EditSaleModal'
import ImagePreviewModal from '../components/sales/ImagePreviewModal'

const Sales = ({ user }) => {
  const { pickImage } = useImagePicker()
  const { t } = useLanguage()
  const [sales, setSales] = useState([])
  const [availableVehicles, setAvailableVehicles] = useState([])
  const [availableParts, setAvailableParts] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Filters
  const [statusFilter, setStatusFilter] = useState('pending')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [startDate, setStartDate] = useState(daysAgo(31))
  const [endDate, setEndDate] = useState(daysAgo(0))
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [perPage] = useState(50)
  const [branches, setBranches] = useState([])
  const [selectedBranchId, setSelectedBranchId] = useState('')

  // Modals
  const [showNewSale, setShowNewSale] = useState(false)
  const [showPaymentHistory, setShowPaymentHistory] = useState(false)
  const [selectedSale, setSelectedSale] = useState(null)
  const [salePayments, setSalePayments] = useState([])
  const [showAddPayment, setShowAddPayment] = useState(false)
  const [editingPayment, setEditingPayment] = useState(null)
  const [editPayMethod, setEditPayMethod] = useState('cash')
  const [showEditSale, setShowEditSale] = useState(false)
  const [editSaleAmount, setEditSaleAmount] = useState('')
  const [editSaleRemark, setEditSaleRemark] = useState('')
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [previewImage, setPreviewImage] = useState(null)
  const receiptRef = useRef(null)

  // New sale form
  const [form, setForm] = useState({})
  const set = (key, value) => setForm(prev => ({...prev, [key]: value}))
  const [payments, setPayments] = useState([{ id: 1, method: 'cash', amount: '', bank: '', reference: '', accountHolder: '' }])
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [vehicleSearch, setVehicleSearch] = useState('')
  const [selectedPartId, setSelectedPartId] = useState('')
  const [partSearch, setPartSearch] = useState('')
  const [partQuantity, setPartQuantity] = useState(1)
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [newCustPhone, setNewCustPhone] = useState('')
  const [phoneWarning, setPhoneWarning] = useState('')
  const [saleType, setSaleType] = useState('vehicle')

  const sortedVehicles = useMemo(() =>
    [...availableVehicles].sort((a, b) => (a.model || '').localeCompare(b.model || '')),
    [availableVehicles]
  )
  const sortedParts = useMemo(() =>
    [...availableParts].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [availableParts]
  )

  // Vehicles shown in the sale dropdown: filtered by the search box, with the
  // currently selected vehicle kept visible even if it doesn't match.
  const filteredVehicles = useMemo(() => {
    const q = vehicleSearch.trim().toLowerCase()
    if (!q) return sortedVehicles
    const matched = sortedVehicles.filter(v =>
      (v.model || '').toLowerCase().includes(q) ||
      (v.vin || '').toLowerCase().includes(q) ||
      (v.engine_number || '').toLowerCase().includes(q)
    )
    const selected = sortedVehicles.find(v => v.id === parseInt(selectedVehicleId, 10))
    if (selected && !matched.some(v => v.id === selected.id)) {
      return [selected, ...matched]
    }
    return matched
  }, [sortedVehicles, vehicleSearch, selectedVehicleId])

  // Spare parts shown in the sale dropdown: filtered by the search box, with
  // the currently selected part kept visible even if it doesn't match.
  const filteredParts = useMemo(() => {
    const q = partSearch.trim().toLowerCase()
    if (!q) return sortedParts
    const matched = sortedParts.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.part_number || '').toLowerCase().includes(q) ||
      (p.name_tigrinya || '').toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q)
    )
    const selected = sortedParts.find(p => p.id === parseInt(selectedPartId, 10))
    if (selected && !matched.some(p => p.id === selected.id)) {
      return [selected, ...matched]
    }
    return matched
  }, [sortedParts, partSearch, selectedPartId])

  // Customers shown in the sale dropdown: filtered by the search box, with
  // the currently selected customer kept visible even if it doesn't match.
  const sortedCustomers = useMemo(() =>
    [...customers].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '')),
    [customers]
  )
  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase()
    if (!q) return sortedCustomers
    const matched = sortedCustomers.filter(c =>
      (c.full_name || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q)
    )
    const selected = sortedCustomers.find(c => c.id === parseInt(selectedCustomerId, 10))
    if (selected && !matched.some(c => c.id === selected.id)) {
      return [selected, ...matched]
    }
    return matched
  }, [sortedCustomers, customerSearch, selectedCustomerId])

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(searchQuery), 350); return () => clearTimeout(t) }, [searchQuery])
  useEffect(() => { fetchData() }, [statusFilter, debouncedSearch, startDate, endDate, page, selectedBranchId])

  useEffect(() => {
    const isAdmin = user?.role?.toLowerCase() === 'admin'
    setSelectedBranchId(isAdmin ? '' : (user?.branch_id ? String(user.branch_id) : ''))
    api.get('/branches').then(res => setBranches(res.data.items || res.data || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (showNewSale) {
      setForm({})
      setSelectedVehicleId('')
      setVehicleSearch('')
      setSelectedPartId('')
      setPartSearch('')
      setPartQuantity(1)
      setSelectedCustomerId('')
      setCustomerSearch('')
      setNewCustPhone('')
      setPhoneWarning('')
      setSaleType('vehicle')
      setPayments([{ id: 1, method: 'cash', amount: '', bank: '', reference: '', accountHolder: '' }])
    }
  }, [showNewSale])

  const handleVehicleSelect = (vehicleId) => {
    setSelectedVehicleId(vehicleId)
    const v = availableVehicles.find(veh => veh.id === parseInt(vehicleId, 10))
    if (v) {
      const price = v.selling_price != null ? Number(v.selling_price) : ''
      setForm(prev => ({
        ...prev,
        chassis_number: v.vin || '',
        motor_number: v.engine_number || '',
        total_amount: price,
        selling_price: price,
      }))
    } else {
      setForm(prev => ({
        ...prev,
        chassis_number: '',
        motor_number: '',
        total_amount: '',
        selling_price: '',
      }))
    }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const branchId = user?.role?.toLowerCase() === 'admin' ? selectedBranchId : (user?.branch_id || '')
      const [salesRes, vehRes, partsRes, custRes] = await Promise.all([
        api.get(`/sales?status=${statusFilter}&search=${searchQuery}&start_date=${startDate}&end_date=${endDate}&branch_id=${branchId}&page=${page}&per_page=${perPage}`),
        api.get(`/inventory/vehicles?status=available,reserved&branch_id=${branchId}&per_page=10000&no_image=1`),
        api.get(`/inventory/spare-parts?branch_id=${branchId}&per_page=10000&no_image=1`),
        api.get('/customers')
      ])
      if (Array.isArray(salesRes.data)) {
        setSales(salesRes.data)
      } else {
        setSales(salesRes.data.items || [])
        setTotalPages(salesRes.data.pages || 1)
      }
      setAvailableVehicles(vehRes.data.items || vehRes.data || [])
      setAvailableParts((partsRes.data.items || partsRes.data || []).filter(p => p.quantity > 0))
      setCustomers(custRes.data.items || custRes.data || [])
    } catch {
      toast.error('Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  const fetchSalePayments = async (sale) => {
    try {
      const params = {}
      if (startDate) params.start_date = startDate
      if (endDate) params.end_date = endDate
      const res = await api.get(`/sales/${sale.id}/payments`, { params })
      setSalePayments(res.data)
      setSelectedSale(sale)
      setShowPaymentHistory(true)
    } catch {
      toast.error('Failed to fetch payment history')
    }
  }

  const addPaymentRow = () => setPayments([...payments, { id: Date.now(), method: 'bank', amount: '', bank: '', reference: '', accountHolder: '', receiptFile: null }])
  const removePaymentRow = (id) => { if (payments.length > 1) setPayments(payments.filter(p => p.id !== id)) }

  const handleCancelSale = async (sale) => {
    if (!window.confirm(`Cancel sale ${sale.sale_number}?`)) return
    try {
      await api.delete(`/sales/${sale.id}`)
      toast.success('Sale cancelled')
      fetchData()
    } catch {
      toast.error('Failed to cancel sale')
    }
  }

  const handleHardDeleteSale = async (sale) => {
    if (!window.confirm(`Permanently delete sale ${sale.sale_number}? This cannot be undone.`)) return
    if (!window.confirm(`FINAL WARNING: All records for ${sale.sale_number} will be erased. Continue?`)) return
    try {
      await api.delete(`/sales/${sale.id}/hard-delete`)
      toast.success('Sale permanently deleted')
      fetchData()
    } catch {
      toast.error('Failed to delete sale')
    }
  }

  const handleUpdateSale = async (e) => {
    e.preventDefault()
    setEditSubmitting(true)
    try {
      await api.patch(`/sales/${selectedSale.id}`, { total_amount: parseFloat(editSaleAmount), remark: editSaleRemark })
      toast.success(t('saleUpdated'))
      setShowEditSale(false)
      setSelectedSale(null)
      fetchData()
    } catch {
      toast.error(t('failedToUpdateSale'))
    } finally {
      setEditSubmitting(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    const fd = new FormData(e.target)

    for (const p of payments) {
      if (p.method === 'bank') {
        if (!p.bank?.trim()) { toast.error('Bank name is required for bank transfer payments'); setSubmitting(false); return }
        if (!p.accountHolder?.trim()) { toast.error('Account holder is required for bank transfer payments'); setSubmitting(false); return }
        if (!p.reference?.trim()) { toast.error('Reference ID is required for bank transfer payments'); setSubmitting(false); return }
      }
    }

    const paymentsData = payments.map(p => ({
      method: p.method,
      amount: p.amount === '' || p.amount == null ? 0 : Number(String(p.amount).replace(/[\s,]/g, '')) || 0,
      ...(p.method === 'bank' ? { bank: p.bank?.toUpperCase(), reference: p.reference?.toUpperCase(), accountHolder: p.accountHolder?.toUpperCase() } : {}),
    }))

    const hasReceipts = payments.some(p => p.receiptFile)
    try {
      if (saleType === 'vehicle') {
        const vehicle = availableVehicles.find(veh => veh.id === parseInt(selectedVehicleId, 10))
        const sellingPrice = vehicle?.selling_price != null ? Number(vehicle.selling_price) : null
        if (!vehicle || sellingPrice == null || sellingPrice <= 0) {
          toast.error('Selected vehicle has no selling price in inventory'); setSubmitting(false); return
        }
        if (hasReceipts) {
          const multipart = new FormData()
          multipart.append('vehicle_id', selectedVehicleId)
          multipart.append('customer_name', fd.get('customer_name'))
          multipart.append('customer_phone', fd.get('customer_phone') || '')
          if (selectedCustomerId) multipart.append('customer_id', selectedCustomerId)
          multipart.append('motor_number', form.motor_number || '')
          multipart.append('total_amount', String(sellingPrice))
          multipart.append('sale_date', fd.get('sale_date'))
          multipart.append('user_id', user?.id)
          multipart.append('remark', fd.get('remark'))
          multipart.append('payments', JSON.stringify(paymentsData))
          payments.forEach((p, idx) => { if (p.receiptFile) multipart.append(`receipt_${idx}`, p.receiptFile) })
          await api.post('/sales/vehicle', multipart)
        } else {
          await api.post('/sales/vehicle', {
            vehicle_id: parseInt(selectedVehicleId, 10),
            customer_name: fd.get('customer_name'), customer_phone: fd.get('customer_phone') || '',
            customer_id: selectedCustomerId ? parseInt(selectedCustomerId, 10) : null,
            chassis_number: vehicle.vin, motor_number: form.motor_number || '',
            total_amount: sellingPrice, sale_date: fd.get('sale_date'), remark: fd.get('remark'),
            payments: paymentsData, user_id: user?.id,
          })
        }
      } else {
        const part = availableParts.find(p => p.id === parseInt(selectedPartId, 10))
        if (!part) { toast.error('Please select a spare part'); setSubmitting(false); return }
        const qty = parseInt(partQuantity, 10)
        if (qty < 1 || qty > part.quantity) { toast.error(`Invalid quantity. Available: ${part.quantity}`); setSubmitting(false); return }
        const totalAmount = qty * Number(part.unit_price)
        await api.post('/sales/spare-part', {
          part_id: parseInt(selectedPartId, 10), quantity: qty,
          customer_name: fd.get('customer_name'), customer_phone: fd.get('customer_phone') || '',
          customer_id: selectedCustomerId ? parseInt(selectedCustomerId, 10) : null,
          total_amount: totalAmount, sale_date: fd.get('sale_date'), remark: fd.get('remark'),
          payments: paymentsData, user_id: user?.id,
        })
      }
      toast.success('Sale recorded successfully!')
      setShowNewSale(false); setForm({})
      setPayments([{ id: 1, method: 'cash', amount: '', bank: '', reference: '', accountHolder: '' }])
      setSelectedCustomerId(''); setSelectedVehicleId(''); setSelectedPartId(''); setPartSearch(''); setCustomerSearch(''); setPartQuantity(1)
      fetchData()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to record sale')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddPayment = async (e, resetForm) => {
    e.preventDefault()
    setSubmitting(true)
    const formData = new FormData(e.target)
    try {
      await api.post(`/sales/${selectedSale.id}/add-payment`, formData)
      toast.success('Payment recorded successfully')
      setShowAddPayment(false)
      resetForm?.()
      fetchData()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to add payment')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdatePayment = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    const fd = new FormData(e.target)
    const receiptFile = fd.get('receipt')
    try {
      if (receiptFile && receiptFile.size > 0) {
        await api.put(`/sales/${selectedSale.id}/payments/${editingPayment.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      } else {
        const data = {
          method: fd.get('method'), amount: parseFloat(fd.get('amount')),
          ...(fd.get('method') === 'bank' ? { bank: fd.get('bank'), accountHolder: fd.get('account_holder'), reference: fd.get('reference') } : {}),
        }
        await api.put(`/sales/${selectedSale.id}/payments/${editingPayment.id}`, data)
      }
      toast.success('Payment updated')
      setEditingPayment(null)
      fetchSalePayments(selectedSale)
      fetchData()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update payment')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeletePayment = async (payment) => {
    if (!window.confirm(`Delete payment of ETB ${payment.amount.toLocaleString()}? This action cannot be undone.`)) return
    try {
      await api.delete(`/sales/${selectedSale.id}/payments/${payment.id}`)
      toast.success('Payment deleted')
      fetchSalePayments(selectedSale)
      fetchData()
    } catch {
      toast.error('Failed to delete payment')
    }
  }

  const handleCameraNewSalePay = async (index) => {
    const result = await pickImage()
    if (!result) return
    const n = [...payments]
    const file = new File([result.blob], 'receipt.jpg', { type: 'image/jpeg' })
    n[index].receiptFile = file
    n[index].receiptPreview = result.dataUrl
    setPayments(n)
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{t('salesAndRevenue')}</h1>
          <p className="text-slate-400 mt-1 font-medium">{t('salesDesc')}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => exportSalesToExcel(sales, t)} className="px-4 py-2.5 bg-slate-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 transition-colors flex items-center gap-2">
            <Download size={18} />{t('exportReport')}
          </button>
          <button onClick={() => setShowNewSale(true)} className="btn-primary flex items-center gap-2">
            <Plus size={20} />{t('recordNewSale')}
          </button>
        </div>
      </div>

      <SalesFilterBar
        statusFilter={statusFilter} onStatusChange={setStatusFilter}
        startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate}
        searchQuery={searchQuery} onSearchChange={setSearchQuery}
        branches={branches} selectedBranchId={selectedBranchId} onBranchChange={setSelectedBranchId}
      />

      <SalesTable
        sales={sales} loading={loading} user={user}
        onPreviewImage={setPreviewImage}
        onViewPayments={fetchSalePayments}
        onCollectPayment={(sale) => { setSelectedSale(sale); setShowAddPayment(true) }}
        onEditSale={(sale) => { setSelectedSale(sale); setEditSaleAmount(String(sale.total_amount)); setEditSaleRemark(sale.remark || ''); setShowEditSale(true) }}
        onCancelSale={handleCancelSale}
        onHardDeleteSale={handleHardDeleteSale}
      />

      <SalesPagination page={page} totalPages={totalPages} onPageChange={setPage} />

      {showPaymentHistory && selectedSale && (
        <PaymentHistoryModal
          sale={selectedSale} payments={salePayments}
          onClose={() => setShowPaymentHistory(false)}
          onEdit={(p) => { setEditingPayment(p); setEditPayMethod(p.method); setShowPaymentHistory(false) }}
          onDelete={handleDeletePayment}
          user={user} onPreviewImage={setPreviewImage}
        />
      )}

      {showAddPayment && selectedSale && (
        <AddPaymentModal
          sale={selectedSale} onClose={() => setShowAddPayment(false)}
          onSubmit={handleAddPayment} submitting={submitting} pickImage={pickImage}
        />
      )}

      {editingPayment && selectedSale && (
        <EditPaymentModal
          payment={editingPayment} sale={selectedSale}
          method={editPayMethod} onMethodChange={setEditPayMethod}
          onClose={() => { setEditingPayment(null); setShowPaymentHistory(true) }}
          onSubmit={handleUpdatePayment} submitting={submitting}
          onCamera={async () => {
            const result = await pickImage()
            if (!result) return
            const file = new File([result.blob], 'receipt.jpg', { type: 'image/jpeg' })
            const dt = new DataTransfer()
            dt.items.add(file)
            setEditingPayment(prev => ({ ...prev, receipt_preview: result.dataUrl }))
          }}
          receiptRef={receiptRef}
        />
      )}

      {showNewSale && (
        <NewSaleModal
          show={showNewSale} onClose={() => setShowNewSale(false)}
          form={form} setForm={setForm} set={set}
          payments={payments} setPayments={setPayments}
          addPaymentRow={addPaymentRow} removePaymentRow={removePaymentRow}
          selectedVehicleId={selectedVehicleId} onVehicleSelect={handleVehicleSelect}
          sortedVehicles={sortedVehicles}
          filteredVehicles={filteredVehicles}
          vehicleSearch={vehicleSearch} onVehicleSearchChange={setVehicleSearch}
          selectedPartId={selectedPartId} onPartSelect={setSelectedPartId}
          sortedParts={sortedParts} filteredParts={filteredParts}
          partSearch={partSearch} onPartSearchChange={setPartSearch}
          partQuantity={partQuantity} onPartQuantityChange={setPartQuantity}
          availableParts={availableParts}
          selectedCustomerId={selectedCustomerId} onCustomerSelect={setSelectedCustomerId}
          customers={customers} sortedCustomers={sortedCustomers} filteredCustomers={filteredCustomers}
          customerSearch={customerSearch} onCustomerSearchChange={setCustomerSearch}
          newCustPhone={newCustPhone} onCustPhoneChange={setNewCustPhone}
          phoneWarning={phoneWarning} onPhoneWarningChange={setPhoneWarning}
          saleType={saleType} onSaleTypeChange={setSaleType}
          onSubmit={handleSubmit} submitting={submitting}
          handleCameraNewSalePay={handleCameraNewSalePay}
        />
      )}

      {showEditSale && selectedSale && (
        <EditSaleModal
          sale={selectedSale}
          amount={editSaleAmount} remark={editSaleRemark}
          onAmountChange={setEditSaleAmount} onRemarkChange={setEditSaleRemark}
          onClose={() => { setShowEditSale(false); setSelectedSale(null) }}
          onSubmit={handleUpdateSale} submitting={editSubmitting}
        />
      )}

      <ImagePreviewModal src={previewImage} onClose={() => setPreviewImage(null)} />
    </div>
  )
}

// NewSaleModal - inline since it's complex but tightly coupled to Sales state
const NewSaleModal = ({ show, onClose, form, setForm, set, payments, setPayments, addPaymentRow, removePaymentRow,
  selectedVehicleId, onVehicleSelect, sortedVehicles, filteredVehicles, vehicleSearch, onVehicleSearchChange,
  selectedPartId, onPartSelect, sortedParts, filteredParts, partSearch, onPartSearchChange,
  partQuantity, onPartQuantityChange, availableParts, selectedCustomerId, onCustomerSelect,
  customers, sortedCustomers, filteredCustomers, customerSearch, onCustomerSearchChange,
  newCustPhone, onCustPhoneChange, phoneWarning, onPhoneWarningChange,
  saleType, onSaleTypeChange, onSubmit, submitting, handleCameraNewSalePay }) => {
  const { t } = useLanguage()
  const today = new Date(); const pad = n => String(n).padStart(2, '0')

  return (
    <div className="modal-backdrop">
      <div className="modal-content max-w-6xl">
        <div className="modal-header">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('recordNewTransaction')}</h2>
            <p className="text-xs font-medium text-slate-500 mt-0.5">{t('enterpriseSalesManagement')}</p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-slate-700"><X size={20}/></button>
        </div>
        <div className="modal-body custom-scrollbar">
          <form id="sale-form" onSubmit={onSubmit} className="space-y-10">
            <div className="flex items-center gap-2 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl w-fit border border-neutral-200 dark:border-neutral-700">
              <button type="button" onClick={() => onSaleTypeChange('vehicle')} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-colors ${saleType === 'vehicle' ? 'bg-white dark:bg-neutral-700 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                <Truck size={18} />{t('vehicleSale')}
              </button>
              <button type="button" onClick={() => onSaleTypeChange('spare_part')} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-colors ${saleType === 'spare_part' ? 'bg-white dark:bg-neutral-700 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                <Wrench size={18} />{t('sparePartSale')}
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className="lg:col-span-5 space-y-8">
                <div className="p-8 bg-neutral-50 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-6">
                  <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">{t('clientInformation')}</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="label">{t('selectExistingCustomer')}</label>
                      <div className="relative mb-2">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          className="input-field pl-9"
                          placeholder={t('searchCustomers') || 'Search by name or phone...'}
                          value={customerSearch}
                          onChange={e => onCustomerSearchChange(e.target.value)}
                        />
                      </div>
                      <select className="input-field" value={selectedCustomerId} onChange={e => {
                        onCustomerSelect(e.target.value); onPhoneWarningChange('')
                        if (e.target.value) {
                          const c = customers.find(c => c.id === parseInt(e.target.value))
                          if (c) { document.getElementById('sale-form').customer_name.value = c.full_name; onCustPhoneChange(c.phone) }
                        }
                      }}>
                        <option value="">{t('newCustomer')}</option>
                        {filteredCustomers.map(c => <option key={c.id} value={c.id}>{capitalizeName(c.full_name)} ({c.phone})</option>)}
                      </select>
                      {customerSearch.trim() && filteredCustomers.length === 0 && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">{t('noCustomersMatch') || 'No customers match your search'}</p>
                      )}
                      {customerSearch.trim() && filteredCustomers.length > 0 && (
                        <p className="text-xs text-slate-400 mt-1.5">{filteredCustomers.length} / {sortedCustomers.length}</p>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div><label className="label">{t('fullName')}</label><input type="text" name="customer_name" required className="input-field" placeholder="Abebe Kebede" /></div>
                      <div>
                        <label className="label">{t('phoneNumber')}</label>
                        <input type="text" name="customer_phone" className={`input-field ${phoneWarning ? 'border-amber-500 dark:border-amber-500' : ''}`}
                          placeholder="0911..." value={newCustPhone}
                          onChange={e => { onCustPhoneChange(e.target.value); onPhoneWarningChange('') }}
                          onBlur={() => {
                            if (!newCustPhone.trim() || selectedCustomerId) { onPhoneWarningChange(''); return }
                            const match = customers.find(c => c.phone === newCustPhone.trim())
                            if (match) onPhoneWarningChange(`This phone belongs to ${capitalizeName(match.full_name)}. Select them from the dropdown above.`)
                            else onPhoneWarningChange('')
                          }} />
                        {phoneWarning && <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">{phoneWarning}</p>}
                      </div>
                    </div>
                  </div>
                </div>
                {saleType === 'vehicle' ? (
                  <div className="p-8 bg-neutral-50 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-6">
                    <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">{t('vehicleAndDate')}</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="label">{t('vehicle')} *</label>
                        <div className="relative mb-2">
                          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          <input
                            type="text"
                            className="input-field pl-9"
                            placeholder={t('searchVehicles') || 'Search by model, VIN, or engine...'}
                            value={vehicleSearch}
                            onChange={e => onVehicleSearchChange(e.target.value)}
                          />
                        </div>
                        <select name="vehicle_id" required className="input-field" value={selectedVehicleId} onChange={e => onVehicleSelect(e.target.value)}>
                          <option value="">{t('selectItem')}</option>
                          {filteredVehicles.map(v => (
                            <option key={v.id} value={v.id}>{(v.model || '').toUpperCase()} — {v.vin}{v.engine_number ? ` — Motor: ${v.engine_number}` : ''}{v.selling_price != null ? ` — ETB ${Number(v.selling_price).toLocaleString()}` : ''}{v.status === 'reserved' ? ' — (RESERVED)' : ''}</option>
                          ))}
                        </select>
                        {vehicleSearch.trim() && filteredVehicles.length === 0 && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">{t('noVehiclesMatch') || 'No vehicles match your search'}</p>
                        )}
                        {vehicleSearch.trim() && filteredVehicles.length > 0 && (
                          <p className="text-xs text-slate-400 mt-1.5">{filteredVehicles.length} / {sortedVehicles.length}</p>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div><label className="label">{t('chassisNumber')} (VIN)</label><input type="text" name="chassis_number" readOnly className="input-field bg-neutral-100 dark:bg-neutral-800" value={form.chassis_number ?? ''} /></div>
                        <div><label className="label">{t('motorNumber')}</label><input type="text" name="motor_number" className="input-field" value={form.motor_number ?? ''} onChange={e => set('motor_number', e.target.value)} placeholder="Auto-filled from inventory" /></div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div><label className="label">{t('sellingPrice')}</label><input type="number" name="total_amount" readOnly required className="input-field bg-neutral-100 dark:bg-neutral-800" value={form.total_amount ?? ''} /></div>
                        <div><label className="label">{t('date')}</label><input type="date" name="sale_date" required className="input-field" defaultValue={`${new Date().getFullYear()}-${pad(new Date().getMonth()+1)}-${pad(new Date().getDate())}`} /></div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 bg-neutral-50 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-6">
                    <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">{t('sparePart')}</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="label">{t('sparePart')} *</label>
                        <div className="relative mb-2">
                          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          <input
                            type="text"
                            className="input-field pl-9"
                            placeholder={t('searchParts') || 'Search by name, part number, or category...'}
                            value={partSearch}
                            onChange={e => onPartSearchChange(e.target.value)}
                          />
                        </div>
                        <select name="part_id" required className="input-field" value={selectedPartId} onChange={e => onPartSelect(e.target.value)}>
                          <option value="">{t('selectItem')}</option>
                          {filteredParts.map(p => (
                            <option key={p.id} value={p.id}>{(p.name || '').toUpperCase()} — {p.part_number || ''} — ETB {Number(p.unit_price).toLocaleString()} — Stock: {p.quantity}</option>
                          ))}
                        </select>
                        {partSearch.trim() && filteredParts.length === 0 && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">{t('noPartsMatch') || 'No spare parts match your search'}</p>
                        )}
                        {partSearch.trim() && filteredParts.length > 0 && (
                          <p className="text-xs text-slate-400 mt-1.5">{filteredParts.length} / {sortedParts.length}</p>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div><label className="label">{t('quantity')}</label><input type="number" name="quantity" min="1" required className="input-field" value={partQuantity} onChange={e => onPartQuantityChange(e.target.value)} /></div>
                        <div><label className="label">{t('unitPrice')}</label><input type="number" readOnly className="input-field bg-neutral-100 dark:bg-neutral-800" value={selectedPartId ? (availableParts.find(p => p.id === parseInt(selectedPartId, 10))?.unit_price ?? '') : ''} /></div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div><label className="label">{t('totalAmount')}</label><input type="number" readOnly className="input-field bg-neutral-100 dark:bg-neutral-800" value={selectedPartId && partQuantity ? Number(partQuantity) * Number(availableParts.find(p => p.id === parseInt(selectedPartId, 10))?.unit_price || 0) : ''} /></div>
                        <div><label className="label">{t('date')}</label><input type="date" name="sale_date" required className="input-field" defaultValue={`${new Date().getFullYear()}-${pad(new Date().getMonth()+1)}-${pad(new Date().getDate())}`} /></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="lg:col-span-7 space-y-8">
                <div className="p-8 bg-neutral-50 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">{t('paymentBreakdown')}</h3>
                    <button type="button" onClick={addPaymentRow} className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1"><Plus size={13} />{t('method')}</button>
                  </div>
                  <div className="space-y-4">
                    {payments.map((p, index) => (
                      <div key={p.id} className="p-5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 relative space-y-4">
                        {payments.length > 1 && (
                          <button type="button" onClick={() => removePaymentRow(p.id)} className="absolute right-3 top-3 p-1.5 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/30 rounded-lg"><Trash2 size={16}/></button>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <label className="label">{t('channel')}</label>
                            <select className="input-field" value={p.method} onChange={e => { const n = [...payments]; n[index].method = e.target.value; if (e.target.value === 'cash') { n[index].reference = ''; n[index].bank = ''; n[index].accountHolder = ''; n[index].receiptFile = null } setPayments(n) }}>
                              <option value="cash">{t('cash').toUpperCase()}</option>
                              <option value="bank">{t('bankTransfer').toUpperCase()}</option>
                            </select>
                          </div>
                          <div>
                            <label className="label">{t('amount')} (ETB)</label>
                            <input type="number" required className="input-field" value={p.amount} onChange={e => { const n = [...payments]; n[index].amount = e.target.value; setPayments(n) }} placeholder="0.00" />
                          </div>
                          {p.method === 'cash' && <div className="hidden sm:block" />}
                        </div>
                        {p.method === 'bank' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-neutral-200 dark:border-neutral-700">
                            <div>
                              <label className="label">{t('bankName')} *</label>
                              <input className="input-field uppercase" list="bank-list-new" required value={p.bank} onChange={e => { const n = [...payments]; n[index].bank = e.target.value.toUpperCase(); setPayments(n) }} placeholder={t('typeBankName')} />
                              <datalist id="bank-list-new">{['CBE','Awash','Abyssinia','Dashen','BOA','Hibret'].map(b => <option key={b} value={b} />)}</datalist>
                            </div>
                            <div>
                              <label className="label">{t('accountHolder')} *</label>
                              <input className="input-field uppercase" list="account-list-new" required value={p.accountHolder || ''} onChange={e => { const n = [...payments]; n[index].accountHolder = e.target.value.toUpperCase(); setPayments(n) }} placeholder="Select or type" />
                              <datalist id="account-list-new"><option value="Tewelde" /><option value="Berihu" /><option value="Mulugeta" /></datalist>
                            </div>
                            <div>
                              <label className="label">{t('referenceNumber')} *</label>
                              <input className="input-field uppercase" required value={p.reference || ''} onChange={e => { const n = [...payments]; n[index].reference = e.target.value.toUpperCase(); setPayments(n) }} placeholder="TX-123456789" />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="label">{t('bankReceiptImage')}</label>
                              <div className="flex flex-wrap gap-2">
                                <label className="flex items-center justify-center gap-3 flex-1 py-3 px-4 border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-xl text-slate-500 hover:border-brand-500 hover:text-brand-600 transition-colors cursor-pointer min-w-[160px]">
                                  <Upload size={18} /><span className="text-sm font-medium">{p.receiptFile ? p.receiptFile.name : t('selectImageFile')}</span>
                                  <input type="file" accept="image/*" className="hidden" onChange={e => { const n = [...payments]; n[index].receiptFile = e.target.files[0] || null; setPayments(n) }} />
                                </label>
                                <button type="button" onClick={() => handleCameraNewSalePay(index)} className="flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-xl text-slate-500 hover:border-brand-500 hover:text-brand-600 transition-colors cursor-pointer">
                                  <Camera size={18} /><span className="text-sm font-medium">{t('captureOrSelect')}</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-500">{t('totalCollected')}</p>
                    <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">ETB {payments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn-secondary">{t('cancel')}</button>
          <button form="sale-form" type="submit" disabled={submitting} className="btn-primary px-10">
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}{t('completeRecord')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Sales
