import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Crown,
  FolderKanban,
  KeyRound,
  Loader2,
  LogOut,
  MailPlus,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  UserMinus,
  UsersRound,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

type TeamRole = 'owner' | 'admin' | 'editor' | 'viewer';

type WorkspaceSummary = {
  id: string;
  name: string;
  owner_id: string;
  my_role: TeamRole;
  member_count: number;
  project_count: number;
  updated_at: string;
};

type TeamMember = {
  userId: string;
  role: TeamRole;
  joinedAt: string;
  fullName: string;
  email: string;
};

type TeamInvite = {
  id: string;
  email: string;
  role: Exclude<TeamRole, 'owner'>;
  expiresAt: string;
  createdAt: string;
};

type WorkspaceDetails = {
  workspace: {
    id: string;
    name: string;
    ownerId: string;
    myRole: TeamRole;
    createdAt: string;
    updatedAt: string;
  };
  members: TeamMember[];
  invites: TeamInvite[];
  plan: 'free' | 'pro' | 'business';
  limits: {
    maxTeamWorkspaces: number;
    maxTeamMembers: number;
    memberCount: number;
    pendingInviteCount: number;
  };
};

type WorkspaceProject = {
  id: string;
  title: string;
  type: string;
  status: string;
  user_id: string;
  workspace_id: string | null;
  updated_at: string;
};

const ROLE_META: Record<TeamRole, { label: string; description: string }> = {
  owner: { label: 'Owner', description: 'Full control, billing and publishing.' },
  admin: { label: 'Admin', description: 'Manage members and shared projects.' },
  editor: { label: 'Editor', description: 'Edit shared project content.' },
  viewer: { label: 'Viewer', description: 'Read-only access.' },
};

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message || 'Unexpected error');
  return 'Unexpected error';
}

export default function TeamWorkspaceTool({ darkMode }: { darkMode: boolean }) {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<WorkspaceDetails | null>(null);
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [assignableProjects, setAssignableProjects] = useState<WorkspaceProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Exclude<TeamRole, 'owner'>>('editor');
  const [lastInviteLink, setLastInviteLink] = useState('');
  const [acceptToken, setAcceptToken] = useState('');
  const [assignProjectId, setAssignProjectId] = useState('');

  const selected = useMemo(() => workspaces.find((item) => item.id === selectedId) || null, [workspaces, selectedId]);
  const myRole = details?.workspace.myRole || selected?.my_role || null;
  const canManage = myRole === 'owner' || myRole === 'admin';
  const isOwner = myRole === 'owner';

  async function loadWorkspaces(preferredId?: string | null) {
    if (!user) {
      setWorkspaces([]);
      setSelectedId(null);
      setDetails(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const { data, error: rpcError } = await supabase.rpc('list_team_workspaces');
    if (rpcError) {
      setError(rpcError.message || 'Could not load team workspaces. Apply the Sprint 133-144 migration.');
      setLoading(false);
      return;
    }
    const rows = ((data || []) as WorkspaceSummary[]).map((item) => ({
      ...item,
      member_count: Number(item.member_count || 0),
      project_count: Number(item.project_count || 0),
    }));
    setWorkspaces(rows);
    const nextId = preferredId && rows.some((item) => item.id === preferredId)
      ? preferredId
      : selectedId && rows.some((item) => item.id === selectedId)
        ? selectedId
        : rows[0]?.id || null;
    setSelectedId(nextId);
    setLoading(false);
    if (nextId) await loadWorkspace(nextId);
    else {
      setDetails(null);
      setProjects([]);
      setAssignableProjects([]);
    }
  }

  async function loadWorkspace(workspaceId: string) {
    if (!user) return;
    setBusy(true);
    setError('');
    const [detailsResult, projectsResult, ownProjectsResult] = await Promise.all([
      supabase.rpc('get_team_workspace_details', { p_workspace_id: workspaceId }),
      supabase
        .from('projects')
        .select('id, title, type, status, user_id, workspace_id, updated_at')
        .eq('workspace_id', workspaceId)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false }),
      supabase
        .from('projects')
        .select('id, title, type, status, user_id, workspace_id, updated_at')
        .eq('user_id', user.id)
        .is('workspace_id', null)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(100),
    ]);

    if (detailsResult.error) {
      setError(detailsResult.error.message || 'Could not load workspace details.');
      setBusy(false);
      return;
    }
    setDetails(detailsResult.data as WorkspaceDetails);
    setRenameValue(String((detailsResult.data as WorkspaceDetails)?.workspace?.name || ''));
    setProjects((projectsResult.data || []) as WorkspaceProject[]);
    setAssignableProjects((ownProjectsResult.data || []) as WorkspaceProject[]);
    setBusy(false);
  }

  useEffect(() => {
    void loadWorkspaces();
    const match = window.location.hash.match(/team-invite=([a-f0-9]+)/i);
    if (match?.[1]) setAcceptToken(match[1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function createWorkspace() {
    const name = newWorkspaceName.trim();
    if (!name) return;
    await run(async () => {
      const { data, error: rpcError } = await supabase.rpc('create_team_workspace', { p_name: name });
      if (rpcError) throw rpcError;
      setNewWorkspaceName('');
      setMessage('Team workspace created.');
      await loadWorkspaces(String(data));
    });
  }

  async function renameWorkspace() {
    if (!selectedId || !renameValue.trim()) return;
    await run(async () => {
      const { error: rpcError } = await supabase.rpc('rename_team_workspace', {
        p_workspace_id: selectedId,
        p_name: renameValue.trim(),
      });
      if (rpcError) throw rpcError;
      setMessage('Workspace renamed.');
      await loadWorkspaces(selectedId);
    });
  }

  async function deleteWorkspace() {
    if (!selectedId || !isOwner || !window.confirm('Delete this team workspace? Shared projects will become personal projects again.')) return;
    await run(async () => {
      const { error: rpcError } = await supabase.rpc('delete_team_workspace', { p_workspace_id: selectedId });
      if (rpcError) throw rpcError;
      setMessage('Workspace deleted.');
      await loadWorkspaces(null);
    });
  }

  async function createInvite() {
    if (!selectedId || !inviteEmail.trim()) return;
    await run(async () => {
      const { data, error: rpcError } = await supabase.rpc('create_team_workspace_invite', {
        p_workspace_id: selectedId,
        p_email: inviteEmail.trim(),
        p_role: inviteRole,
      });
      if (rpcError) throw rpcError;
      const token = String((data as { token?: string } | null)?.token || '');
      const link = `${window.location.origin}${window.location.pathname}#team-invite=${token}`;
      setLastInviteLink(link);
      setInviteEmail('');
      setMessage('Invite created. Copy the secure link and send it to the teammate.');
      try { await navigator.clipboard.writeText(link); } catch { /* clipboard is optional */ }
      await loadWorkspace(selectedId);
    });
  }

  async function acceptInvite() {
    const token = acceptToken.trim();
    if (!token) return;
    await run(async () => {
      const { data, error: rpcError } = await supabase.rpc('accept_team_workspace_invite', { p_token: token });
      if (rpcError) throw rpcError;
      const workspaceId = String(data || '');
      setAcceptToken('');
      setMessage('Invite accepted.');
      if (window.location.hash.startsWith('#team-invite=')) window.history.replaceState(null, '', window.location.pathname + window.location.search);
      await loadWorkspaces(workspaceId);
    });
  }

  async function revokeInvite(inviteId: string) {
    if (!selectedId) return;
    await run(async () => {
      const { error: rpcError } = await supabase.rpc('revoke_team_workspace_invite', { p_invite_id: inviteId });
      if (rpcError) throw rpcError;
      setMessage('Invite revoked.');
      await loadWorkspace(selectedId);
    });
  }

  async function changeRole(member: TeamMember, role: Exclude<TeamRole, 'owner'>) {
    if (!selectedId) return;
    await run(async () => {
      const { error: rpcError } = await supabase.rpc('update_team_workspace_member_role', {
        p_workspace_id: selectedId,
        p_user_id: member.userId,
        p_role: role,
      });
      if (rpcError) throw rpcError;
      setMessage('Member role updated.');
      await loadWorkspace(selectedId);
    });
  }

  async function removeMember(member: TeamMember) {
    if (!selectedId || !window.confirm(`Remove ${member.fullName || member.email || 'this member'} from the workspace?`)) return;
    await run(async () => {
      const { error: rpcError } = await supabase.rpc('remove_team_workspace_member', {
        p_workspace_id: selectedId,
        p_user_id: member.userId,
      });
      if (rpcError) throw rpcError;
      setMessage(member.userId === user?.id ? 'You left the workspace.' : 'Member removed.');
      await loadWorkspaces(member.userId === user?.id ? null : selectedId);
    });
  }

  async function transferOwnership(member: TeamMember) {
    if (!selectedId || !isOwner || !window.confirm(`Transfer ownership to ${member.fullName || member.email}?`)) return;
    await run(async () => {
      const { error: rpcError } = await supabase.rpc('transfer_team_workspace_ownership', {
        p_workspace_id: selectedId,
        p_new_owner_id: member.userId,
      });
      if (rpcError) throw rpcError;
      setMessage('Workspace ownership transferred.');
      await loadWorkspaces(selectedId);
    });
  }

  async function assignProject() {
    if (!selectedId || !assignProjectId) return;
    await run(async () => {
      const { error: rpcError } = await supabase.rpc('assign_project_to_team_workspace', {
        p_project_id: assignProjectId,
        p_workspace_id: selectedId,
      });
      if (rpcError) throw rpcError;
      setAssignProjectId('');
      setMessage('Project shared with the workspace.');
      await loadWorkspaces(selectedId);
    });
  }

  async function unshareProject(projectId: string) {
    if (!selectedId) return;
    await run(async () => {
      const { error: rpcError } = await supabase.rpc('remove_project_from_team_workspace', { p_project_id: projectId });
      if (rpcError) throw rpcError;
      setMessage('Project removed from the workspace.');
      await loadWorkspaces(selectedId);
    });
  }

  const panel = darkMode ? 'border-white/10 bg-white/[0.03]' : 'border-gray-200 bg-white';
  const input = darkMode
    ? 'border-white/10 bg-white/5 text-white placeholder:text-gray-600'
    : 'border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400';

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className={`rounded-3xl border ${panel} p-6`}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-violet-400">
              <UsersRound className="h-4 w-4" /> Team Workspace
            </div>
            <h1 className={`text-2xl font-black ${darkMode ? 'text-white' : 'text-gray-900'}`}>Build websites together</h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">Secure roles, invitations and shared projects. Pro supports 3 seats; Business supports 10 seats.</p>
          </div>
          <button onClick={() => void loadWorkspaces(selectedId)} disabled={loading || busy} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-gray-400 hover:text-white disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading || busy ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {(error || message) && (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${error ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}`}>
          {error || message}
        </div>
      )}

      <div className={`rounded-2xl border ${panel} p-4`}>
        <div className="flex flex-col gap-3 md:flex-row">
          <input value={acceptToken} onChange={(event) => setAcceptToken(event.target.value)} className={`min-w-0 flex-1 rounded-xl border px-4 py-2.5 text-sm outline-none focus:border-violet-500 ${input}`} placeholder="Paste a team invitation token or open an invitation link" />
          <button onClick={() => void acceptInvite()} disabled={busy || !acceptToken.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-40">
            <KeyRound className="h-4 w-4" /> Accept invite
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className={`rounded-3xl border ${panel} p-4`}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className={`text-sm font-black ${darkMode ? 'text-white' : 'text-gray-900'}`}>Your teams</h2>
            <span className="text-xs text-gray-500">{workspaces.length}</span>
          </div>
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-violet-500" /></div>
          ) : workspaces.length ? (
            <div className="space-y-2">
              {workspaces.map((workspace) => (
                <button key={workspace.id} onClick={() => { setSelectedId(workspace.id); void loadWorkspace(workspace.id); }} className={`w-full rounded-2xl border p-3 text-left transition ${selectedId === workspace.id ? 'border-violet-500/40 bg-violet-500/10' : 'border-white/5 hover:border-white/15'}`}>
                  <div className={`truncate text-sm font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{workspace.name}</div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500">
                    <span className="capitalize">{workspace.my_role}</span>
                    <span>{workspace.member_count} members · {workspace.project_count} projects</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-xs text-gray-500">No team workspaces yet.</p>
          )}

          <div className="mt-4 border-t border-white/5 pt-4">
            <input value={newWorkspaceName} onChange={(event) => setNewWorkspaceName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void createWorkspace()} className={`w-full rounded-xl border px-3 py-2 text-xs outline-none focus:border-violet-500 ${input}`} placeholder="New workspace name" />
            <button onClick={() => void createWorkspace()} disabled={busy || !newWorkspaceName.trim()} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-40">
              <Plus className="h-4 w-4" /> Create workspace
            </button>
          </div>
        </div>

        {!selectedId || !details ? (
          <div className={`flex min-h-[460px] items-center justify-center rounded-3xl border ${panel} p-8 text-center`}>
            <div>
              <UsersRound className="mx-auto h-10 w-10 text-gray-600" />
              <p className="mt-3 text-sm text-gray-500">Create or select a team workspace to manage members and projects.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className={`rounded-3xl border ${panel} p-5`}>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className={`text-xl font-black ${darkMode ? 'text-white' : 'text-gray-900'}`}>{details.workspace.name}</h2>
                    <span className="rounded-full bg-violet-500/10 px-2 py-1 text-[10px] font-black uppercase text-violet-400">{details.workspace.myRole}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{details.plan.toUpperCase()} · {details.limits.memberCount}/{details.limits.maxTeamMembers} seats used</p>
                </div>
                {canManage && (
                  <div className="flex flex-wrap gap-2">
                    <input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} className={`w-44 rounded-xl border px-3 py-2 text-xs outline-none focus:border-violet-500 ${input}`} />
                    <button onClick={() => void renameWorkspace()} disabled={busy || !renameValue.trim()} className="rounded-xl border border-white/10 p-2 text-gray-400 hover:text-white disabled:opacity-40" title="Rename workspace"><Save className="h-4 w-4" /></button>
                    {isOwner && <button onClick={() => void deleteWorkspace()} disabled={busy} className="rounded-xl border border-red-500/20 p-2 text-red-400 hover:bg-red-500/10" title="Delete workspace"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                )}
              </div>
            </div>

            {canManage && (
              <div className={`rounded-3xl border ${panel} p-5`}>
                <div className="mb-4 flex items-center gap-2">
                  <MailPlus className="h-5 w-5 text-violet-400" />
                  <h3 className={`font-black ${darkMode ? 'text-white' : 'text-gray-900'}`}>Invite teammate</h3>
                </div>
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_150px_auto]">
                  <input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} className={`rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-violet-500 ${input}`} placeholder="teammate@example.com" />
                  <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as Exclude<TeamRole, 'owner'>)} className={`rounded-xl border px-3 py-2.5 text-sm outline-none ${input}`}>
                    {isOwner && <option value="admin">Admin</option>}
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button onClick={() => void createInvite()} disabled={busy || !inviteEmail.trim()} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-40">Invite</button>
                </div>
                {lastInviteLink && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <Check className="h-4 w-4 flex-shrink-0 text-emerald-400" />
                    <code className="min-w-0 flex-1 truncate text-[11px] text-emerald-300">{lastInviteLink}</code>
                    <button onClick={() => void navigator.clipboard.writeText(lastInviteLink)} className="rounded-lg p-1.5 text-emerald-400 hover:bg-emerald-500/10"><Copy className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
            )}

            <div className={`rounded-3xl border ${panel} p-5`}>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-cyan-400" /><h3 className={`font-black ${darkMode ? 'text-white' : 'text-gray-900'}`}>Members</h3></div>
                <span className="text-xs text-gray-500">{details.members.length}/{details.limits.maxTeamMembers}</span>
              </div>
              <div className="space-y-2">
                {details.members.map((member) => {
                  const self = member.userId === user?.id;
                  const canEditMember = canManage && member.role !== 'owner' && (! (myRole === 'admin' && member.role === 'admin'));
                  return (
                    <div key={member.userId} className="flex flex-col gap-3 rounded-2xl border border-white/5 p-3 md:flex-row md:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-sm font-black text-violet-300">{(member.fullName || member.email || '?').charAt(0).toUpperCase()}</div>
                        <div className="min-w-0">
                          <div className={`truncate text-sm font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{member.fullName || member.email || 'Member'} {self && <span className="text-[10px] text-gray-500">(you)</span>}</div>
                          <div className="truncate text-xs text-gray-500">{member.email || ROLE_META[member.role].description}</div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {member.role === 'owner' ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-xs font-bold text-amber-400"><Crown className="h-3.5 w-3.5" /> Owner</span>
                        ) : canEditMember ? (
                          <select value={member.role} onChange={(event) => void changeRole(member, event.target.value as Exclude<TeamRole, 'owner'>)} className={`rounded-lg border px-2 py-1.5 text-xs outline-none ${input}`}>
                            {isOwner && <option value="admin">Admin</option>}
                            <option value="editor">Editor</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        ) : (
                          <span className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs capitalize text-gray-400">{member.role}</span>
                        )}
                        {isOwner && member.role !== 'owner' && <button onClick={() => void transferOwnership(member)} className="rounded-lg border border-amber-500/20 p-1.5 text-amber-400 hover:bg-amber-500/10" title="Transfer ownership"><Crown className="h-4 w-4" /></button>}
                        {(self && member.role !== 'owner') && <button onClick={() => void removeMember(member)} className="rounded-lg border border-white/10 p-1.5 text-gray-400 hover:text-white" title="Leave workspace"><LogOut className="h-4 w-4" /></button>}
                        {canEditMember && !self && <button onClick={() => void removeMember(member)} className="rounded-lg border border-red-500/20 p-1.5 text-red-400 hover:bg-red-500/10" title="Remove member"><UserMinus className="h-4 w-4" /></button>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {canManage && details.invites.length > 0 && (
                <div className="mt-5 border-t border-white/5 pt-4">
                  <h4 className="mb-2 text-xs font-black uppercase tracking-wider text-gray-500">Pending invitations</h4>
                  <div className="space-y-2">
                    {details.invites.map((invite) => (
                      <div key={invite.id} className="flex items-center gap-3 rounded-xl border border-white/5 px-3 py-2">
                        <div className="min-w-0 flex-1"><div className={`truncate text-xs font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{invite.email}</div><div className="text-[10px] text-gray-500 capitalize">{invite.role} · expires {new Date(invite.expiresAt).toLocaleDateString()}</div></div>
                        <button onClick={() => void revokeInvite(invite.id)} className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className={`rounded-3xl border ${panel} p-5`}>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2"><FolderKanban className="h-5 w-5 text-fuchsia-400" /><h3 className={`font-black ${darkMode ? 'text-white' : 'text-gray-900'}`}>Shared projects</h3></div>
                <span className="text-xs text-gray-500">{projects.length}</span>
              </div>
              {canManage && (
                <div className="mb-4 flex flex-col gap-2 sm:flex-row">
                  <select value={assignProjectId} onChange={(event) => setAssignProjectId(event.target.value)} className={`min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-sm outline-none ${input}`}>
                    <option value="">Select one of your personal projects…</option>
                    {assignableProjects.map((project) => <option key={project.id} value={project.id}>{project.title} · {project.type}</option>)}
                  </select>
                  <button onClick={() => void assignProject()} disabled={busy || !assignProjectId} className="rounded-xl bg-fuchsia-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-fuchsia-500 disabled:opacity-40">Share project</button>
                </div>
              )}
              {projects.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {projects.map((project) => (
                    <div key={project.id} className="rounded-2xl border border-white/5 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0"><div className={`truncate text-sm font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{project.title}</div><div className="mt-1 text-[11px] text-gray-500">{project.type} · {project.status} · {project.user_id === user?.id ? 'owned by you' : 'shared with you'}</div></div>
                        {(project.user_id === user?.id || canManage) && <button onClick={() => void unshareProject(project.id)} className="rounded-lg border border-white/10 p-1.5 text-gray-500 hover:text-red-400" title="Remove from workspace"><Trash2 className="h-4 w-4" /></button>}
                      </div>
                      {project.type === 'website-builder' && <p className="mt-3 text-[11px] text-violet-400">Open Website Builder from the Tools menu; this shared project will appear in the Cloud Projects selector.</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-xs text-gray-500">No projects shared with this workspace yet.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
