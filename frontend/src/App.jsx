import React, { useState, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { LanguageProvider } from './i18n/LanguageContext'
import { Loader2 } from 'lucide-react'

const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Inventory = lazy(() => import('./pages/Inventory'))
const Sales = lazy(() => import('./pages/Sales'))
const Orders = lazy(() => import('./pages/Orders'))
const Transfers = lazy(() => import('./pages/Transfers'))
const Expenses = lazy(() => import('./pages/Expenses'))
const Reports = lazy(() => import('./pages/Reports'))
const Settings = lazy(() => import('./pages/Settings'))
const Purchases = lazy(() => import('./pages/Purchases'))
const Customers = lazy(() => import('./pages/Customers'))
import Layout from './components/Layout';
import api from './services/api'

// ── Defined outside App so React doesn't treat it as a new type each render ──
const ProtectedRoute = ({ user, allowedRoles, children }) => {
  if (!user) return <Navigate to="/login" />
  if (allowedRoles && !allowedRoles.includes(user.role?.toLowerCase())) {
    return <Navigate to="/" />
  }
  return children
}

function App() {
  const [user, setUser]       = useState(JSON.parse(localStorage.getItem('user')))
  const [checking, setChecking] = useState(true)

  // Validate token with backend on every app load
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      setChecking(false)
      return
    }
    api.get('/auth/me')
      .then(res => {
        // Refresh stored user data in case role/branch changed
        const fresh = res.data
        localStorage.setItem('user', JSON.stringify(fresh))
        setUser(fresh)
      })
      .catch(() => {
        // Token invalid or expired — clear session
        localStorage.removeItem('user')
        localStorage.removeItem('token')
        setUser(null)
      })
      .finally(() => setChecking(false))
  }, [])

  const login = (userData) => {
    setUser(userData)
    localStorage.setItem('user', JSON.stringify(userData))
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('user')
    localStorage.removeItem('token')
  }

  // Show nothing while we validate the token (avoids flash of login page)
  if (checking) return null

  return (
    <LanguageProvider>
      <Router>
        <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
          <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={40} /></div>}>
          <Routes>
            <Route path="/login" element={!user ? <Login onLogin={login} /> : <Navigate to="/" />} />

            <Route element={<Layout user={user} onLogout={logout} />}>
              <Route path="/" element={
                <ProtectedRoute user={user} allowedRoles={['admin', 'manager', 'cashier', 'storekeeper', 'accountant']}>
                  <Dashboard user={user} />
                </ProtectedRoute>
              } />
              <Route path="/inventory" element={
                <ProtectedRoute user={user} allowedRoles={['admin', 'manager', 'storekeeper']}>
                  <Inventory user={user} />
                </ProtectedRoute>
              } />
              <Route path="/purchases" element={
                <ProtectedRoute user={user} allowedRoles={['admin', 'manager', 'storekeeper']}>
                  <Purchases user={user} />
                </ProtectedRoute>
              } />
              <Route path="/sales" element={
                <ProtectedRoute user={user} allowedRoles={['admin', 'manager', 'cashier', 'accountant']}>
                  <Sales user={user} />
                </ProtectedRoute>
              } />
              <Route path="/orders" element={
                <ProtectedRoute user={user} allowedRoles={['admin', 'manager', 'cashier']}>
                  <Orders user={user} />
                </ProtectedRoute>
              } />
              <Route path="/transfers" element={
                <ProtectedRoute user={user} allowedRoles={['admin', 'manager', 'storekeeper']}>
                  <Transfers user={user} />
                </ProtectedRoute>
              } />
              <Route path="/expenses" element={
                <ProtectedRoute user={user} allowedRoles={['admin', 'manager', 'accountant', 'storekeeper']}>
                  <Expenses user={user} />
                </ProtectedRoute>
              } />
              <Route path="/reports" element={
                <ProtectedRoute user={user} allowedRoles={['admin', 'manager', 'accountant']}>
                  <Reports user={user} />
                </ProtectedRoute>
              } />
              <Route path="/customers" element={
                <ProtectedRoute user={user} allowedRoles={['admin', 'manager', 'cashier']}>
                  <Customers user={user} />
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute user={user} allowedRoles={['admin', 'manager']}>
                  <Settings user={user} />
                </ProtectedRoute>
              } />
            </Route>
          </Routes>
          </Suspense>
          <ToastContainer position="bottom-right" theme="dark" />
        </div>
      </Router>
    </LanguageProvider>
  )
}

export default App
