import React, { useState, useEffect } from 'react'
import {
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  Download,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Filter
} from 'lucide-react'
import api from '../services/api'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { exportReportsToExcel } from '../services/ExportService'
import { useLanguage } from '../i18n/LanguageContext'

const COLORS = ['#0ea5e9', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6', '#f97316', '#84cc16'];

const Reports = ({ user }) => {
  const { t } = useLanguage()
  const [data, setData] = useState(null)
  const [profit, setProfit] = useState(null)
  const [payments, setPayments] = useState([])
  const [branchComparison, setBranchComparison] = useState([])
  const [inventoryDist, setInventoryDist] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchReportData()
  }, [])

  const fetchReportData = async () => {
    try {
      const branchId = user?.role?.toLowerCase() === 'admin' ? '' : (user?.branch_id || '')
      const [statsRes, profitRes, paymentsRes, branchRes, invDistRes] = await Promise.all([
        api.get(`/reports/dashboard?branch_id=${branchId}`),
        api.get(`/reports/profit-analysis?branch_id=${branchId}`),
        api.get(`/reports/payments?branch_id=${branchId}`),
        api.get('/reports/branch-comparison'),
        api.get('/reports/inventory-distribution'),
      ])
      setData(statsRes.data)
      setProfit(profitRes.data)
      setPayments(paymentsRes.data)
      setBranchComparison(branchRes.data)
      setInventoryDist(invDistRes.data)
    } catch (error) {
      console.error('Failed to fetch report data')
    } finally {
      setLoading(false)
    }
  }

  const branchData = branchComparison.map(b => ({
    name: b.name,
    value: b.revenue,
  }))

  const vehicleTypeData = (inventoryDist?.vehicle_types || []).map(i => ({
    name: i.name.toUpperCase(),
    value: i.count,
  }))

  const partCategoryData = (inventoryDist?.part_categories || []).map(i => ({
    name: i.name,
    value: i.count,
  }))

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={40} />
        <p className="text-slate-500 font-medium animate-pulse">Generating analytical insights...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{t('reportsTitle')}</h1>
          <p className="text-slate-400 mt-1 font-medium">{t('reportsDesc')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-800 transition-colors flex items-center gap-2">
            <Calendar size={18} />
            {t('thisMonth')}
          </button>
          <button
            onClick={() => exportReportsToExcel(payments, data, profit, t)}
            className="btn-primary flex items-center gap-2"
          >
            <Download size={18} />
            {t('exportFullAudit')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Branch Comparison */}
        <div className="lg:col-span-2 glass-card p-6 md:p-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('branchRevenueComparison')}</h3>
            <BarChart3 className="text-blue-600 dark:text-blue-400" size={20} />
          </div>
          <div className="h-[300px]">
            {branchData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500">No branch data available</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={branchData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="name" stroke="#475569" fontSize={12} axisLine={false} tickLine={false} />
                  <YAxis stroke="#475569" fontSize={12} axisLine={false} tickLine={false} tickFormatter={(val) => `ETB ${val/1000000}M`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Bar dataKey="value" fill="#0ea5e9" radius={[6, 6, 0, 0]} barSize={60} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Vehicle Type Distribution */}
        <div className="glass-card p-6 md:p-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('productDistribution')}</h3>
            <PieChartIcon className="text-blue-600 dark:text-blue-400" size={20} />
          </div>
          <div className="h-[300px]">
            {vehicleTypeData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500">No vehicle data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={vehicleTypeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {vehicleTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-4 space-y-2">
            {vehicleTypeData.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index] }}></div>
                  <span className="text-slate-400">{item.name}</span>
                </div>
                <span className="text-slate-900 dark:text-white font-bold">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Spare Parts Distribution */}
      {partCategoryData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="glass-card p-6 md:p-8">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Spare Parts by Category</h3>
              <PieChartIcon className="text-blue-600 dark:text-blue-400" size={20} />
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={partCategoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {partCategoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {partCategoryData.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[(index + 3) % COLORS.length] }}></div>
                    <span className="text-slate-400">{item.name}</span>
                  </div>
                  <span className="text-slate-900 dark:text-white font-bold">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Branch Stats Summary */}
          <div className="glass-card p-6 md:p-8">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('branchRevenueComparison')}</h3>
              <BarChart3 className="text-blue-600 dark:text-blue-400" size={20} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-3 px-2 text-slate-500 font-semibold text-xs uppercase tracking-wider">{t('branch')}</th>
                    <th className="text-right py-3 px-2 text-slate-500 font-semibold text-xs uppercase tracking-wider">{t('totalRevenue')}</th>
                    <th className="text-right py-3 px-2 text-slate-500 font-semibold text-xs uppercase tracking-wider">{t('sales')}</th>
                    <th className="text-right py-3 px-2 text-slate-500 font-semibold text-xs uppercase tracking-wider">{t('vehicles')}</th>
                    <th className="text-right py-3 px-2 text-slate-500 font-semibold text-xs uppercase tracking-wider">{t('spareParts')}</th>
                  </tr>
                </thead>
                <tbody>
                  {branchComparison.map((b, i) => (
                    <tr key={b.id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-3 px-2 text-slate-900 dark:text-white font-medium">{b.name}</td>
                      <td className="py-3 px-2 text-right text-slate-900 dark:text-white font-semibold">ETB {b.revenue.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right text-slate-500">{b.sales_count}</td>
                      <td className="py-3 px-2 text-right text-slate-500">{b.vehicle_count}</td>
                      <td className="py-3 px-2 text-right text-slate-500">{b.spare_part_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-card p-6 group hover:border-emerald-500/30 transition-colors">
          <p className="text-xs font-bold text-slate-500 ">{t('netProfitMargin')}</p>
          <div className="flex items-end justify-between mt-2">
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{profit?.margin || 0}%</p>
            <div className={`flex items-center gap-1 text-xs font-bold ${profit?.margin > 20 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {profit?.margin > 20 ? <ArrowUpRight size={16} /> : <TrendingUp size={16} />}
              {profit?.margin > 20 ? t('strong') : t('stable')}
            </div>
          </div>
        </div>
        <div className="glass-card p-6 group hover:border-primary-500/30 transition-colors">
          <p className="text-xs font-bold text-slate-500 ">{t('totalRevenue')}</p>
          <div className="flex items-end justify-between mt-2">
            <p className="text-3xl font-bold text-slate-900 dark:text-white">ETB {(profit?.revenue / 1000).toFixed(0)}k</p>
            <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 text-xs font-bold">
              <TrendingUp size={16} />
              {t('live')}
            </div>
          </div>
        </div>
        <div className="glass-card p-6 group hover:border-amber-500/30 transition-colors">
          <p className="text-xs font-bold text-slate-500 ">{t('grossProfit')}</p>
          <div className="flex items-end justify-between mt-2">
            <p className="text-3xl font-bold text-slate-900 dark:text-white">ETB {(profit?.gross_profit / 1000).toFixed(0)}k</p>
            <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs font-bold">
              <Filter size={16} />
              {t('beforeExp')}
            </div>
          </div>
        </div>
        <div className="glass-card p-6 group hover:border-rose-500/30 transition-colors">
          <p className="text-xs font-bold text-slate-500 ">{t('operationalExpenses')}</p>
          <div className="flex items-end justify-between mt-2">
            <p className="text-3xl font-bold text-slate-900 dark:text-white">ETB {(profit?.expenses / 1000).toFixed(0)}k</p>
            <div className="flex items-center gap-1 text-rose-600 dark:text-rose-400 text-xs font-bold">
              <ArrowDownRight size={16} />
              {t('burnRate')}
            </div>
          </div>
        </div>
      </div>

      {/* Payment Details Table */}
      <div className="glass-card p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Payment Details</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left py-3 px-2 text-slate-500 font-semibold text-xs uppercase tracking-wider">Customer Name</th>
                <th className="text-left py-3 px-2 text-slate-500 font-semibold text-xs uppercase tracking-wider">Payment Date</th>
                <th className="text-right py-3 px-2 text-slate-500 font-semibold text-xs uppercase tracking-wider">Amount (ETB)</th>
                <th className="text-left py-3 px-2 text-slate-500 font-semibold text-xs uppercase tracking-wider">Bank Name</th>
                <th className="text-left py-3 px-2 text-slate-500 font-semibold text-xs uppercase tracking-wider">Account Holder</th>
                <th className="text-left py-3 px-2 text-slate-500 font-semibold text-xs uppercase tracking-wider">Transaction Ref</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">No payments recorded yet.</td>
                </tr>
              ) : (
                payments.map((p, i) => (
                  <tr key={i} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-2 text-slate-900 dark:text-white font-medium">{p.customer_name}</td>
                    <td className="py-3 px-2 text-slate-500">{new Date(p.payment_date).toLocaleDateString()}</td>
                    <td className="py-3 px-2 text-right text-slate-900 dark:text-white font-semibold">{p.amount.toLocaleString()}</td>
                    <td className="py-3 px-2 text-slate-500 uppercase">{(p.bank_name || '—').toUpperCase()}</td>
                    <td className="py-3 px-2 text-slate-500 uppercase">{(p.account_holder || '—').toUpperCase()}</td>
                    <td className="py-3 px-2 text-slate-500 font-mono text-xs uppercase">{(p.transaction_reference || '—').toUpperCase()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default Reports
