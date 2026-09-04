import { useLocalizer } from '@/lib/ui-localization';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
  const [deleteMode, setDeleteMode] = useState<'delete' | 'delete-block'>('delete');
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteBlockExpiry, setDeleteBlockExpiry] = useState('');
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
    const actionError = deleteMode === 'delete-block'
      ? (await supabase.rpc('admin_delete_user_and_block', {
          p_user_id: user.id,
          p_reason: deleteReason,
          p_expires_at: deleteBlockExpiry ? new Date(deleteBlockExpiry).toISOString() : null,
        })).error
      : (await supabase.rpc('admin_delete_user', { p_user_id: user.id })).error;

    if (actionError) {
      showError(actionError.message || 'Failed to delete user');
    } else {
      success(deleteMode === 'delete-block' ? 'User deleted and re-registration blocked' : 'User account deleted');
      void refresh();
      setConfirmDelete(null);
      setDeleteMode('delete');
      setDeleteReason('');
      setDeleteBlockExpiry('');
    }
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
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-violet-500" /></div>;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-center sm:p-6">
        <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-red-400" />
        <h2 className="mb-2 font-semibold text-white">{l('Could not load users')}</h2>
        <p className="mb-4 break-words text-sm text-gray-400">{error}</p>
        <button onClick={() => void refresh()} className="min-h-11 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500">{l('Retry')}</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl min-w-0 space-y-5 overflow-x-hidden">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
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
            <div key={l(s.label)} className={`min-w-0 rounded-xl border p-3 ${colors[s.color]}`}>
              <div className="flex items-center gap-2 sm:gap-3">
                <Icon className="h-5 w-5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-lg font-bold text-white sm:text-xl">{s.value}</div>
                  <div className="truncate text-[11px] text-gray-400 sm:text-xs">{l(s.label)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:gap-3">
        <div className="flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-gray-500" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder={l('Search by name, email or ID...')}
            className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-gray-500 focus:outline-none"
          />
        </div>
        <select value={planFilter} onChange={e => { setPlanFilter(e.target.value); setPage(0); }} className="min-h-11 w-full rounded-xl border border-white/10 bg-[#12122a] px-3 py-2 text-sm text-white focus:outline-none sm:w-auto">
          <option value="all">{l('All Plans')}</option><option value="free">{l('Free')}</option><option value="pro">{l('Pro')}</option><option value="business">{l('Business')}</option><option value="admin">{l('Admin Access')}</option>
        </select>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }} className="min-h-11 w-full rounded-xl border border-white/10 bg-[#12122a] px-3 py-2 text-sm text-white focus:outline-none sm:w-auto">
          <option value="all">{l('All Status')}</option><option value="active">{l('Active')}</option><option value="suspended">{l('Suspended')}</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
        <div className="sm:hidden divide-y divide-white/5">
          {paged.map(user => (
            <div key={user.id} className="p-4">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-700 text-sm font-bold text-white">{user.full_name?.charAt(0).toUpperCase() || 'U'}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5"><span className="truncate text-sm font-medium text-white">{user.full_name || l('Unnamed')}</span>{user.role === 'admin' && <Shield className="h-3 w-3 shrink-0 text-amber-400" />}</div>
                  <div className="mt-0.5 truncate text-xs text-gray-500">{user.email || user.id}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${user.plan === 'admin' ? 'bg-amber-500/10 text-amber-300' : user.plan === 'pro' ? 'bg-fuchsia-500/10 text-fuchsia-400' : user.plan === 'business' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-gray-500/10 text-gray-400'}`}>{user.plan === 'admin' ? l('Admin Access') : l(user.plan)}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${user.suspended ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>{user.suspended ? <Ban className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}{l(user.suspended ? 'Suspended' : 'Active')}</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-400"><div className="rounded-lg bg-white/[0.03] px-2.5 py-2">{l('Documents')}: <span className="text-white">{user.project_count}</span></div><div className="rounded-lg bg-white/[0.03] px-2.5 py-2">{l('AI Requests')}: <span className="text-white">{user.ai_request_count}</span></div></div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button onClick={() => setEditUser(user)} className="flex min-h-11 items-center justify-center rounded-xl border border-white/10 text-gray-300 hover:bg-white/5"><Edit3 className="h-4 w-4" /></button>
                <button onClick={() => toggleSuspend(user)} disabled={actionLoading || currentUser?.id === user.id} className="flex min-h-11 items-center justify-center rounded-xl border border-white/10 text-amber-400 disabled:opacity-30"><Ban className="h-4 w-4" /></button>
                <button onClick={() => setConfirmDelete(user)} disabled={currentUser?.id === user.id} className="flex min-h-11 items-center justify-center rounded-xl border border-white/10 text-red-400 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[760px]">
            <thead><tr className="border-b border-white/5"><th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{l('User')}</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{l('Plan')}</th><th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 md:table-cell">{l('Documents')}</th><th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 md:table-cell">{l('AI Requests')}</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{l('Status')}</th><th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">{l('Actions')}</th></tr></thead>
            <tbody>{paged.map(user => (
              <tr key={user.id} className="border-b border-white/5 transition-colors hover:bg-white/[0.02]">
                <td className="px-4 py-3"><div className="flex items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-700 text-sm font-bold text-white">{user.full_name?.charAt(0).toUpperCase() || 'U'}</div><div className="min-w-0"><div className="flex items-center gap-1.5 truncate text-sm font-medium text-white">{user.full_name || l('Unnamed')}{user.role === 'admin' && <Shield className="h-3 w-3 text-amber-400" />}</div><div className="max-w-[240px] truncate text-xs text-gray-500">{user.email || user.id}</div></div></div></td>
                <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${user.plan === 'admin' ? 'bg-amber-500/10 text-amber-300' : user.plan === 'pro' ? 'bg-fuchsia-500/10 text-fuchsia-400' : user.plan === 'business' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-gray-500/10 text-gray-400'}`}>{user.plan === 'admin' ? l('Admin Access') : l(user.plan)}</span></td>
                <td className="hidden px-4 py-3 text-sm text-gray-300 md:table-cell">{user.project_count}</td><td className="hidden px-4 py-3 text-sm text-gray-300 md:table-cell">{user.ai_request_count}</td>
                <td className="px-4 py-3"><span className={`flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${user.suspended ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>{user.suspended ? <Ban className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}{l(user.suspended ? 'Suspended' : 'Active')}</span></td>
                <td className="px-4 py-3"><div className="flex items-center justify-end gap-1"><button onClick={() => setEditUser(user)} className="rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white"><Edit3 className="h-4 w-4" /></button><button onClick={() => toggleSuspend(user)} disabled={actionLoading || currentUser?.id === user.id} className="rounded-lg p-2 text-gray-400 hover:bg-amber-500/10 hover:text-amber-400 disabled:opacity-30"><Ban className="h-4 w-4" /></button><button onClick={() => setConfirmDelete(user)} disabled={currentUser?.id === user.id} className="rounded-lg p-2 text-gray-400 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button></div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>

        {filtered.length === 0 && <div className="py-12 text-center text-sm text-gray-500">{l('No users found')}</div>}
        {totalPages > 1 && <div className="flex items-center justify-between border-t border-white/5 px-3 py-3 sm:px-4"><span className="text-xs text-gray-500">{page * pageSize + 1}-{Math.min((page + 1) * pageSize, filtered.length)} of {filtered.length}</span><div className="flex items-center gap-2"><button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button><span className="text-xs text-gray-400">{page + 1} / {totalPages}</span><button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button></div></div>}
      </div>

      {editUser && <EditUserModal user={editUser} isSelf={currentUser?.id === editUser.id} onSave={saveEdit} onAccessChanged={() => { void refresh(); setEditUser(null); }} onClose={() => setEditUser(null)} loading={actionLoading} />}
      {confirmDelete && <ConfirmModal title={l('Delete User')} message={`Choose whether to delete "${confirmDelete.full_name || 'this user'}" only, or also block this email from re-registering. This action permanently removes the account.`} confirmLabel={deleteMode === 'delete-block' ? l('Delete & Block') : l('Delete Permanently')} danger loading={actionLoading} onConfirm={() => deleteUser(confirmDelete)} onClose={() => { setConfirmDelete(null); setDeleteMode('delete'); setDeleteReason(''); setDeleteBlockExpiry(''); }}><div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-3"><div className="grid grid-cols-1 gap-2 xs:grid-cols-2 sm:grid-cols-2"><button type="button" onClick={() => setDeleteMode('delete')} className={`min-h-11 rounded-lg border px-3 py-2 text-xs ${deleteMode === 'delete' ? 'border-violet-500/40 bg-violet-500/10 text-violet-200' : 'border-white/10 text-gray-400'}`}>{l('Delete only')}</button><button type="button" onClick={() => setDeleteMode('delete-block')} className={`min-h-11 rounded-lg border px-3 py-2 text-xs ${deleteMode === 'delete-block' ? 'border-red-500/40 bg-red-500/10 text-red-200' : 'border-white/10 text-gray-400'}`}>{l('Delete + block')}</button></div>{deleteMode === 'delete-block' && <><input value={deleteReason} onChange={e => setDeleteReason(e.target.value)} placeholder={l('Block reason (internal note)')} className="min-h-11 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none" /><div><label className="mb-1 block text-[11px] text-gray-500">{l('Block expires (optional)')}</label><input type="datetime-local" value={deleteBlockExpiry} onChange={e => setDeleteBlockExpiry(e.target.value)} className="min-h-11 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none" /></div></>}</div></ConfirmModal>}
    </div>
  );
}

function toLocalDateTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function EditUserModal({ user, isSelf, onSave, onAccessChanged, onClose, loading }: { user: AdminUser; isSelf: boolean; onSave: (u: AdminUser) => void; onAccessChanged: () => void; onClose: () => void; loading: boolean; }) {
  const l = useLocalizer();
  const { success, error: showError } = useToast();
  const [fullName, setFullName] = useState(user.full_name);
  const [role, setRole] = useState(user.role);
  const [accessOverride, setAccessOverride] = useState<'none' | 'pro' | 'business'>('none');
  const [accessReason, setAccessReason] = useState('');
  const [accessExpiry, setAccessExpiry] = useState('');
  const [accessSaving, setAccessSaving] = useState(false);
  const [accessLoading, setAccessLoading] = useState(!isSelf && user.role !== 'admin');

  useEffect(() => {
    let active = true;
    if (isSelf || user.role === 'admin') { setAccessLoading(false); return () => { active = false; }; }
    setAccessLoading(true);
    void supabase.from('admin_access_overrides').select('plan, reason, expires_at').eq('user_id', user.id).maybeSingle().then(({ data, error }) => {
      if (!active) return;
      if (error) showError(error.message || 'Failed to load complimentary access');
      const plan = data?.plan === 'pro' || data?.plan === 'business' ? data.plan : 'none';
      setAccessOverride(plan);
      setAccessReason(data?.reason || '');
      setAccessExpiry(toLocalDateTime(data?.expires_at));
      setAccessLoading(false);
    });
    return () => { active = false; };
  }, [isSelf, showError, user.id, user.role]);

  async function saveAccessOverride() {
    setAccessSaving(true);
    const { error } = await supabase.rpc('admin_set_access_override', { p_user_id: user.id, p_plan: accessOverride === 'none' ? null : accessOverride, p_reason: accessReason, p_expires_at: accessExpiry ? new Date(accessExpiry).toISOString() : null });
    setAccessSaving(false);
    if (error) { showError(error.message || 'Failed to update complimentary access'); return; }
    success(accessOverride === 'none' ? 'Complimentary access removed' : 'Complimentary access saved');
    onAccessChanged();
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center overflow-hidden bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border border-white/10 bg-[#12122a] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-2xl sm:p-6" onClick={e => e.stopPropagation()} style={{ animation: 'fadeInUp 0.2s ease-out' }}>
        <div className="mb-5 flex items-center justify-between"><h3 className="font-semibold text-white">{l('Edit User')}</h3><button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:bg-white/5 hover:text-white"><X className="h-5 w-5" /></button></div>
        <div className="space-y-4">
          <div><label className="mb-1.5 block text-xs text-gray-400">{l('Full Name')}</label><input value={fullName} onChange={e => setFullName(e.target.value)} className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-violet-500/40 focus:outline-none" /></div>
          <div><label className="mb-1.5 block text-xs text-gray-400">{l('Subscription Plan')}</label><div className="flex min-h-11 w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-gray-300"><span className="capitalize">{user.plan === 'admin' ? l('Admin Access') : l(user.plan)}</span><span className="text-[10px] text-gray-500">{l('Managed by Billing')}</span></div></div>
          <div><label className="mb-1.5 block text-xs text-gray-400">{l('Role')}</label><select value={role} disabled={isSelf} onChange={e => setRole(e.target.value)} className="min-h-11 w-full rounded-xl border border-white/10 bg-[#12122a] px-3 py-2.5 text-sm text-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"><option value="user">{l('User')}</option><option value="admin">{l('Admin')}</option></select></div>
          {!isSelf && user.role !== 'admin' && <div className="space-y-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3"><div><label className="mb-1.5 block text-xs text-amber-200">{l('Complimentary Access')}</label>{accessLoading ? <div className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-[#12122a] px-3 text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin" />{l('Loading...')}</div> : <select value={accessOverride} onChange={e => setAccessOverride(e.target.value as 'none' | 'pro' | 'business')} className="min-h-11 w-full rounded-xl border border-white/10 bg-[#12122a] px-3 py-2.5 text-sm text-white focus:outline-none"><option value="none">{l('Current billing only')}</option><option value="pro">{l('Complimentary Pro')}</option><option value="business">{l('Complimentary Business')}</option></select>}</div><input value={accessReason} disabled={accessLoading} onChange={e => setAccessReason(e.target.value)} placeholder={l('Reason (internal note)')} className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:outline-none disabled:opacity-50" /><div><label className="mb-1.5 block text-xs text-gray-400">{l('Expires (optional)')}</label><input type="datetime-local" value={accessExpiry} disabled={accessLoading} onChange={e => setAccessExpiry(e.target.value)} className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:outline-none disabled:opacity-50" /></div><button type="button" onClick={() => void saveAccessOverride()} disabled={accessSaving || accessLoading} className="min-h-11 w-full rounded-xl border border-amber-500/20 bg-amber-500/10 py-2.5 text-sm font-medium text-amber-100 hover:bg-amber-500/20 disabled:opacity-50">{accessSaving ? l('Saving...') : l('Save Complimentary Access')}</button><p className="text-[10px] leading-4 text-gray-500">{l('This changes product access only. It does not create a Stripe subscription or affect MRR.')}</p></div>}
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3 text-xs text-gray-500"><div className="mb-1 flex min-w-0 items-center gap-1.5"><Mail className="h-3 w-3 shrink-0" /><span className="truncate font-mono">{user.id}</span></div><div className="flex flex-wrap gap-x-3 gap-y-1"><span>{l('Documents')}: {user.project_count}</span><span>{l('AI Requests')}: {user.ai_request_count}</span></div></div>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3"><button onClick={onClose} className="min-h-11 rounded-xl border border-white/10 text-sm text-gray-400 hover:bg-white/5 hover:text-white">{l('Cancel')}</button><button onClick={() => onSave({ ...user, full_name: fullName, role })} disabled={loading} className="min-h-11 rounded-xl bg-violet-600 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50">{loading ? l('Saving...') : l('Save Changes')}</button></div>
      </div>
    </div>
  );
}

function ConfirmModal({ title, message, confirmLabel, danger, loading, onConfirm, onClose, children }: { title: string; message: string; confirmLabel: string; danger?: boolean; loading: boolean; onConfirm: () => void; onClose: () => void; children?: ReactNode; }) {
  const l = useLocalizer();
  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border border-white/10 bg-[#12122a] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-2xl sm:p-6" onClick={e => e.stopPropagation()} style={{ animation: 'fadeInUp 0.2s ease-out' }}>
        <div className="mb-4 flex items-start gap-3">{danger && <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10"><AlertTriangle className="h-5 w-5 text-red-400" /></div>}<div className="min-w-0"><h3 className="font-semibold text-white">{title}</h3><p className="mt-1 break-words text-sm leading-5 text-gray-400">{message}</p></div></div>
        {children}
        <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3"><button onClick={onClose} className="min-h-11 rounded-xl border border-white/10 text-sm text-gray-400 hover:bg-white/5 hover:text-white">{l('Cancel')}</button><button onClick={onConfirm} disabled={loading} className={`min-h-11 rounded-xl text-sm font-medium text-white disabled:opacity-50 ${danger ? 'bg-red-600 hover:bg-red-500' : 'bg-violet-600 hover:bg-violet-500'}`}>{loading ? l('Processing...') : confirmLabel}</button></div>
      </div>
    </div>
  );
}
