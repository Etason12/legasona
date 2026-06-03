import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Plus,
  ShoppingCart,
  Search,
  User,
  CreditCard,
  Receipt,
  Trash2,
  Loader2,
  Eye,
  Filter,
  CheckCircle2,
  Clock,
  Camera,
  Download,
  X,
  Landmark,
  Truck,
  Wrench,
  Pencil,
  Upload
} from 'lucide-react'
import { toast } from 'react-toastify'
import api from '../services/api'
import { generateReceipt } from '../services/ReceiptService'
import { exportSalesToExcel } from '../services/ExportService'
import { useLanguage } from '../i18n/LanguageContext'
import { useImagePicker } from '../hooks/useImagePicker'
import { Package } from 'lucide-react'
import { formatDate, formatDateTime, capitalizeName } from '../utils/format'
import { isAdmin } from '../utils/roles'

const ImageCell = ({ imageData, onClick }) => {
  const [error, setError] = useState(false)
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

const Sales = ({ user }) => {
  const { pickImage } = useImagePicker()
  const [form, setForm] = useState({});
  const set = (key, value) => setForm(prev => ({...prev, [key]: value}));
  const [sales, setSales]                         = useState([])
  const [availableVehicles, setAvailableVehicles] = useState([])
  const [availableParts, setAvailableParts]       = useState([])
  const [loading, setLoading]                     = useState(true)
  const [submitting, setSubmitting]               = useState(false)
  const [showNewSale, setShowNewSale]             = useState(false)
  const [showAddPayment, setShowAddPayment]       = useState(false)
  const [showPaymentHistory, setShowPaymentHistory] = useState(false)
  const [selectedSale, setSelectedSale]           = useState(null)
  const [salePayments, setSalePayments]           = useState([])
  const [editingPayment, setEditingPayment]       = useState(null)
  const [editPayMethod, setEditPayMethod]         = useState('cash')
  const [statusFilter, setStatusFilter]           = useState('pending')
  const [searchQuery, setSearchQuery]             = useState('')
  const [debouncedSearch, setDebouncedSearch]     = useState('')
  const today = new Date(); const pad = n => String(n).padStart(2, '0')
  const [startDate, setStartDate]                 = useState(`${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`)
  const [endDate, setEndDate]                     = useState(`${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`)
  const [payments, setPayments]                   = useState([{ id: 1, method: 'cash', amount: '', bank: '', reference: '', accountHolder: '' }])
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [previewImage, setPreviewImage] = useState(null)
  const [showEditSale, setShowEditSale] = useState(false)
  const [editSaleAmount, setEditSaleAmount] = useState('')
  const [editSaleRemark, setEditSaleRemark] = useState('')
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [perPage, setPerPage] = useState(50)
  const [addPayReceipt, setAddPayReceipt] = useState(null)
  const [partQuantity, setPartQuantity] = useState(1)
  const [selectedPartId, setSelectedPartId] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [newCustPhone, setNewCustPhone] = useState('')
  const [phoneWarning, setPhoneWarning] = useState('')
  const [saleType, setSaleType] = useState('vehicle')
  const addPayReceiptRef = useRef(null)
  const receiptRef = useRef(null)
  const { t } = useLanguage()

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(searchQuery), 350); return () => clearTimeout(t) }, [searchQuery])
  useEffect(() => { fetchData() }, [statusFilter, debouncedSearch, startDate, endDate, page])

  useEffect(() => {
    if (showNewSale) {
      setForm({})
      setSelectedVehicleId('')
      setSelectedPartId('')
      setPartQuantity(1)
      setSelectedCustomerId('')
      setNewCustPhone('')
      setPhoneWarning('')
      setSaleType('vehicle')
      setPayments([{ id: 1, method: 'cash', amount: '', bank: '', reference: '', accountHolder: '' }])
    }
  }, [showNewSale])

  useEffect(() => {
    if (!showAddPayment) {
      if (addPayReceiptRef.current) {
        URL.revokeObjectURL(addPayReceiptRef.current)
        addPayReceiptRef.current = null
      }
    }
  }, [showAddPayment])

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
      const branchId = user?.role?.toLowerCase() === 'admin' ? '' : (user?.branch_id || '')
      const [salesRes, vehRes, partsRes, custRes] = await Promise.all([
        api.get(`/sales?status=${statusFilter}&search=${searchQuery}&start_date=${startDate}&end_date=${endDate}&branch_id=${branchId}&page=${page}&per_page=${perPage}`),
        api.get(`/inventory/vehicles?status=available&branch_id=${branchId}`),
        api.get(`/inventory/spare-parts?branch_id=${branchId}`),
        api.get('/customers')
      ])
      
      // The backend now returns a paginated object: { items: [...], total: 100, pages: 2, ... }
      // But we need to check if the response is the array or the paginated object.
      // If the backend returns an array (from the previous version), we handle it.
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
        if (!p.bank?.trim()) {
          toast.error('Bank name is required for bank transfer payments')
          setSubmitting(false)
          return
        }
        if (!p.accountHolder?.trim()) {
          toast.error('Account holder is required for bank transfer payments')
          setSubmitting(false)
          return
        }
        if (!p.reference?.trim()) {
          toast.error('Reference ID is required for bank transfer payments')
          setSubmitting(false)
          return
        }
      }
    }

    const paymentsData = payments.map(p => ({
      method: p.method,
      amount: p.amount,
      ...(p.method === 'bank' ? { bank: p.bank?.toUpperCase(), reference: p.reference?.toUpperCase(), accountHolder: p.accountHolder?.toUpperCase() } : {}),
    }))

    const hasReceipts = payments.some(p => p.receiptFile)
    try {
      if (saleType === 'vehicle') {
        const vehicle = availableVehicles.find(veh => veh.id === parseInt(selectedVehicleId, 10))
        const sellingPrice = vehicle?.selling_price != null ? Number(vehicle.selling_price) : null
        if (!vehicle || sellingPrice == null || sellingPrice <= 0) {
          toast.error('Selected vehicle has no selling price in inventory')
          setSubmitting(false)
          return
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
          payments.forEach((p, idx) => {
            if (p.receiptFile) multipart.append(`receipt_${idx}`, p.receiptFile)
          })
          await api.post('/sales/vehicle', multipart)
        } else {
          await api.post('/sales/vehicle', {
            vehicle_id: parseInt(selectedVehicleId, 10),
            customer_name: fd.get('customer_name'),
            customer_phone: fd.get('customer_phone') || '',
            customer_id: selectedCustomerId ? parseInt(selectedCustomerId, 10) : null,
            chassis_number: vehicle.vin,
            motor_number: form.motor_number || '',
            total_amount: sellingPrice,
            sale_date: fd.get('sale_date'),
            remark: fd.get('remark'),
            payments: paymentsData,
            user_id: user?.id,
          })
        }
      } else {
        const part = availableParts.find(p => p.id === parseInt(selectedPartId, 10))
        if (!part) {
          toast.error('Please select a spare part')
          setSubmitting(false)
          return
        }
        const qty = parseInt(partQuantity, 10)
        if (qty < 1 || qty > part.quantity) {
          toast.error(`Invalid quantity. Available: ${part.quantity}`)
          setSubmitting(false)
          return
        }
        const totalAmount = qty * Number(part.unit_price)
        await api.post('/sales/spare-part', {
          part_id: parseInt(selectedPartId, 10),
          quantity: qty,
          customer_name: fd.get('customer_name'),
          customer_phone: fd.get('customer_phone') || '',
          customer_id: selectedCustomerId ? parseInt(selectedCustomerId, 10) : null,
          total_amount: totalAmount,
          sale_date: fd.get('sale_date'),
          remark: fd.get('remark'),
          payments: paymentsData,
          user_id: user?.id,
        })
      }
      toast.success('Sale recorded successfully!')
      setShowNewSale(false)
      setForm({})
      setPayments([{ id: 1, method: 'cash', amount: '', bank: '', reference: '', accountHolder: '' }])
      setSelectedCustomerId('')
      setSelectedVehicleId('')
      setSelectedPartId('')
      setPartQuantity(1)
      fetchData()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to record sale')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddPayment = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    const formData = new FormData(e.target)
    try {
      await api.post(`/sales/${selectedSale.id}/add-payment`, formData)
      toast.success('Payment recorded successfully')
      setShowAddPayment(false)
      setAddPayReceipt(null)
      setAddPayMethod('cash')
      fetchData()
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.msg || err?.message || 'Failed to add payment'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdatePayment = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    const fd = new FormData(e.target)
    const receiptFile = fd.get('receipt')
    if (receiptFile && receiptFile.size > 0) {
      try {
        const res = await api.put(`/sales/${selectedSale.id}/payments/${editingPayment.id}`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        toast.success('Payment updated')
        setEditingPayment(null)
        fetchSalePayments(selectedSale)
        fetchData()
      } catch (err) {
        toast.error(err?.response?.data?.message || 'Failed to update payment')
      } finally {
        setSubmitting(false)
      }
    } else {
      const data = {
        method: fd.get('method'),
        amount: parseFloat(fd.get('amount')),
        ...(fd.get('method') === 'bank' ? {
          bank: fd.get('bank'),
          accountHolder: fd.get('account_holder'),
          reference: fd.get('reference'),
        } : {}),
      }
      try {
        const res = await api.put(`/sales/${selectedSale.id}/payments/${editingPayment.id}`, data)
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

  const handleCameraAddPay = async () => {
    const result = await pickImage()
    if (!result) return
    const file = new File([result.blob], 'receipt.jpg', { type: 'image/jpeg' })
    const dt = new DataTransfer()
    dt.items.add(file)
    const input = document.getElementById('receipt-upload-add')
    if (input) input.files = dt.files
    addPayReceiptRef.current = result.dataUrl
    setAddPayReceipt(result.dataUrl)
  }

  const handleCameraEditPay = async () => {
    const result = await pickImage()
    if (!result) return
    const file = new File([result.blob], 'receipt.jpg', { type: 'image/jpeg' })
    const dt = new DataTransfer()
    dt.items.add(file)
    if (receiptRef.current) receiptRef.current.files = dt.files
    setEditingPayment(prev => ({ ...prev, receipt_preview: result.dataUrl }))
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
          <button
            onClick={() => exportSalesToExcel(sales, t)}
            className="px-4 py-2.5 bg-slate-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 transition-colors flex items-center gap-2"
          >
            <Download size={18} />
            {t('exportReport')}
          </button>
          <button onClick={() => setShowNewSale(true)} className="btn-primary flex items-center gap-2">
            <Plus size={20} />
            {t('recordNewSale')}
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col lg:flex-row items-center gap-4 bg-neutral-50 dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800">
        <div className="flex bg-white dark:bg-neutral-900 p-1 rounded-xl border border-neutral-200 dark:border-neutral-800 w-full lg:w-auto">
          {[
            { label: t('all'),       val: '' },
            { label: t('pending'),   val: 'pending' },
            { label: t('completed'), val: 'completed' },
          ].map(({ label, val }) => (
            <button
              key={val}
              onClick={() => setStatusFilter(val)}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                statusFilter === val
                  ? val === '' ? 'bg-neutral-700 text-white'
                    : val === 'pending' ? 'bg-amber-500 text-white'
                    : 'bg-emerald-500 text-white'
                  : 'text-slate-500 hover:text-slate-700 dark:text-neutral-400'
              }`}
            >{label}</button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto">
          <input type="date" className="input-field w-auto" value={startDate} onChange={e => setStartDate(e.target.value)} />
          <span className="text-slate-500 text-xs font-bold">TO</span>
          <input type="date" className="input-field w-auto" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>

        <div className="flex-1 relative w-full group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text" placeholder={t('searchCustomer')}
            className="input-field input-with-icon"
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Sales Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="animate-spin text-brand-600" size={40} />
            <p className="text-slate-400 font-medium animate-pulse">Syncing transactions...</p>
          </div>
        ) : (
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
                       <td className="px-6 py-4 hidden sm:table-cell"><ImageCell imageData={sale.item_image} onClick={setPreviewImage} /></td>
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
                          <button onClick={() => fetchSalePayments(sale)} className="p-2.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-slate-600 dark:text-slate-300 rounded-xl border border-neutral-200 dark:border-neutral-700 transition-colors" title="View Payments">
                            <Eye size={18} />
                          </button>
                          {sale.status === 'pending' && (
                            <button onClick={() => { setSelectedSale(sale); setAddPayReceipt(null); setShowAddPayment(true) }} className="p-2.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-200 dark:border-amber-800 transition-colors" title="Collect Payment">
                              <CreditCard size={18} />
                            </button>
                          )}
                          {isAdmin(user) && sale.status !== 'cancelled' && (
                            <>
                              {sale.status === 'pending' && (
                                <button
                                  onClick={() => { setSelectedSale(sale); setEditSaleAmount(String(sale.total_amount)); setEditSaleRemark(sale.remark || ''); setShowEditSale(true) }}
                                  className="p-2.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-200 dark:border-indigo-800 transition-colors"
                                  title={t('editSale')}
                                >
                                  <Pencil size={18} />
                                </button>
                              )}
                              <button
                                onClick={() => handleCancelSale(sale)}
                                className="p-2.5 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-200 dark:border-rose-800 transition-colors"
                                title="Cancel Sale"
                              >
                                <Trash2 size={18} />
                              </button>
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
          )}
        </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <span className="text-xs font-bold text-slate-500">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button 
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))} 
              className="px-4 py-2 text-xs font-bold rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
            >
              Previous
            </button>
            <button 
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)} 
              className="px-4 py-2 text-xs font-bold rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Payment History Modal — uses standard modal-backdrop */}
      {showPaymentHistory && selectedSale && (
        <div className="modal-backdrop">
          <div className="modal-content max-w-4xl">
            <div className="modal-header">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('paymentAuditLog')}</h2>
                <p className="text-xs font-medium text-slate-500 mt-0.5">{t('receiptNum')}: <span className="text-blue-600 font-mono">#{selectedSale.sale_number}</span></p>
              </div>
              <button onClick={() => setShowPaymentHistory(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-slate-700"><X size={20} /></button>
            </div>

            <div className="modal-body">
              <div className="space-y-3">
                {salePayments.length === 0 ? (
                  <div className="py-10 text-center text-slate-500">{t('noPaymentRecords')}</div>
                ) : (
                  salePayments.map(p => (
                    <div key={p.id} className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                          {p.method === 'cash' ? <CreditCard size={18} /> : <Landmark size={18} />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-slate-900 dark:text-white font-bold">ETB {p.amount.toLocaleString()}</p>
                          <p className="text-xs text-slate-500 truncate">{p.method}{p.bank ? ` • ${p.bank}` : ''}{p.account_holder ? ` → ${p.account_holder}` : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 sm:text-right sm:shrink-0">
                        <div className="min-w-0">
                          <p className="text-xs text-slate-400">{formatDateTime(p.date)}</p>
                          <p className="text-xs font-mono text-slate-500 mt-0.5 truncate max-w-[160px] sm:max-w-none">{(p.reference || 'NO REF').toUpperCase()}</p>
                        </div>
                        {p.receipt_image && (
                          <button
                            onClick={() => setPreviewImage(p.receipt_image)}
                            className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded-lg transition-colors shrink-0"
                            title="View Receipt"
                          >
                            <img src={p.receipt_image} alt="Receipt" className="w-9 h-9 object-cover rounded" />
                          </button>
                        )}
                        {isAdmin(user) && (
                          <button
                            onClick={() => { setEditingPayment(p); setEditPayMethod(p.method); setShowPaymentHistory(false); }}
                            className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 rounded-lg transition-colors shrink-0"
                            title="Edit Payment"
                          ><Pencil size={16} /></button>
                        )}
                        {isAdmin(user) && (
                          <button
                            onClick={() => handleDeletePayment(p)}
                            className="p-2 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-900/50 rounded-lg transition-colors shrink-0"
                            title="Delete Payment"
                          ><Trash2 size={16} /></button>
                        )}
                       </div>
                     </div>
                   ))
                 )}
               </div>
             </div>

             <div className="modal-footer justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">{t('totalCollected')}</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  ETB {salePayments.reduce((acc, p) => acc + p.amount, 0).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setShowPaymentHistory(false)} className="btn-secondary">{t('close')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Payment Modal */}
      {showAddPayment && selectedSale && (
        <div className="modal-backdrop">
          <div className="modal-content max-w-3xl">
            <div className="modal-header">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('collectPayment')}</h2>
                <p className="text-xs font-medium text-slate-500 mt-0.5">{t('receiptNum')}: <span className="text-blue-600 font-mono">#{selectedSale.sale_number}</span></p>
              </div>
              <button onClick={() => setShowAddPayment(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-slate-700"><X size={20} /></button>
            </div>

            <div className="modal-body">
              <div className="p-5 mb-6 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-200 dark:border-amber-800/40 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{t('outstandingBalance')}</span>
                <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">ETB {(selectedSale.total_amount - selectedSale.amount_paid).toLocaleString()}</span>
              </div>

              <form id="add-pay-form" onSubmit={handleAddPayment} className="space-y-6">
                <div className="p-6 bg-neutral-50 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-5">
                  <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">{t('paymentDetails')}</h3>

                  <div>
                    <label className="label">{t('amountToPay')}</label>
                    <input type="number" name="amount" className="input-field" max={selectedSale.total_amount - selectedSale.amount_paid} placeholder="0.00" required />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">{t('method')}</label>
                      <select name="method" className="input-field" value={addPayMethod} onChange={e => setAddPayMethod(e.target.value)}>
                        <option value="cash">{t('cash')}</option>
                        <option value="bank">{t('bankTransfer')}</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">{t('bankName')} *</label>
                      <input name="bank" className="input-field disabled:opacity-40" list="bank-list-add" placeholder={t('typeBankName')} disabled={addPayMethod === 'cash'} required />
                      <datalist id="bank-list-add">
                        {['CBE','Awash','Abyssinia','Dashen','BOA','Hibret'].map(b => <option key={b} value={b} />)}
                      </datalist>
                    </div>
                  </div>

                  {addPayMethod === 'bank' && (
                    <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700 space-y-5">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('bankTransferDetails')}</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="label">{t('accountHolder')} *</label>
                          <input name="account_holder" className="input-field" list="account-list-add" placeholder="Select or type" required />
                          <datalist id="account-list-add">
                            <option value="Tewelde" /><option value="Berihu" /><option value="Mulugeta" />
                          </datalist>
                        </div>
                        <div>
                          <label className="label">{t('referenceNumber')} *</label>
                          <input type="text" name="reference" className="input-field uppercase" placeholder="TX-123456789" required />
                        </div>
                      </div>
                      <div>
                         <label className="label">{t('bankReceiptImage')}</label>
                         <div className="relative">
                           <input type="file" name="receipt" accept="image/*" className="hidden" id="receipt-upload-add" onChange={e => {
                            if (e.target.files?.[0]) {
                             const url = URL.createObjectURL(e.target.files[0])
                             addPayReceiptRef.current = url
                             setAddPayReceipt(url)
                            } else { setAddPayReceipt(null) }
                           }} />
                           {addPayReceipt ? (
                            <div className="flex items-center gap-4">
                             <img src={addPayReceipt} alt="Preview" className="w-24 h-24 object-cover rounded-xl border border-neutral-200 dark:border-neutral-700 shrink-0" />
                             <button type="button" onClick={() => { URL.revokeObjectURL(addPayReceipt); addPayReceiptRef.current = null; document.getElementById('receipt-upload-add').value = ''; setAddPayReceipt(null) }} className="text-xs text-red-500 hover:text-red-700 font-medium">{t('remove')}</button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              <label htmlFor="receipt-upload-add" className="flex items-center justify-center gap-3 flex-1 py-4 px-4 border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-xl text-slate-500 hover:border-blue-500 hover:text-blue-600 transition-colors cursor-pointer min-w-[180px]">
                               <Upload size={20} /><span className="text-sm font-medium">{t('selectImageFile')}</span>
                              </label>
                              <button type="button" onClick={handleCameraAddPay} className="flex items-center justify-center gap-2 py-4 px-4 border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-xl text-slate-500 hover:border-blue-500 hover:text-blue-600 transition-colors cursor-pointer">
                               <Camera size={20} /><span className="text-sm font-medium">{t('captureOrSelect')}</span>
                              </button>
                            </div>
                          )}
                         </div>
                       </div>
                    </div>
                  )}
                </div>
              </form>
            </div>

            <div className="modal-footer">
              <button type="button" onClick={() => setShowAddPayment(false)} className="btn-secondary">{t('cancel')}</button>
              <button form="add-pay-form" type="submit" disabled={submitting} className="btn-primary flex items-center gap-2">
                {submitting ? <Loader2 className="animate-spin" size={16} /> : <CreditCard size={16} />}
                {t('postPayment')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Payment Modal */}
      {editingPayment && selectedSale && (
        <div className="modal-backdrop">
          <div className="modal-content max-w-3xl">
            <div className="modal-header">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('editPayment') || 'Edit Payment'}</h2>
                <p className="text-xs font-medium text-slate-500 mt-0.5">{t('receiptNum')}: <span className="text-blue-600 font-mono">#{selectedSale.sale_number}</span></p>
              </div>
              <button onClick={() => { setEditingPayment(null); setShowPaymentHistory(true) }} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-slate-700"><X size={20} /></button>
            </div>
            <div className="modal-body">
              <form id="edit-pay-form" onSubmit={handleUpdatePayment} className="space-y-6">
                <div className="p-6 bg-neutral-50 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-5">
                  <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">{t('paymentDetails')}</h3>
                  <div>
                    <label className="label">{t('amountToPay')}</label>
                    <input type="number" name="amount" className="input-field" defaultValue={editingPayment.amount} placeholder="0.00" required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">{t('method')}</label>
                      <select name="method" className="input-field" value={editPayMethod} onChange={e => setEditPayMethod(e.target.value)}>
                        <option value="cash">{t('cash')}</option>
                        <option value="bank">{t('bankTransfer')}</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">{t('bankName')} *</label>
                      <input name="bank" className="input-field disabled:opacity-40" list="bank-list-add" defaultValue={editingPayment.bank || ''} placeholder={t('typeBankName')} disabled={editPayMethod === 'cash'} required />
                      <datalist id="bank-list-add">{['CBE','Awash','Abyssinia','Dashen','BOA','Hibret'].map(b => <option key={b} value={b} />)}</datalist>
                    </div>
                  </div>
                  {editPayMethod === 'bank' && (
                    <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700 space-y-5">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('bankTransferDetails')}</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="label">{t('accountHolder')} *</label>
                          <input name="account_holder" className="input-field" list="account-list-add" defaultValue={editingPayment.account_holder || ''} placeholder="Select or type" required />
                          <datalist id="account-list-add"><option value="Tewelde" /><option value="Berihu" /><option value="Mulugeta" /></datalist>
                        </div>
                        <div>
                          <label className="label">{t('referenceNumber')} *</label>
                          <input type="text" name="reference" className="input-field uppercase" defaultValue={editingPayment.reference || ''} placeholder="TX-123456789" required />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                  <div className="p-6 bg-neutral-50 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-5">
                   <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">{t('receipt')}</h3>
                   {editingPayment.receipt_image && (
                     <div className="flex items-center gap-4">
                       <img src={editingPayment.receipt_image} alt="Receipt" className="w-24 h-24 object-cover rounded-xl border border-neutral-200 dark:border-neutral-700 shrink-0" />
                       <span className="text-xs text-slate-500">{t('existingReceipt')}</span>
                     </div>
                   )}
                   <div className="flex flex-wrap gap-2">
                     <label className="flex items-center justify-center gap-3 flex-1 py-4 px-4 border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-xl text-slate-500 hover:border-blue-500 hover:text-blue-600 transition-colors cursor-pointer min-w-[180px]">
                       <Upload size={20} />
                       <span className="text-sm font-medium">{t('uploadReceipt') || 'Upload Receipt'}</span>
                       <input type="file" name="receipt" accept="image/*" className="hidden" ref={receiptRef} onChange={e => {
                         if (e.target.files?.[0]) {
                           const reader = new FileReader()
                           reader.onload = ev => setEditingPayment(prev => ({ ...prev, receipt_preview: ev.target.result }))
                           reader.readAsDataURL(e.target.files[0])
                         }
                       }} />
                     </label>
                     <button type="button" onClick={handleCameraEditPay} className="flex items-center justify-center gap-2 py-4 px-4 border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-xl text-slate-500 hover:border-blue-500 hover:text-blue-600 transition-colors cursor-pointer">
                       <Camera size={20} /><span className="text-sm font-medium">{t('captureOrSelect')}</span>
                     </button>
                   </div>
                   {editingPayment.receipt_preview && (
                     <div className="flex items-center gap-4">
                       <img src={editingPayment.receipt_preview} alt="Preview" className="w-24 h-24 object-cover rounded-xl border border-neutral-200 dark:border-neutral-700 shrink-0" />
                       <button type="button" onClick={() => { setEditingPayment(prev => ({ ...prev, receipt_preview: null })); if (receiptRef.current) receiptRef.current.value = '' }} className="text-xs text-red-500 hover:text-red-700 font-medium">{t('remove')}</button>
                     </div>
                    )}
                 </div>
                 <div className="col-span-full">
                  <div className="p-6 bg-neutral-50 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-4">
                    <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">{t('remark')}</h3>
                    <textarea name="remark" className="input-field h-20 resize-none" placeholder="Optional notes..." />
                  </div>
                </div>
              </form>
            </div>

            <div className="modal-footer">
              <button type="button" onClick={() => { setEditingPayment(null); setShowPaymentHistory(true) }} className="btn-secondary">{t('cancel')}</button>
              <button form="edit-pay-form" type="submit" disabled={submitting} className="btn-primary flex items-center gap-2">
                {submitting ? <Loader2 className="animate-spin" size={16} /> : <Pencil size={16} />}
                {t('save') || 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Sale Modal */}
      {showNewSale && (
        <div className="modal-backdrop">
          <div className="modal-content max-w-6xl">
            <div className="modal-header">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('recordNewTransaction')}</h2>
                <p className="text-xs font-medium text-slate-500 mt-0.5">{t('enterpriseSalesManagement')}</p>
              </div>
              <button onClick={() => setShowNewSale(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-slate-700"><X size={20}/></button>
            </div>

            <div className="modal-body custom-scrollbar">
              <form id="sale-form" onSubmit={handleSubmit} className="space-y-10">
                {/* Sale Type Toggle */}
                <div className="flex items-center gap-2 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl w-fit border border-neutral-200 dark:border-neutral-700">
                  <button type="button" onClick={() => setSaleType('vehicle')} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-colors ${saleType === 'vehicle' ? 'bg-white dark:bg-neutral-700 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                    <Truck size={18} />{t('vehicleSale')}
                  </button>
                  <button type="button" onClick={() => setSaleType('spare_part')} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-colors ${saleType === 'spare_part' ? 'bg-white dark:bg-neutral-700 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                    <Wrench size={18} />{t('sparePartSale')}
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                  {/* Left Column */}
                  <div className="lg:col-span-5 space-y-8">
                    <div className="p-8 bg-neutral-50 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-6">
                      <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">{t('clientInformation')}</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="label">{t('selectExistingCustomer')}</label>
                          <select className="input-field" value={selectedCustomerId} onChange={e => {
                            setSelectedCustomerId(e.target.value)
                            setPhoneWarning('')
                            if (e.target.value) {
                              const c = customers.find(c => c.id === parseInt(e.target.value))
                              if (c) {
                                const f = document.getElementById('sale-form')
                                f.customer_name.value  = c.full_name
                                setNewCustPhone(c.phone)
                              }
                            }
                          }}>
                            <option value="">{t('newCustomer')}</option>
                            {customers.map(c => <option key={c.id} value={c.id}>{capitalizeName(c.full_name)} ({c.phone})</option>)}
                          </select>
                        </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                           <div><label className="label">{t('fullName')}</label><input type="text" name="customer_name" required className="input-field" placeholder="Abebe Kebede" /></div>
                           <div>
                            <label className="label">{t('phoneNumber')}</label>
                            <input type="text" name="customer_phone" className={`input-field ${phoneWarning ? 'border-amber-500 dark:border-amber-500' : ''}`}
                             placeholder="0911..."
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
                      </div>
                    </div>

                    {saleType === 'vehicle' ? (
                      <div className="p-8 bg-neutral-50 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-6">
                        <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">{t('vehicleAndDate')}</h3>
                        <div className="space-y-4">
                          <div>
                            <label className="label">{t('vehicle')} *</label>
                            <select name="vehicle_id" required className="input-field" value={selectedVehicleId} onChange={e => handleVehicleSelect(e.target.value)}>
                              <option value="">{t('selectItem')}</option>
                              {sortedVehicles.map(v => (
                                <option key={v.id} value={v.id}>
                                  {v.model.toUpperCase()} — {v.vin}
                                  {v.engine_number ? ` — Motor: ${v.engine_number}` : ''}
                                  {v.selling_price != null ? ` — ETB ${Number(v.selling_price).toLocaleString()}` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="label">{t('chassisNumber')} (VIN)</label>
                              <input type="text" name="chassis_number" readOnly className="input-field bg-neutral-100 dark:bg-neutral-800" value={form.chassis_number ?? ''} />
                            </div>
                            <div>
                              <label className="label">{t('motorNumber')}</label>
                              <input type="text" name="motor_number" className="input-field" value={form.motor_number ?? ''} onChange={e => set('motor_number', e.target.value)} placeholder="Auto-filled from inventory" />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="label">{t('sellingPrice')}</label>
                              <input type="number" name="total_amount" readOnly required className="input-field bg-neutral-100 dark:bg-neutral-800" value={form.total_amount ?? ''} />
                            </div>
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
                            <select name="part_id" required className="input-field" value={selectedPartId} onChange={e => setSelectedPartId(e.target.value)}>
                              <option value="">{t('selectItem')}</option>
                              {sortedParts.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.name.toUpperCase()} — {p.part_number || ''} — ETB {Number(p.unit_price).toLocaleString()} — Stock: {p.quantity}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="label">{t('quantity')}</label>
                              <input type="number" name="quantity" min="1" required className="input-field" value={partQuantity} onChange={e => setPartQuantity(e.target.value)} />
                            </div>
                            <div>
                              <label className="label">{t('unitPrice')}</label>
                              <input type="number" readOnly className="input-field bg-neutral-100 dark:bg-neutral-800"
                                value={selectedPartId ? (availableParts.find(p => p.id === parseInt(selectedPartId, 10))?.unit_price ?? '') : ''} />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="label">{t('totalAmount')}</label>
                              <input type="number" readOnly className="input-field bg-neutral-100 dark:bg-neutral-800"
                                value={selectedPartId && partQuantity ? Number(partQuantity) * Number(availableParts.find(p => p.id === parseInt(selectedPartId, 10))?.unit_price || 0) : ''} />
                            </div>
                            <div>
                              <label className="label">{t('date')}</label>
                              <input type="date" name="sale_date" required className="input-field" defaultValue={`${new Date().getFullYear()}-${pad(new Date().getMonth()+1)}-${pad(new Date().getDate())}`} />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column */}
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
                              <button type="button" onClick={() => removePaymentRow(p.id)} className="absolute right-3 top-3 p-1.5 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/30 rounded-lg">
                                <Trash2 size={16}/>
                              </button>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              <div>
                                <label className="label">{t('channel')}</label>
                                <select className="input-field" value={p.method} onChange={e => {
                                  const n = [...payments]
                                  n[index].method = e.target.value
                                  if (e.target.value === 'cash') {
                                    n[index].reference = ''
                                    n[index].bank = ''
                                    n[index].accountHolder = ''
                                    n[index].receiptFile = null
                                  }
                                  setPayments(n)
                                }}>
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
                                  <datalist id="account-list-new">
                                    <option value="Tewelde" /><option value="Berihu" /><option value="Mulugeta" />
                                  </datalist>
                                </div>
                                <div>
                                  <label className="label">{t('referenceNumber')} *</label>
                                  <input className="input-field uppercase" required value={p.reference || ''} onChange={e => { const n = [...payments]; n[index].reference = e.target.value.toUpperCase(); setPayments(n) }} placeholder="TX-123456789" />
                                </div>
                                <div className="sm:col-span-2">
                                  <label className="label">{t('bankReceiptImage')}</label>
                                  <div className="flex flex-wrap gap-2">
                                    <label className="flex items-center justify-center gap-3 flex-1 py-3 px-4 border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-xl text-slate-500 hover:border-brand-500 hover:text-brand-600 transition-colors cursor-pointer min-w-[160px]">
                                      <Upload size={18} />
                                      <span className="text-sm font-medium">{p.receiptFile ? p.receiptFile.name : t('selectImageFile')}</span>
                                      <input type="file" accept="image/*" className="hidden" onChange={e => {
                                        const n = [...payments]
                                        n[index].receiptFile = e.target.files[0] || null
                                        setPayments(n)
                                      }} />
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
                        <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                          ETB {payments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>

            <div className="modal-footer">
              <button type="button" onClick={() => setShowNewSale(false)} className="btn-secondary">{t('cancel')}</button>
              <button form="sale-form" type="submit" disabled={submitting} className="btn-primary px-10">
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {t('completeRecord')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Sale Modal */}
      {showEditSale && selectedSale && (
        <div className="modal-backdrop">
          <div className="modal-content max-w-2xl">
            <div className="modal-header">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('editSale')}</h2>
                <p className="text-xs font-medium text-slate-500 mt-0.5">{t('receiptNum')}: <span className="text-blue-600 font-mono">#{selectedSale.sale_number}</span></p>
              </div>
              <button onClick={() => { setShowEditSale(false); setSelectedSale(null) }} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-slate-700"><X size={20} /></button>
            </div>
            <form onSubmit={handleUpdateSale}>
              <div className="modal-body">
                <div className="p-6 bg-neutral-50 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-5">
                  <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">{t('financials')}</h3>
                  <div>
                    <label className="label">{t('totalContract')}</label>
                    <input type="number" className="input-field" value={editSaleAmount} onChange={e => setEditSaleAmount(e.target.value)} step="0.01" min="0" required />
                  </div>
                  <div>
                    <label className="label">{t('remark')}</label>
                    <textarea className="input-field h-20 resize-none" value={editSaleRemark} onChange={e => setEditSaleRemark(e.target.value)} placeholder="Optional notes..." />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => { setShowEditSale(false); setSelectedSale(null) }} className="btn-secondary">{t('cancel')}</button>
                <button type="submit" disabled={editSubmitting} className="btn-primary flex items-center gap-2">
                  {editSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Pencil size={16} />}
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPreviewImage(null)} className="absolute -top-12 right-0 p-2 bg-white dark:bg-neutral-800 rounded-full text-slate-900 dark:text-white transition-colors"><X size={22} /></button>
            <img src={previewImage} alt="Receipt" className="w-full h-auto max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-700" />
          </div>
        </div>
      )}
    </div>
  )
}

export default Sales
