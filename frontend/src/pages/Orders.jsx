import React, { useState, useEffect, useMemo } from 'react'
import { Plus, Download, Loader2 } from 'lucide-react'
import api from '../services/api'
import { toast } from 'react-toastify'
import { useLanguage } from '../i18n/LanguageContext'
import { capitalizeName } from '../utils/format'
import { exportOrdersToExcel } from '../services/ExportService'
import OrdersStatsCards from '../components/orders/OrdersStatsCards'
import OrdersFilterBar from '../components/orders/OrdersFilterBar'
import OrdersTable from '../components/orders/OrdersTable'
import AddOrderModal from '../components/orders/AddOrderModal'
import DepositModal from '../components/orders/DepositModal'
import CancelOrderModal from '../components/orders/CancelOrderModal'
import CustomerDetailModal from '../components/orders/CustomerDetailModal'
import FulfillOrderModal from '../components/orders/FulfillOrderModal'

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
  const [depositOrder, setDepositOrder] = useState(null)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [customerDetail, setCustomerDetail] = useState(null)
  const [customerDeposits, setCustomerDeposits] = useState([])
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancellingOrder, setCancellingOrder] = useState(null)
  const [showFulfillModal, setShowFulfillModal] = useState(false)
  const [fulfillOrder, setFulfillOrder] = useState(null)
  const [customers, setCustomers] = useState([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [newCustPhone, setNewCustPhone] = useState('')
  const [phoneWarning, setPhoneWarning] = useState('')
  const [orderMethod, setOrderMethod] = useState('cash')
  const [orderBank, setOrderBank] = useState('')
  const [orderAccountHolder, setOrderAccountHolder] = useState('')
  const [orderReference, setOrderReference] = useState('')
  const [editingOrder, setEditingOrder] = useState(null)

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
      setBranches(res.data.items || res.data)
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

  const handleFulfill = async (order) => {
    setFulfillOrder(order)
    setShowFulfillModal(true)
  }

  const handleFulfillSubmit = async (orderId, vehicleId) => {
    setSubmitting(true)
    try {
      const res = await api.post(`/orders/${orderId}/fulfill`, { vehicle_id: vehicleId })
      toast.success(res.data.message || 'Order fulfilled successfully')
      setShowFulfillModal(false)
      setFulfillOrder(null)
      fetchOrders()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to fulfill order')
    } finally {
      setSubmitting(false)
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
      try {
        const res = await api.get(`/customers/${order.customer_id}/deposits`)
        setCustomerDeposits(res.data)
      } catch {
        setCustomerDeposits([])
      }
    } else {
      setCustomerDetail(null)
      setCustomerDeposits([])
    }
    setShowCustomerModal(true)
  }

  const handleAddDeposit = async (orderId, amount, method, bank, accountHolder, reference, receiptFile) => {
    setSubmitting(true)
    try {
      let res
      if (receiptFile) {
        const fd = new FormData()
        fd.append('amount', parseFloat(amount))
        fd.append('method', method)
        fd.append('bank', bank || '')
        fd.append('account_holder', accountHolder || '')
        fd.append('reference', reference || '')
        fd.append('receipt', receiptFile)
        res = await api.post(`/orders/${orderId}/deposit`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      } else {
        res = await api.post(`/orders/${orderId}/deposit`, {
          amount: parseFloat(amount),
          method,
          bank,
          account_holder: accountHolder,
          reference
        })
      }
      toast.success(`Deposit added. Total: ETB ${res.data.deposit_amount.toLocaleString()}`)
      setShowDepositModal(false)
      setDepositOrder(null)
      fetchOrders()
    } catch (error) {
      toast.error('Failed to add deposit')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancelOrder = async (reason, refund_amount, refund_method, refund_bank, refund_reference) => {
    setSubmitting(true)
    try {
      const data = {
        reason,
        refund_amount: parseFloat(refund_amount),
        refund_method,
      }
      if (refund_method === 'bank') {
        data.refund_bank = refund_bank
        data.refund_transaction_reference = refund_reference
      }
      await api.post(`/orders/${cancellingOrder.id}/cancel`, data)
      toast.success('Order cancelled')
      setShowCancelModal(false)
      setCancellingOrder(null)
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

      <OrdersStatsCards
        allWaitingCount={allWaitingCount}
        allDepositsSum={allDepositsSum}
        allFulfilledCount={allFulfilledCount}
        allCancelledCount={allCancelledCount}
        allRefundsSum={allRefundsSum}
      />

      <OrdersFilterBar
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        search={search}
        onSearchChange={setSearch}
      />

      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="animate-spin inline-block text-blue-600 dark:text-blue-400 mb-2" size={32} />
            <p className="text-slate-500 text-sm">{t('syncingQueue')}</p>
          </div>
        ) : (
          <OrdersTable
            orders={filteredOrders}
            onSelectOrder={viewCustomerDetail}
            onDeposit={(order) => { setDepositOrder(order); setShowDepositModal(true) }}
            onFulfill={handleFulfill}
            onCancel={(order) => { setCancellingOrder(order); setShowCancelModal(true) }}
            onDelete={handleDelete}
            onEdit={openEditOrder}
            onReorder={async (id, direction) => {
              try {
                await api.post('/orders/reorder', { id, direction })
                fetchOrders()
              } catch { toast.error('Failed to reorder') }
            }}
            user={user}
          />
        )}
      </div>

      {showAddModal && (
        <AddOrderModal
          editingOrder={editingOrder}
          onClose={() => { setShowAddModal(false); setEditingOrder(null); setOrderMethod('cash'); setOrderBank(''); setOrderAccountHolder(''); setOrderReference(''); setNewCustPhone(''); setPhoneWarning(''); setSelectedBranchId(''); }}
          onSubmit={handleSubmit}
          submitting={submitting}
          customers={customers}
          selectedCustomerId={selectedCustomerId}
          setSelectedCustomerId={setSelectedCustomerId}
          newCustPhone={newCustPhone}
          setNewCustPhone={setNewCustPhone}
          phoneWarning={phoneWarning}
          setPhoneWarning={setPhoneWarning}
          branches={branches}
          selectedBranchId={selectedBranchId}
          setSelectedBranchId={setSelectedBranchId}
          user={user}
          orderMethod={orderMethod}
          setOrderMethod={setOrderMethod}
          orderBank={orderBank}
          setOrderBank={setOrderBank}
          orderAccountHolder={orderAccountHolder}
          setOrderAccountHolder={setOrderAccountHolder}
          orderReference={orderReference}
          setOrderReference={setOrderReference}
        />
      )}

      {showDepositModal && depositOrder && (
        <DepositModal
          order={depositOrder}
          onClose={() => setShowDepositModal(false)}
          onSubmit={handleAddDeposit}
          submitting={submitting}
          onViewCustomer={viewCustomerDetail}
        />
      )}

      {showCancelModal && cancellingOrder && (
        <CancelOrderModal
          order={cancellingOrder}
          onClose={() => setShowCancelModal(false)}
          onSubmit={handleCancelOrder}
          submitting={submitting}
        />
      )}

      {showFulfillModal && fulfillOrder && (
        <FulfillOrderModal
          order={fulfillOrder}
          onClose={() => { setShowFulfillModal(false); setFulfillOrder(null) }}
          onSubmit={handleFulfillSubmit}
          submitting={submitting}
        />
      )}

      {showCustomerModal && (
        <CustomerDetailModal
          customer={customerDetail}
          deposits={customerDeposits}
          onClose={() => setShowCustomerModal(false)}
        />
      )}
    </div>
  )
}

export default Orders
