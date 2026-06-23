import React, { useState, useEffect, useRef } from 'react'
import { 
 User, 
 Shield, 
 MapPin, 
 Globe, 
 Database, 
 Download,
 Upload,
 Key,
 ChevronRight,
 Save,
 Loader2,
 Plus,
 Trash2,
 Edit3,
 X,
 Check,
 Users
} from 'lucide-react'
import { toast } from 'react-toastify'
import api from '../services/api'
import axios from 'axios'
import { useLanguage } from '../i18n/LanguageContext'
import { supportedLanguages } from '../i18n/translations'

const ROLES = ['admin', 'manager', 'cashier', 'storekeeper', 'accountant']
const BRANCHES_STATIC = [
 { id: null, name: 'All Branches' }
]

const Settings = ({ user }) => {
 const { t, lang, changeLanguage } = useLanguage()
 const [activeTab, setActiveTab] = useState('profile')
 const [saving, setSaving] = useState(false)

 // User management state
 const [users, setUsers] = useState([])
 const [loadingUsers, setLoadingUsers] = useState(false)
 const [showAddUser, setShowAddUser] = useState(false)
 const [editingUser, setEditingUser] = useState(null)
 const [newUser, setNewUser] = useState({ username: '', password: '', role: 'cashier', branch_id: null })
 
 // Branch management state
 const [branches, setBranches] = useState([])
 const [loadingBranches, setLoadingBranches] = useState(false)
 const [showAddBranch, setShowAddBranch] = useState(false)
 const [editingBranch, setEditingBranch] = useState(null)
  const [newBranch, setNewBranch] = useState({ name: '', location: '', address: '', phone: '' })
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  const [backupFile, setBackupFile] = useState(null)
  const [importing, setImporting] = useState(false)
  const backupFileRef = useRef(null)

 const isAdmin = user?.role?.toLowerCase() === 'admin'

 const sections = [
  { id: 'profile', name: t('profileSettings'), icon: User, desc: t('profileDesc') },
  { id: 'security', name: t('securityAccess'), icon: Shield, desc: t('securityDesc') },
  ...(isAdmin ? [{ id: 'users', name: t('userManagement'), icon: Users, desc: t('userManagementDesc') }] : []),
  { id: 'branches', name: t('branchManagement'), icon: MapPin, desc: t('branchDesc') },
  { id: 'language', name: t('language'), icon: Globe, desc: t('languageDesc') },
  ...(isAdmin ? [{ id: 'backup', name: 'Backup', icon: Download, desc: 'Export database backup' }] : []),
  ...(isAdmin ? [{ id: 'database', name: 'Database', icon: Database, desc: 'Reset database to factory defaults' }] : []),
 ]

 useEffect(() => {
  if (activeTab === 'users') fetchUsers()
  if (activeTab === 'branches' || activeTab === 'users') fetchBranches()
 }, [activeTab])

 const fetchBranches = async () => {
  setLoadingBranches(true)
  try {
   const res = await api.get('/branches')
   setBranches(res.data)
  } catch {
   toast.error('Failed to fetch branches')
  } finally {
   setLoadingBranches(false)
  }
 }

 const fetchUsers = async () => {
  setLoadingUsers(true)
  try {
   const res = await api.get('/users')
   setUsers(res.data)
  } catch {
   toast.error('Failed to fetch users')
  } finally {
   setLoadingUsers(false)
  }
 }

 const handleCreateUser = async (e) => {
  e.preventDefault()
  try {
   await api.post('/users', newUser)
   toast.success(t('userCreated'))
   setShowAddUser(false)
   setNewUser({ username: '', password: '', role: 'cashier', branch_id: null })
   fetchUsers()
  } catch (err) {
   toast.error(err.response?.data?.message || 'Failed to create user')
  }
 }

 const handleUpdateUser = async (id, updates) => {
  try {
   await api.put(`/users/${id}`, updates)
   toast.success(t('userUpdated'))
   setEditingUser(null)
   fetchUsers()
  } catch {
   toast.error('Failed to update user')
  }
 }

 const handleDeleteUser = async (id) => {
  if (!window.confirm(t('confirmDelete'))) return
  try {
   await api.delete(`/users/${id}`)
   toast.success(t('userDeleted'))
   fetchUsers()
  } catch {
   toast.error('Failed to delete user')
  }
 }

  const handleSave = async () => {
   if (activeTab === 'security') {
    if (!currentPassword || !newPassword) {
     toast.error('Both current and new password are required')
     return
    }
    setChangingPassword(true)
    try {
     await api.post('/auth/change-password', { current_password: currentPassword, new_password: newPassword })
     toast.success('Password changed successfully')
     setCurrentPassword('')
     setNewPassword('')
    } catch (err) {
     toast.error(err.response?.data?.message || 'Failed to change password')
    } finally {
     setChangingPassword(false)
    }
    return
   }
   setSaving(true)
   setTimeout(() => {
    setSaving(false)
    toast.success(t('saveChanges') + ' ✓')
   }, 800)
  }

 const handleLanguageChange = (code) => {
  changeLanguage(code)
  let msg = 'Language set to English ✓'
  if (code === 'am') msg = 'ቋንቋ ወደ አማርኛ ተቀናብሯል ✓'
  if (code === 'ti') msg = 'ቁንቋ ናብ ትግርኛ ተቐይሩ ✓'
  toast.success(msg)
 }

 const handleCreateBranch = async (e) => {
  e.preventDefault()
  try {
   await api.post('/branches', newBranch)
   toast.success('Branch provisioned successfully')
   setShowAddBranch(false)
   setNewBranch({ name: '', location: '', address: '', phone: '' })
   fetchBranches()
  } catch {
   toast.error('Failed to create branch')
  }
 }

 const handleUpdateBranch = async (id, updates) => {
  try {
   await api.put(`/branches/${id}`, updates)
   toast.success('Branch updated')
   setEditingBranch(null)
   fetchBranches()
  } catch {
   toast.error('Failed to update branch')
  }
 }

 const handleDeleteBranch = async (id) => {
  if (!window.confirm('Delete this branch? All associated data might become inaccessible.')) return
  try {
   await api.delete(`/branches/${id}`)
   toast.success('Branch deleted')
   fetchBranches()
  } catch {
   toast.error('Failed to delete branch')
  }
 }

 const activeSection = sections.find(s => s.id === activeTab) || sections[0]

 return (
  <div className="space-y-8">
   <div>
    <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{t('settingsTitle')}</h1>
    <p className="text-slate-400 mt-1 font-medium">{t('settingsSubtitle')}</p>
   </div>

   <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
    {/* Nav */}
    <div className="lg:col-span-1 space-y-2">
     {sections.map((section) => (
      <button
       key={section.id}
       onClick={() => setActiveTab(section.id)}
       className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-colors group ${
        activeTab === section.id 
         ? 'bg-primary-600 text-slate-900 dark:text-white shadow-lg shadow-primary-600/20' 
         : 'bg-white dark:bg-slate-800 text-slate-400 hover:bg-slate-200 dark:bg-slate-700 hover:text-slate-900 dark:text-white border border-slate-200 dark:border-slate-300 dark:border-slate-700'
       }`}
      >
       <section.icon size={20} />
       <span className="text-sm font-bold text-left">{section.name}</span>
       <ChevronRight size={16} className={`ml-auto ${activeTab === section.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`} />
      </button>
     ))}
    </div>

    {/* Content */}
    <div className="lg:col-span-3">
     <div className="glass-card p-8 md:p-10 min-h-[520px] flex flex-col">
      <div className="flex items-center justify-between mb-8">
       <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{activeSection.name}</h2>
        <p className="text-sm text-slate-400 mt-1">{activeSection.desc}</p>
       </div>
        {activeTab !== 'users' && activeTab !== 'language' && (
         <button 
          onClick={handleSave}
          disabled={saving || changingPassword}
          className="btn-primary flex items-center gap-2 px-6"
         >
          {(saving || changingPassword) ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {t('saveChanges')}
         </button>
        )}
      </div>

      {/* ── Profile Tab ── */}
      {activeTab === 'profile' && (
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
         <label className="block text-xs font-bold text-slate-500 mb-2">{t('displayName')}</label>
         <input type="text" className="input-field" defaultValue={user?.username} />
        </div>
        <div>
         <label className="block text-xs font-bold text-slate-500 mb-2">{t('rolePermissions')}</label>
         <input type="text" className="input-field bg-white dark:bg-slate-800 cursor-not-allowed" value={user?.role?.toUpperCase()} disabled />
        </div>
        <div>
         <label className="block text-xs font-bold text-slate-500 mb-2">{t('assignedBranch')}</label>
         <input type="text" className="input-field bg-white dark:bg-slate-800 cursor-not-allowed" value={user?.branch_name || t('allBranches')} disabled />
        </div>
       </div>
      )}

       {/* ── Security Tab ── */}
      {activeTab === 'security' && (
       <div className="space-y-5 max-w-md">
        <div>
         <label className="block text-xs font-bold text-slate-500 mb-2">{t('currentPassword')}</label>
         <div className="relative">
          <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input type="password" className="input-field pl-10" placeholder="••••••••" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
         </div>
        </div>
        <div>
         <label className="block text-xs font-bold text-slate-500 mb-2">{t('newPassword')}</label>
         <div className="relative">
          <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input type="password" className="input-field pl-10" placeholder="••••••••" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
         </div>
        </div>
        <div className="pt-4 p-4 rounded-xl bg-primary-500/5 border border-blue-100 dark:border-blue-800 flex gap-4">
         <Shield className="text-blue-600 dark:text-blue-400 flex-shrink-0" size={24} />
         <div>
          <p className="text-sm font-bold text-slate-900 dark:text-white">Two-Factor Authentication</p>
          <p className="text-xs text-slate-500 mt-1">Enable 2FA to add an extra security layer to your account.</p>
          <button className="mt-3 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-primary-300 ">Enable Now</button>
         </div>
        </div>
       </div>
      )}

      {/* ── User Management Tab ── */}
      {activeTab === 'users' && (
       <div className="space-y-4 flex-1">
        <div className="flex justify-end">
          <button
           onClick={() => {
             setNewUser({ username: '', password: '', role: 'cashier', branch_id: null });
             setShowAddUser(true);
           }}
           className="btn-primary flex items-center gap-2 text-sm"
         >
          <Plus size={18} />
          {t('addUser')}
         </button>
        </div>

        {/* Add User Form */}
        {showAddUser && (
         <form onSubmit={handleCreateUser} className="p-5 rounded-2xl bg-primary-500/5 border border-blue-200 dark:border-blue-800 space-y-4">
          <h3 className="text-sm font-bold text-blue-600 dark:text-blue-400 ">New Staff Account</h3>
          <div className="grid grid-cols-2 gap-4">
           <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">{t('username')}</label>
            <input
             type="text" className="input-field py-2 text-sm" required
             value={newUser.username}
             onChange={e => setNewUser({ ...newUser, username: e.target.value })}
             placeholder="e.g. john_cashier"
            />
           </div>
           <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">{t('password')}</label>
            <input
             type="password" className="input-field py-2 text-sm" required
             value={newUser.password}
             onChange={e => setNewUser({ ...newUser, password: e.target.value })}
             placeholder="••••••••"
            />
           </div>
           <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">{t('role')}</label>
            <select className="input-field py-2 text-sm bg-slate-900" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
             {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
           </div>
           <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">{t('branch')}</label>
            <select className="input-field py-2 text-sm bg-slate-900" value={newUser.branch_id ?? ''} onChange={e => setNewUser({ ...newUser, branch_id: e.target.value ? parseInt(e.target.value) : null })}>
             <option value="">{t('allBranches')}</option>
             {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
           </div>
          </div>
          <div className="flex gap-3 justify-end">
           <button type="button" onClick={() => { setNewUser({ username: '', password: '', role: 'cashier', branch_id: null }); setShowAddUser(false); }} className="text-sm text-slate-400 hover:text-slate-900 dark:text-white px-4 py-2">{t('cancel')}</button>
           <button type="submit" className="btn-primary text-sm px-5 py-2 flex items-center gap-2"><Check size={16} /> {t('createAccount')}</button>
          </div>
         </form>
        )}

        {/* User Table */}
        {loadingUsers ? (
         <div className="flex justify-center py-12"><Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={32} /></div>
        ) : (
         <div className="overflow-x-auto rounded-2xl border border-slate-300 dark:border-slate-300 dark:border-slate-700">
          <table className="w-full text-left min-w-[640px]">
           <thead>
            <tr className="bg-slate-900/80 text-xs font-bold text-slate-500 border-b border-slate-300 dark:border-slate-300 dark:border-slate-700">
             <th className="px-5 py-3">{t('username')}</th>
             <th className="px-5 py-3">{t('role')}</th>
             <th className="px-5 py-3">{t('branch')}</th>
             <th className="px-5 py-3">{t('status')}</th>
             <th className="px-5 py-3 text-right">{t('actions')}</th>
            </tr>
           </thead>
           <tbody className="divide-y divide-slate-800/50">
            {users.map(u => (
             <tr key={u.id} className="hover:bg-slate-100 dark:bg-slate-800/50 transition-colors group">
              {editingUser?.id === u.id ? (
               <>
                <td className="px-5 py-3 text-slate-900 dark:text-white font-bold">{u.username}</td>
                <td className="px-5 py-3">
                 <select className="input-field py-1 text-xs bg-slate-900" value={editingUser.role} onChange={e => setEditingUser({ ...editingUser, role: e.target.value })}>
                  {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                 </select>
                </td>
                <td className="px-5 py-3">
                 <select className="input-field py-1 text-xs bg-slate-900" value={editingUser.branch_id ?? ''} onChange={e => setEditingUser({ ...editingUser, branch_id: e.target.value ? parseInt(e.target.value) : null })}>
                  <option value="">{t('allBranches')}</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                 </select>
                </td>
                <td className="px-5 py-3">
                 <select className="input-field py-1 text-xs bg-slate-900" value={editingUser.status} onChange={e => setEditingUser({ ...editingUser, status: e.target.value })}>
                  <option value="active">{t('active')}</option>
                  <option value="inactive">{t('inactive')}</option>
                 </select>
                </td>
                <td className="px-5 py-3 text-right">
                 <div className="flex items-center justify-end gap-2">
                  <button onClick={() => handleUpdateUser(u.id, editingUser)} className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:bg-emerald-900/50 rounded-lg transition-colors"><Check size={16} /></button>
                  <button onClick={() => setEditingUser(null)} className="p-2 bg-slate-800 text-slate-400 hover:text-slate-900 dark:text-white rounded-lg transition-colors"><X size={16} /></button>
                 </div>
                </td>
               </>
              ) : (
               <>
                <td className="px-5 py-3">
                 <p className="text-slate-900 dark:text-white font-bold">{u.username}</p>
                 <p className="text-xs text-slate-500 mt-0.5">ID #{u.id}</p>
                </td>
                <td className="px-5 py-3">
                 <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase border ${
                  u.role === 'admin' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800' :
                  u.role === 'manager' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                  u.role === 'cashier' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' :
                  'bg-slate-800 text-slate-400 border-slate-300 dark:border-slate-700'
                 }`}>{u.role}</span>
                </td>
                <td className="px-5 py-3 text-sm text-slate-400">{u.branch_name}</td>
                <td className="px-5 py-3">
                 <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase border ${
                  u.status === 'active' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                 }`}>{u.status}</span>
                </td>
                <td className="px-5 py-3 text-right">
                 <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setEditingUser({ ...u })} className="p-2 bg-slate-800 text-slate-400 hover:text-slate-900 dark:text-white rounded-lg transition-colors" title="Edit"><Edit3 size={16} /></button>
                  {u.id !== user?.id && (
                   <button onClick={() => handleDeleteUser(u.id)} className="p-2 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-200 dark:bg-rose-900/50 rounded-lg transition-colors" title="Delete"><Trash2 size={16} /></button>
                  )}
                 </div>
                </td>
               </>
              )}
             </tr>
            ))}
           </tbody>
          </table>
         </div>
        )}
       </div>
      )}

      {/* ── Branch Tab ── */}
      {activeTab === 'branches' && (
       <div className="space-y-4 flex-1">
        {isAdmin && (
        <div className="flex justify-end">
          <button onClick={() => setShowAddBranch(true)} className="btn-primary flex items-center gap-2 text-sm">
           <Plus size={18} /> {t('provisionNewBranch')}
          </button>
        </div>
        )}

        {isAdmin && showAddBranch && (
          <form onSubmit={handleCreateBranch} className="p-6 rounded-2xl bg-primary-500/5 border border-blue-200 dark:border-blue-800 space-y-4">
           <div className="grid grid-cols-2 gap-4">
             <div><label className="label">Branch Name</label><input required className="input-field" value={newBranch.name} onChange={e=>setNewBranch({...newBranch, name: e.target.value})}/></div>
             <div><label className="label">Location</label><input className="input-field" value={newBranch.location} onChange={e=>setNewBranch({...newBranch, location: e.target.value})}/></div>
             <div><label className="label">Address</label><input className="input-field" value={newBranch.address} onChange={e=>setNewBranch({...newBranch, address: e.target.value})}/></div>
             <div><label className="label">Phone</label><input className="input-field" value={newBranch.phone} onChange={e=>setNewBranch({...newBranch, phone: e.target.value})}/></div>
           </div>
           <div className="flex justify-end gap-3 mt-4">
             <button type="button" onClick={()=>setShowAddBranch(false)} className="text-sm text-slate-400">{t('cancel')}</button>
             <button type="submit" className="btn-primary text-sm px-6">{t('createBranch')}</button>
           </div>
          </form>
        )}

        {loadingBranches ? (
         <div className="flex justify-center py-12"><Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={32} /></div>
        ) : (
         <div className="grid grid-cols-1 gap-4">
          {branches.map(branch => (
           <div key={branch.id} className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-300 dark:border-slate-700 flex items-center justify-between hover:bg-slate-200 dark:bg-slate-700 transition-colors group">
            {isAdmin && editingBranch?.id === branch.id ? (
              <div className="flex-1 grid grid-cols-4 gap-3">
               <input className="input-field py-1 text-xs" value={editingBranch.name} onChange={e=>setEditingBranch({...editingBranch, name: e.target.value})}/>
               <input className="input-field py-1 text-xs" value={editingBranch.location} onChange={e=>setEditingBranch({...editingBranch, location: e.target.value})}/>
               <input className="input-field py-1 text-xs" value={editingBranch.phone} onChange={e=>setEditingBranch({...editingBranch, phone: e.target.value})}/>
               <div className="flex items-center gap-2">
                 <button onClick={()=>handleUpdateBranch(branch.id, editingBranch)} className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg"><Check size={14}/></button>
                 <button onClick={()=>setEditingBranch(null)} className="p-2 bg-slate-800 text-slate-400 rounded-lg"><X size={14}/></button>
               </div>
              </div>
            ) : (
             <>
              <div className="flex items-center gap-4">
               <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <MapPin size={22} />
               </div>
               <div>
                <p className="text-slate-900 dark:text-white font-bold">{branch.name}</p>
                <p className="text-xs text-slate-500">{branch.location} • {branch.phone}</p>
               </div>
              </div>
              {isAdmin ? (
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-colors">
               <button onClick={()=>setEditingBranch({...branch})} className="p-2 text-slate-400 hover:text-slate-900 dark:text-white"><Edit3 size={18}/></button>
               <button onClick={()=>handleDeleteBranch(branch.id)} className="p-2 text-rose-600 dark:text-rose-400 hover:text-rose-300"><Trash2 size={18}/></button>
              </div>
              ) : null}
             </>
            )}
           </div>
          ))}
         </div>
        )}
       </div>
      )}

      {/* ── Backup Tab ── */}
      {activeTab === 'backup' && (
       <div className="space-y-6">
        <div className="p-6 rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10">
         <div className="flex items-start gap-4">
          <Download className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" size={24} />
          <div>
           <h3 className="text-lg font-bold text-blue-600 dark:text-blue-400">Export Database Backup</h3>
           <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Download a JSON file containing all your data — branches, customers, users, vehicles, spare parts,
            sales, payments, orders, purchases, expenses, and activity logs. This does not affect your live data.
           </p>
          </div>
         </div>
         <div className="mt-6 flex items-center gap-4">
          <button
           onClick={async () => {
            try {
             const res = await api.get('/backup/export', { responseType: 'blob' })
             const blob = new Blob([res.data], { type: 'application/json' })
             const url = URL.createObjectURL(blob)
             const a = document.createElement('a')
             a.href = url
             const ts = new Date().toISOString().replace(/[:.]/g, '-')
             a.download = `legasona-backup-${ts}.json`
             document.body.appendChild(a)
             a.click()
             document.body.removeChild(a)
             URL.revokeObjectURL(url)
             toast.success('Backup downloaded successfully')
            } catch (err) {
             toast.error(err.response?.data?.message || 'Backup failed')
            }
           }}
           className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-colors flex items-center gap-2"
          >
           <Download size={18} />
           Download Backup
          </button>
         </div>
        </div>

        <div className="p-6 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10">
         <div className="flex items-start gap-4">
          <Upload className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" size={24} />
          <div>
           <h3 className="text-lg font-bold text-amber-600 dark:text-amber-400">Import Backup</h3>
           <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Restore data from a previously exported backup file. This will replace all current data
            with the backup contents. This action cannot be undone.
           </p>
          </div>
         </div>
         <div className="mt-6 space-y-4">
          <input
           ref={backupFileRef}
           type="file"
           accept=".json,application/json"
           onChange={e => setBackupFile(e.target.files[0])}
           className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-amber-100 dark:file:bg-amber-900/30 file:text-amber-600 dark:file:text-amber-400 hover:file:bg-amber-200 dark:hover:file:bg-amber-900/50 cursor-pointer"
          />
          <button
           disabled={!backupFile || importing}
           onClick={async () => {
            if (!window.confirm('This will REPLACE ALL current data with the backup. Continue?')) return
            if (!window.confirm('FINAL WARNING: All existing records will be deleted before restoring. Proceed?')) return
            setImporting(true)
            try {
             const fd = new FormData()
             fd.append('file', backupFile)
             await api.post('/backup/import', fd)
             toast.success('Backup restored successfully!')
             setBackupFile(null)
             if (backupFileRef.current) backupFileRef.current.value = ''
            } catch (err) {
             toast.error(err.response?.data?.message || 'Import failed')
            } finally {
             setImporting(false)
            }
           }}
           className="px-6 py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-colors flex items-center gap-2"
          >
           {importing ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
           {importing ? 'Restoring...' : 'Restore Backup'}
          </button>
         </div>
        </div>
       </div>
      )}

      {/* ── Database Tab ── */}
      {activeTab === 'database' && (
       <div className="space-y-6">
        <div className="p-6 rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10">
         <div className="flex items-start gap-4">
          <Database className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={24} />
          <div>
           <h3 className="text-lg font-bold text-red-600 dark:text-red-400">Reset Database</h3>
           <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            This will permanently delete all data including users, vehicles, spare parts, sales, expenses, and all other records. Only the default admin account will be preserved with sample data restored.
           </p>
          </div>
         </div>
         <div className="mt-6 flex items-center gap-4">
          <button
           onClick={async () => {
            if (!window.confirm('ARE YOU SURE? This will permanently delete ALL data in the database. Only the default admin user will remain. This action CANNOT be undone.')) return
            if (!window.confirm('FINAL WARNING: All sales records, inventory, customers, and transactions will be lost. Continue?')) return
            try {
             await api.post('/reset-database')
             toast.success('Database reset successfully! Redirecting to login...')
             setTimeout(() => window.location.reload(), 1500)
            } catch (err) {
             toast.error(err.response?.data?.message || 'Reset failed')
            }
           }}
           className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl transition-colors flex items-center gap-2"
          >
           <Trash2 size={18} />
           Reset Database Now
          </button>
         </div>
        </div>
       </div>
      )}

      {/* ── Language Tab ── */}
      {activeTab === 'language' && (
       <div className="space-y-4">
        <p className="text-sm text-slate-400">Select your preferred display language. Changes apply immediately across the entire application.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
         {supportedLanguages.map((l) => (
          <button
           key={l.code}
           onClick={() => handleLanguageChange(l.code)}
           className={`p-5 rounded-2xl border-2 text-left transition-colors duration-200 ${
            lang === l.code
             ? 'border-primary-500 bg-blue-100 dark:bg-blue-900/30 shadow-lg shadow-primary-500/10'
             : 'border-slate-300 dark:border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-600'
           }`}
          >
           <div className="flex items-center justify-between mb-3">
            <span className="text-3xl">
              {l.code === 'en' ? '🇬🇧' : l.code === 'ti' ? '🔴' : '🇪🇹'}
            </span>
            {lang === l.code && <div className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center"><Check size={14} className="text-slate-900 dark:text-white" /></div>}
           </div>
           <p className="text-slate-900 dark:text-white font-bold">{l.nativeName}</p>
           <p className="text-xs text-slate-500 mt-1">{l.name}</p>
          </button>
         ))}
        </div>
        {lang === 'am' && (
         <div className="mt-6 p-4 rounded-xl bg-emerald-500/5 border border-emerald-200 dark:border-emerald-800">
          <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">✓ ቋንቋ ወደ አማርኛ ተቀናብሯል — ሁሉም ሳጥኖች በአማርኛ ይታያሉ።</p>
         </div>
        )}
       </div>
      )}
     </div>
    </div>
   </div>
  </div>
 )
}

export default Settings
