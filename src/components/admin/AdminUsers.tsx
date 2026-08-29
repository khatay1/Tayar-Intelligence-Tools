import { useLocalizer } from '@/lib/ui-localization';
import { useState, useMemo } from 'react';
import {
  Search, Users, Loader2, X, Ban, Trash2, Edit3, Mail,
  Shield, Crown, ChevronLeft, ChevronRight,
  AlertTriangle, CheckCircle,
} from 'lucide-react';
import { useAdminUsers, AdminUser } from '@/lib/admin-hooks';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';

export default function AdminUsers() {
  const l = useLocalizer();
  const { users, loading, error, refresh } = useAdminUsers();
  const { success, error: showError } = useToast();
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const pageSize = 10;

  const filtered = useMemo(() => {
    return users.filter(u => {
      const query = search.toLowerCase();
      const matchSearch = !search
        || u.full_name.toLowerCase().includes(query)
        || u.email.toLowerCase().includes(query)
        || u.id.includes(search);
      const matchPlan = planFilter === 'all' || u.plan === planFilter;
      const matchStatus = statusFilter === 'all' || (statusFilter === 'suspended' ? u.suspended : !u.suspended);
      return matchSearch && matchPlan && matchStatus;
    });
  }, [users, search, planFilter, statusFilter]);

  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  async function toggleSuspend(user: AdminUser) {
    if (currentUser?.id === user.id) {
      showError('You cannot suspend your own administrator account.');
      return;
    }
    setActionLoading(true);
    const { error: actionError } = await supabase.rpc('admin_update_user', {
      p_user_id: user.id,
      p_full_name: user.full_name,
      p_role: user.role,
      p_suspended: !user.suspended,
    });
    if (actionError) showError(actionError.message || 'Failed to update user');
    else { success(user.suspended ? 'User reinstated' : 'User suspended'); void refresh(); }
    setActionLoading(false);
  }

  async function deleteUser(user: AdminUser) {
    if (currentUser?.id === user.id) {
      showError('You cannot delete your own administrator account.');
      return;
    }
    setActionLoading(true);
    const { error: actionError } = await supabase.rpc('admin_delete_user', { p_user_id: user.id });
    if (actionError) showError(actionError.message || 'Failed to delete user');
    else { success('User account deleted'); void refresh(); setConfirmDelete(null); }
    setActionLoading(false);
  }

  async function saveEdit(updated: AdminUser) {
    setActionLoading(true);
    const { error: actionError } = await supabase.rpc('admin_update_user', {
      p_user_id: updated.id,
      p_full_name: updated.full_name,
      p_role: updated.role,
      p_suspended: updated.suspended,
    });
    if (actionError) showError(actionError.message || 'Failed to save changes');
    else { success('User updated'); void refresh(); setEditUser(null); }
    setActionLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
        <h2 className="text-white font-semibold mb-2">{l('Could not load users')}</h2>
        <p className="text-sm text-gray-400 mb-4">{error}</p>
        <button onClick={() => void refresh()} className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium">{l('Retry')}</button>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Users', value: users.length, icon: Users, color: 'violet' },
          { label: 'Admins', value: users.filter(u => u.role === 'admin').length, icon: Shield, color: 'amber' },
          { label: 'Pro Users', value: users.filter(u => u.plan === 'pro').length, icon: Crown, color: 'fuchsia' },
          { label: 'Suspended', value: users.filter(u => u.suspended).length, icon: Ban, color: 'red' },
        ].map(s => {
          const Icon = s.icon;
          const colors: Record<string, string> = {
            violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
            amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
            fuchsia: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20',
            red: 'bg-red-500/10 text-red-400 border-red-500/20',
          };
          return (
            <div key={s.label} className={`rounded-xl border p-3 flex items-center gap-3 ${colors[s.color]}`}>
              <Icon className="w-5 h-5" />
              <div>
                <div className="text-xl font-bold text-white">{s.value}</div>
                <div className="text-xs text-gray-400">{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search by name, email or ID..."
            className="flex-1 bg-transparent text-sm text-white placeholder:text-gray-500 focus:outline-none"
          />
        </div>
        <select
          value={planFilter}
          onChange={e => { setPlanFilter(e.target.value); setPage(0); }}
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
        >
          <option value="all" className="bg-[#12122a]">{l('All Plans')}</option>
          <option value="free" className="bg-[#12122a]">{l('Free')}</option>
          <option value="pro" className="bg-[#12122a]">{l('Pro')}</option>
          <option value="business" className="bg-[#12122a]">{l('Business')}</option>
        </select>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
        >
          <option value="all" className="bg-[#12122a]">{l('All Status')}</option>
          <option value="active" className="bg-[#12122a]">{l('Active')}</option>
          <option value="suspended" className="bg-[#12122a]">{l('Suspended')}</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">{l('User')}</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">{l('Plan')}</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">{l('Documents')}</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">{l('AI Requests')}</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">{l('Status')}</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">{l('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(user => (
                <tr key={user.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                        {user.full_name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white truncate flex items-center gap-1.5">
                          {user.full_name || 'Unnamed'}
                          {user.role === 'admin' && <Shield className="w-3 h-3 text-amber-400" />}
                        </div>
                        <div className="text-xs text-gray-500 truncate">{user.email || user.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      user.plan === 'pro' ? 'bg-fuchsia-500/10 text-fuchsia-400' :
                      user.plan === 'business' ? 'bg-cyan-500/10 text-cyan-400' :
                      'bg-gray-500/10 text-gray-400'
                    }`}>
                      {user.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-sm text-gray-300">{user.project_count}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-sm text-gray-300">{user.ai_request_count}</td>
                  <td className="px-4 py-3">
                    {user.suspended ? (
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 flex items-center gap-1 w-fit">
                        <Ban className="w-3 h-3" /> Suspended
                      </span>
                    ) : (
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center gap-1 w-fit">
                        <CheckCircle className="w-3 h-3" /> Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setEditUser(user)} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors" title="Edit">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => toggleSuspend(user)} disabled={actionLoading || currentUser?.id === user.id} className="p-1.5 rounded-lg text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title={currentUser?.id === user.id ? 'You cannot suspend yourself' : user.suspended ? 'Reinstate' : 'Suspend'}>
                        <Ban className="w-4 h-4" />
                      </button>
                      <button onClick={() => setConfirmDelete(user)} disabled={currentUser?.id === user.id} className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title={currentUser?.id === user.id ? 'You cannot delete yourself' : 'Delete'}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="py-12 text-center text-gray-500 text-sm">{l('No users found')}</div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
            <span className="text-xs text-gray-500">
              {page * pageSize + 1}-{Math.min((page + 1) * pageSize, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-gray-400">{page + 1} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editUser && (
        <EditUserModal user={editUser} isSelf={currentUser?.id === editUser.id} onSave={saveEdit} onClose={() => setEditUser(null)} loading={actionLoading} />
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <ConfirmModal
          title="Delete User"
          message={`Are you sure you want to delete "${confirmDelete.full_name || 'this user'}"? This will permanently remove their profile and all associated data. This action cannot be undone.`}
          confirmLabel="Delete Permanently"
          danger
          loading={actionLoading}
          onConfirm={() => deleteUser(confirmDelete)}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

function EditUserModal({ user, isSelf, onSave, onClose, loading }: {
  user: AdminUser;
  isSelf: boolean;
  onSave: (u: AdminUser) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const l = useLocalizer();
  const [fullName, setFullName] = useState(user.full_name);
  const [role, setRole] = useState(user.role);

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#12122a] border border-white/10 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()} style={{ animation: 'fadeInUp 0.2s ease-out' }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold">{l('Edit User')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">{l('Full Name')}</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/40" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">{l('Subscription Plan')}</label>
            <div className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-300 flex items-center justify-between">
              <span className="capitalize">{user.plan}</span>
              <span className="text-[10px] text-gray-500">{l('Managed by Billing')}</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">{l('Role')}</label>
            <select value={role} disabled={isSelf} onChange={e => setRole(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed">
              <option value="user" className="bg-[#12122a]">{l('User')}</option>
              <option value="admin" className="bg-[#12122a]">{l('Admin')}</option>
            </select>
          </div>
          <div className="text-xs text-gray-500 bg-white/[0.02] rounded-lg p-3 border border-white/5">
            <div className="flex items-center gap-1.5 mb-1">
              <Mail className="w-3 h-3" />
              <span className="font-mono">{user.id.slice(0, 12)}...</span>
            </div>
            <div>Documents: {user.project_count} | AI Requests: {user.ai_request_count}</div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white border border-white/10 hover:bg-white/5 transition-colors">{l('Cancel')}</button>
          <button onClick={() => onSave({ ...user, full_name: fullName, role })} disabled={loading} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 transition-colors">
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ title, message, confirmLabel, danger, loading, onConfirm, onClose }: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  loading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const l = useLocalizer();
  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#12122a] border border-white/10 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()} style={{ animation: 'fadeInUp 0.2s ease-out' }}>
        <div className="flex items-start gap-3 mb-4">
          {danger && <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0"><AlertTriangle className="w-5 h-5 text-red-400" /></div>}
          <div>
            <h3 className="text-white font-semibold">{title}</h3>
            <p className="text-sm text-gray-400 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white border border-white/10 hover:bg-white/5 transition-colors">{l('Cancel')}</button>
          <button onClick={onConfirm} disabled={loading} className={`flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50 transition-colors ${danger ? 'bg-red-600 hover:bg-red-500' : 'bg-violet-600 hover:bg-violet-500'}`}>
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
