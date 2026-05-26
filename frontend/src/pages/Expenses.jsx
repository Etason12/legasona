import React, { useState, useEffect } from 'react'
import { FileText, Plus, Search, DollarSign, Calendar, Tag, MoreVertical, Loader2, Trash2, Image as ImageIcon, X, Check } from 'lucide-react'
import api, { API_BASE_URL } from '../services/api'
import axios from 'axios'
import { toast } from 'react-toastify'
import { useLanguage } from '../i18n/LanguageContext'

const Expenses = ({ user }) => {
 const [expenses, setExpenses] = useState([])
 const [loading, setLoading] = useState(true)
 const [showAddModal, setShowAddModal] = useState(false)
 const [submitting, setSubmitting] = useState(false)
 const [previewImage, setPreviewImage] = useState(null)
 const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
 const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
 const [search, setSearch] = useState('')
 const [budgetData, setBudgetData] = useState({ budget: 0, spent: 0, remaining: 0 })
 const { t } = useLanguage()

 useEffect(() => {
  fetchExpenses()
  fetchBudget()
 }, [startDate, endDate])

 const fetchBudget = async () => {
  try {
   const branchId = user?.role?.toLowerCase() === 'admin' ? '' : (user?.branch_id || '')
   const res = await api.get(`/expenses/budget?branch_id=${branchId}`)
   setBudgetData(res.data)
  } catch { /* ignore */ }
 }

 const fetchExpenses = async () => {
  setLoading(true)
  try {
   const branchId = user?.role?.toLowerCase() === 'admin' ? '' : (user?.branch_id || '')
   let url = `/expenses?branch_id=${branchId}`
   if (startDate) url += `&start_date=${startDate}`
   if (endDate) url += `&end_date=${endDate}`
   const res = await api.get(url)
   setExpenses(res.data)
  } catch (error) {
   toast.error('Failed to fetch expenses')
  } finally {
   setLoading(false)
  }
 }

 const handleDelete = async (id) => {
  if (!window.confirm(t('deleteExpenseConfirm'))) return
  try {
   await api.delete(`/expenses/${id}`)
    toast.success('Expense deleted')
    fetchExpenses()
    fetchBudget()
  } catch (error) {
   toast.error('Failed to delete expense')
  }
 }

 const handleSubmit = async (e) => {
  e.preventDefault()
  setSubmitting(true)
  const formData = new FormData(e.target)
  formData.append('branch_id', user?.branch_id || 1)
  formData.append('user_id', user?.id || 1)

  try {
   await api.post('/expenses', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
   })
    toast.success('Expense recorded successfully')
    setShowAddModal(false)
    fetchExpenses()
    fetchBudget()
  } catch (error) {
   toast.error('Failed to record expense')
  } finally {
   setSubmitting(false)
  }
 }

 return (
  <div className="space-y-8">
   <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
    <div>
     <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{t('expenseTracking')}</h1>
     <p className="text-slate-400 mt-1 font-medium">{t('expenseDesc')}</p>
    </div>
    <button 
     onClick={() => setShowAddModal(true)}
     className="btn-primary flex items-center gap-2"
    >
     <Plus size={20} />
     {t('recordExpense')}
    </button>
   </div>

   <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
    <div className="glass-card p-6 border-l-4 border-rose-500">
     <p className="text-xs text-slate-500 uppercase font-bold ">{t('totalMonthly')}</p>
     <p className="text-3xl font-bold mt-2 text-slate-900 dark:text-white">ETB {expenses.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}</p>
    </div>
    <div className="glass-card p-6 border-l-4 border-amber-500">
     <p className="text-xs text-slate-500 uppercase font-bold ">{t('pendingApproval')}</p>
     <p className="text-3xl font-bold mt-2 text-slate-900 dark:text-white">0</p>
    </div>
    <div className="glass-card p-6 border-l-4 border-primary-500">
     <p className="text-xs text-slate-500 uppercase font-bold ">{t('budgetRemaining')}</p>
     <p className="text-3xl font-bold mt-2 text-slate-900 dark:text-white">ETB {budgetData.remaining.toLocaleString()}</p>
     <p className="text-xs text-slate-400 mt-1">of ETB {budgetData.budget.toLocaleString()} budget</p>
    </div>
   </div>

   <div className="glass-card overflow-hidden">
    <div className="p-6 border-b border-slate-200 dark:border-slate-300 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
     <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('transactionHistory')}</h3>
     <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
      <div className="flex items-center gap-2 w-full md:w-auto">
       <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input-field py-1.5 text-sm" />
       <span className="text-slate-500">-</span>
       <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input-field py-1.5 text-sm" />
      </div>
      <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-300 dark:border-slate-700 px-4 py-2 rounded-xl w-full md:w-64">
       <Search size={18} className="text-slate-500" />
       <input 
        type="text" 
        placeholder={t('searchExpenses')} 
        className="bg-transparent border-none outline-none text-sm w-full text-slate-600 dark:text-slate-300"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
       />
      </div>
     </div>
    </div>
    
    <div className="overflow-x-auto custom-scrollbar">
     <table className="w-full text-left min-w-[800px]">
      <thead>
       <tr className="bg-white dark:bg-slate-800 border-b border-slate-300 dark:border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-500 ">
        <th className="px-6 py-4">{t('date')}</th>
        <th className="px-6 py-4">{t('category')}</th>
        <th className="px-6 py-4">{t('description')}</th>
        <th className="px-6 py-4">{t('amount')}</th>
        <th className="px-6 py-4 text-right">Actions</th>
       </tr>
      </thead>
      <tbody className="divide-y divide-slate-800/50">
       {loading ? (
        <tr>
         <td colSpan="5" className="px-6 py-12 text-center">
          <Loader2 className="animate-spin inline-block text-blue-600 dark:text-blue-400 mb-2" size={32} />
          <p className="text-slate-500 text-sm">{t('loadingExpenses')}</p>
         </td>
        </tr>
       ) : expenses.filter(e => 
         e.description?.toLowerCase().includes(search.toLowerCase()) || 
         e.category?.toLowerCase().includes(search.toLowerCase())
        ).length === 0 ? (
        <tr>
         <td colSpan="5" className="px-6 py-12 text-center text-slate-500">{t('noExpensesFound')}</td>
        </tr>
       ) : (
        expenses.filter(e => 
         e.description?.toLowerCase().includes(search.toLowerCase()) || 
         e.category?.toLowerCase().includes(search.toLowerCase())
        ).map((expense) => (
         <tr key={expense.id} className="hover:bg-slate-100 dark:bg-slate-800/50 transition-colors group">
          <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
           {new Date(expense.expense_date).toLocaleDateString()}
          </td>
          <td className="px-6 py-4">
           <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-300 dark:border-slate-700 uppercase tracking-wider">
            {t(expense.category.toLowerCase().replace(' ', '')) || expense.category}
           </span>
          </td>
          <td className="px-6 py-4 text-slate-700 dark:text-slate-200 font-medium">
           {expense.description}
          </td>
          <td className="px-6 py-4 font-bold text-rose-600 dark:text-rose-400">
           ETB {expense.amount.toLocaleString()}
          </td>
          <td className="px-6 py-4 text-right flex justify-end gap-2">
           {expense.receipt_attachment && (
            <button 
             onClick={() => {
              const url = `${API_BASE_URL}/expenses/receipts/${expense.receipt_attachment}`;
              if (expense.receipt_attachment.toLowerCase().endsWith('.pdf')) {
               window.open(url, '_blank');
              } else {
               setPreviewImage(url);
              }
             }}
             className="p-2 hover:bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl transition-colors"
             title="View Receipt"
            >
             <ImageIcon size={18} />
            </button>
           )}
           {(user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'manager') && (
            <button 
             onClick={() => handleDelete(expense.id)}
             className="p-2 hover:bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl transition-colors"
             title="Delete"
            >
             <Trash2 size={18} />
            </button>
           )}
          </td>
         </tr>
        ))
       )}
      </tbody>
     </table>
    </div>
   </div>

   {showAddModal && (
    <div className="modal-backdrop">
     <div className="modal-content max-w-2xl">
      <div className="modal-header">
       <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white er">{t('recordExpense')}</h2>
        <p className="text-xs font-bold text-slate-500 mt-1">{t('financialOpsMgmt')}</p>
       </div>
       <button onClick={() => setShowAddModal(false)} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-400 hover:text-slate-900 dark:text-white transition-colors shadow-xl border border-slate-200 dark:border-slate-300 dark:border-slate-700"><X size={24}/></button>
      </div>

      <div className="modal-body custom-scrollbar">
       <form id="expense-form" onSubmit={handleSubmit} className="space-y-8">
        <div className="p-8 bg-slate-100 dark:bg-slate-800 rounded-[2.5rem] border border-slate-200 dark:border-slate-300 dark:border-slate-700 space-y-6">
         <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
           <label className="label">{t('category')}</label>
           <select name="category" className="input-field bg-slate-900" required>
            <option value="Operational">{t('operational')}</option>
            <option value="Maintenance">{t('maintenance')}</option>
            <option value="Inventory Acquisition">{t('inventoryAcquisition')}</option>
            <option value="Utilities">{t('utilities')}</option>
            <option value="Other">{t('other')}</option>
           </select>
          </div>
          <div>
           <label className="label">{t('amount')} (ETB)</label>
           <div className="relative group">
            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-600 dark:text-blue-400 transition-colors" size={16} />
            <input type="number" name="amount" className="input-field pl-12" placeholder="0.00" required />
           </div>
          </div>
         </div>

         <div>
          <label className="label">{t('description')}</label>
          <textarea 
           name="description" 
           className="input-field h-32 resize-none custom-scrollbar" 
           placeholder={t('expenseDescriptionPlaceholder')} 
           required
          ></textarea>
         </div>

         <div>
          <label className="label">{t('receiptOptional')}</label>
          <div className="relative group">
           <input 
            type="file" 
            name="receipt" 
            id="expense-receipt"
            className="hidden" 
            accept="image/*,application/pdf" 
           />
           <label 
            htmlFor="expense-receipt"
            className="flex items-center justify-center gap-4 w-full py-8 border-2 border-dashed border-slate-300 dark:border-slate-300 dark:border-slate-700 rounded-3xl text-slate-500 hover:text-slate-900 dark:text-white hover:border-primary-500/50 transition-colors cursor-pointer bg-slate-900/20 group-hover:bg-primary-500/5"
           >
            <ImageIcon size={24} />
             <span className="text-sm font-bold ">{t('attachDigitalProof')}</span>
           </label>
          </div>
         </div>
        </div>
       </form>
      </div>

      <div className="modal-footer">
       <button type="button" onClick={() => setShowAddModal(false)} className="px-8 py-3 text-slate-500 hover:text-slate-900 dark:text-white font-bold text-xs transition-colors">{t('cancel')}</button>
       <button form="expense-form" type="submit" disabled={submitting} className="btn-primary px-12">
        {submitting ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
        {t('saveExpense')}
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

export default Expenses
