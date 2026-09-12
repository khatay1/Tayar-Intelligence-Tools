import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/useAuth';
import { assertToolAccess } from '@/lib/tool-access';
import { supabase } from '@/lib/supabase';
import { colors, radius } from '@/lib/theme';

type TeamRole = 'owner' | 'admin' | 'editor' | 'viewer';
type WorkspaceSummary = { id: string; name: string; owner_id: string; my_role: TeamRole; member_count: number; project_count: number; updated_at: string };
type TeamMember = { userId: string; role: TeamRole; joinedAt: string; fullName: string; email: string };
type TeamInvite = { id: string; email: string; role: Exclude<TeamRole, 'owner'>; expiresAt: string; createdAt: string };
type WorkspaceDetails = { workspace: { id: string; name: string; ownerId: string; myRole: TeamRole; createdAt: string; updatedAt: string }; members: TeamMember[]; invites: TeamInvite[]; plan: string; limits: { maxTeamWorkspaces: number; maxTeamMembers: number; memberCount: number; pendingInviteCount: number } };
type WorkspaceProject = { id: string; title: string; type: string; status: string; user_id: string; workspace_id: string | null; updated_at: string };

const inviteRoles: Array<Exclude<TeamRole, 'owner'>> = ['admin', 'editor', 'viewer'];
const memberRoles: Array<Exclude<TeamRole, 'owner'>> = ['admin', 'editor', 'viewer'];

function errMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message || 'Unexpected error');
  return 'Unexpected error';
}

export default function TeamWorkspaceScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const params = useLocalSearchParams<{ token?: string }>();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [details, setDetails] = useState<WorkspaceDetails | null>(null);
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [assignable, setAssignable] = useState<WorkspaceProject[]>([]);
  const [newName, setNewName] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Exclude<TeamRole, 'owner'>>('editor');
  const [inviteToken, setInviteToken] = useState(String(params.token || ''));
  const [lastInvite, setLastInvite] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const activeUserIdRef = useRef(userId);
  const selectedIdRef = useRef(selectedId);
  const guardedSequenceRef = useRef(0);
  const workspaceListSequenceRef = useRef(0);
  const workspaceDetailSequenceRef = useRef(0);

  activeUserIdRef.current = userId;
  selectedIdRef.current = selectedId;

  const myRole = details?.workspace.myRole || workspaces.find((item) => item.id === selectedId)?.my_role || null;
  const canManage = myRole === 'owner' || myRole === 'admin';
  const isOwner = myRole === 'owner';

  async function guarded(action: () => Promise<void>) {
    const sequence = ++guardedSequenceRef.current;
    setBusy(true); setError(''); setMessage('');
    try { await action(); }
    catch (err) {
      if (sequence === guardedSequenceRef.current) {
        setError(errMessage(err));
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }
    finally { if (sequence === guardedSequenceRef.current) setBusy(false); }
  }

  const loadWorkspace = useCallback(async (workspaceId: string) => {
    if (!userId || !workspaceId) return;
    const sequence = ++workspaceDetailSequenceRef.current;
    const requestUserId = userId;
    const [detailResult, projectResult, personalResult] = await Promise.all([
      supabase.rpc('get_team_workspace_details', { p_workspace_id: workspaceId }),
      supabase.from('projects').select('id,title,type,status,user_id,workspace_id,updated_at').eq('workspace_id', workspaceId).is('deleted_at', null).order('updated_at', { ascending: false }),
      supabase.from('projects').select('id,title,type,status,user_id,workspace_id,updated_at').eq('user_id', requestUserId).is('workspace_id', null).is('deleted_at', null).order('updated_at', { ascending: false }).limit(100),
    ]);
    if (detailResult.error) throw detailResult.error;
    if (projectResult.error) throw projectResult.error;
    if (personalResult.error) throw personalResult.error;
    if (sequence !== workspaceDetailSequenceRef.current || activeUserIdRef.current !== requestUserId) return;
    const nextDetails = detailResult.data as WorkspaceDetails;
    setDetails(nextDetails);
    setRenameValue(nextDetails?.workspace?.name || '');
    setProjects((projectResult.data || []) as WorkspaceProject[]);
    setAssignable((personalResult.data || []) as WorkspaceProject[]);
  }, [userId]);

  const loadWorkspaces = useCallback(async (preferred?: string) => {
    if (!userId) return;
    const sequence = ++workspaceListSequenceRef.current;
    const requestUserId = userId;
    await assertToolAccess('team-workspace');
    const { data, error: rpcError } = await supabase.rpc('list_team_workspaces');
    if (rpcError) throw rpcError;
    if (sequence !== workspaceListSequenceRef.current || activeUserIdRef.current !== requestUserId) return;
    const rows = ((data || []) as WorkspaceSummary[]).map((row) => ({ ...row, member_count: Number(row.member_count || 0), project_count: Number(row.project_count || 0) }));
    setWorkspaces(rows);
    const currentId = selectedIdRef.current;
    const nextId = preferred && rows.some((item) => item.id === preferred) ? preferred : currentId && rows.some((item) => item.id === currentId) ? currentId : rows[0]?.id || '';
    setSelectedId(nextId);
    if (nextId) await loadWorkspace(nextId); else { setDetails(null); setProjects([]); setAssignable([]); }
  }, [loadWorkspace, userId]);

  useEffect(() => {
    workspaceListSequenceRef.current += 1;
    workspaceDetailSequenceRef.current += 1;
    const sequence = ++guardedSequenceRef.current;
    setWorkspaces([]); setSelectedId(''); setDetails(null); setProjects([]); setAssignable([]);
    setError(''); setMessage('');

    if (!userId) {
      setBusy(false);
      return;
    }

    setBusy(true);
    void loadWorkspaces()
      .catch((err) => {
        if (sequence === guardedSequenceRef.current) {
          setError(errMessage(err));
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      })
      .finally(() => { if (sequence === guardedSequenceRef.current) setBusy(false); });

    return () => {
      workspaceListSequenceRef.current += 1;
      workspaceDetailSequenceRef.current += 1;
      guardedSequenceRef.current += 1;
    };
  }, [loadWorkspaces, userId]);
  useEffect(() => { if (params.token) setInviteToken(String(params.token)); }, [params.token]);

  async function createWorkspace() {
    if (!newName.trim()) return;
    await guarded(async () => {
      const { data, error: rpcError } = await supabase.rpc('create_team_workspace', { p_name: newName.trim() });
      if (rpcError) throw rpcError;
      setNewName(''); setMessage('Team workspace created.');
      await loadWorkspaces(String(data || ''));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });
  }

  async function renameWorkspace() {
    if (!selectedId || !renameValue.trim()) return;
    await guarded(async () => {
      const { error: rpcError } = await supabase.rpc('rename_team_workspace', { p_workspace_id: selectedId, p_name: renameValue.trim() });
      if (rpcError) throw rpcError;
      setMessage('Workspace renamed.'); await loadWorkspaces(selectedId);
    });
  }

  async function createInvite() {
    if (!selectedId || !inviteEmail.trim()) return;
    await guarded(async () => {
      const { data, error: rpcError } = await supabase.rpc('create_team_workspace_invite', { p_workspace_id: selectedId, p_email: inviteEmail.trim(), p_role: inviteRole });
      if (rpcError) throw rpcError;
      const token = String((data as { token?: string } | null)?.token || '');
      const link = token ? `tayartools://team-invite?token=${encodeURIComponent(token)}` : '';
      setLastInvite(link || token); setInviteEmail('');
      if (link) await Clipboard.setStringAsync(link);
      setMessage('Invite created and copied.'); await loadWorkspace(selectedId);
    });
  }

  async function acceptInvite() {
    if (!inviteToken.trim()) return;
    await guarded(async () => {
      const raw = inviteToken.trim();
      let token = raw;
      if (raw.startsWith('tayartools://')) { try { token = new URL(raw).searchParams.get('token') || raw; } catch { /* use raw */ } }
      const { data, error: rpcError } = await supabase.rpc('accept_team_workspace_invite', { p_token: token });
      if (rpcError) throw rpcError;
      setInviteToken(''); setMessage('Invite accepted.'); await loadWorkspaces(String(data || ''));
    });
  }

  async function changeRole(member: TeamMember, role: Exclude<TeamRole, 'owner'>) {
    if (!selectedId) return;
    await guarded(async () => {
      const { error: rpcError } = await supabase.rpc('update_team_workspace_member_role', { p_workspace_id: selectedId, p_user_id: member.userId, p_role: role });
      if (rpcError) throw rpcError;
      setMessage('Member role updated.'); await loadWorkspace(selectedId);
    });
  }

  function confirmRemove(member: TeamMember) {
    Alert.alert(member.userId === user?.id ? 'Leave workspace?' : 'Remove member?', member.fullName || member.email, [
      { text: 'Cancel', style: 'cancel' },
      { text: member.userId === user?.id ? 'Leave' : 'Remove', style: 'destructive', onPress: () => void guarded(async () => {
        const { error: rpcError } = await supabase.rpc('remove_team_workspace_member', { p_workspace_id: selectedId, p_user_id: member.userId });
        if (rpcError) throw rpcError;
        setMessage(member.userId === user?.id ? 'You left the workspace.' : 'Member removed.');
        await loadWorkspaces(member.userId === user?.id ? undefined : selectedId);
      }) },
    ]);
  }

  async function assignProject(projectId: string) {
    if (!selectedId) return;
    await guarded(async () => {
      const { error: rpcError } = await supabase.rpc('assign_project_to_team_workspace', { p_project_id: projectId, p_workspace_id: selectedId });
      if (rpcError) throw rpcError;
      setMessage('Project shared with workspace.'); await loadWorkspace(selectedId);
    });
  }

  async function unshareProject(projectId: string) {
    await guarded(async () => {
      const { error: rpcError } = await supabase.rpc('remove_project_from_team_workspace', { p_project_id: projectId });
      if (rpcError) throw rpcError;
      setMessage('Project removed from workspace.'); await loadWorkspace(selectedId);
    });
  }

  return <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 42 }]} keyboardShouldPersistTaps="handled">
    <View style={styles.hero}><View style={styles.iconWrap}><MaterialCommunityIcons name="account-group-outline" size={25} color={colors.violetBright} /></View><View style={{ flex: 1 }}><Text style={styles.title}>Team Workspace</Text><Text style={styles.subtitle}>Business collaboration, roles, invites and shared Tayar projects.</Text></View></View>

    <View style={styles.inviteAccept}><Text style={styles.sectionTitle}>Have an invite?</Text><TextInput value={inviteToken} onChangeText={setInviteToken} autoCapitalize="none" placeholder="Paste invite link or token" placeholderTextColor={colors.muted} style={styles.input} /><Pressable disabled={busy || !inviteToken.trim()} onPress={() => void acceptInvite()} style={[styles.secondaryAction, (busy || !inviteToken.trim()) && styles.disabled]}><Text style={styles.secondaryText}>Accept invite</Text></Pressable></View>

    {error ? <Text style={styles.error}>{error}</Text> : null}{message ? <Text style={styles.message}>{message}</Text> : null}
    {busy && !workspaces.length ? <View style={styles.loading}><ActivityIndicator color={colors.violetBright} /><Text style={styles.muted}>Loading workspace…</Text></View> : null}

    <Text style={styles.sectionTitle}>Your workspaces</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.workspaceChips}>{workspaces.map((workspace) => <Pressable key={workspace.id} onPress={() => void guarded(async () => { setSelectedId(workspace.id); await loadWorkspace(workspace.id); })} style={[styles.workspaceChip, selectedId === workspace.id && styles.workspaceActive]}><Text style={[styles.workspaceName, selectedId === workspace.id && styles.workspaceNameActive]}>{workspace.name}</Text><Text style={styles.workspaceMeta}>{workspace.member_count} members · {workspace.project_count} projects</Text></Pressable>)}</ScrollView>

    <View style={styles.createCard}><Text style={styles.sectionTitle}>Create workspace</Text><TextInput value={newName} onChangeText={setNewName} placeholder="Workspace name" placeholderTextColor={colors.muted} style={styles.input} /><Pressable disabled={busy || !newName.trim()} onPress={() => void createWorkspace()} style={[styles.primaryAction, (busy || !newName.trim()) && styles.disabled]}><MaterialCommunityIcons name="plus" size={19} color={colors.white} /><Text style={styles.primaryText}>Create</Text></Pressable></View>

    {details ? <>
      <View style={styles.detailsCard}><View style={styles.detailsHeader}><View style={{ flex: 1 }}><Text style={styles.detailsName}>{details.workspace.name}</Text><Text style={styles.muted}>{myRole?.toUpperCase()} · {details.limits.memberCount}/{details.limits.maxTeamMembers} seats</Text></View><Pressable onPress={() => void guarded(async () => loadWorkspaces(selectedId))} style={styles.iconButton}><MaterialCommunityIcons name="refresh" size={19} color={colors.text} /></Pressable></View>{canManage ? <><TextInput value={renameValue} onChangeText={setRenameValue} style={styles.input} /><Pressable onPress={() => void renameWorkspace()} disabled={busy || !renameValue.trim()} style={[styles.secondaryAction, (busy || !renameValue.trim()) && styles.disabled]}><Text style={styles.secondaryText}>Rename workspace</Text></Pressable></> : null}</View>

      {canManage ? <View style={styles.sectionCard}><Text style={styles.sectionTitle}>Invite teammate</Text><TextInput value={inviteEmail} onChangeText={setInviteEmail} keyboardType="email-address" autoCapitalize="none" placeholder="name@example.com" placeholderTextColor={colors.muted} style={styles.input} /><View style={styles.roleRow}>{inviteRoles.map((role) => <Pressable key={role} onPress={() => setInviteRole(role)} style={[styles.roleChip, inviteRole === role && styles.roleActive]}><Text style={[styles.roleText, inviteRole === role && styles.roleTextActive]}>{role}</Text></Pressable>)}</View><Pressable disabled={busy || !inviteEmail.trim()} onPress={() => void createInvite()} style={[styles.primaryAction, (busy || !inviteEmail.trim()) && styles.disabled]}><MaterialCommunityIcons name="email-plus-outline" size={19} color={colors.white} /><Text style={styles.primaryText}>Create invite</Text></Pressable>{lastInvite ? <Pressable onPress={() => void Clipboard.setStringAsync(lastInvite)} style={styles.linkCard}><Text selectable numberOfLines={2} style={styles.linkText}>{lastInvite}</Text><MaterialCommunityIcons name="content-copy" size={18} color={colors.violetBright} /></Pressable> : null}</View> : null}

      <View style={styles.sectionCard}><Text style={styles.sectionTitle}>Members</Text>{details.members.map((member) => <View key={member.userId} style={styles.memberRow}><View style={styles.memberAvatar}><Text style={styles.memberInitial}>{(member.fullName || member.email || '?').slice(0, 1).toUpperCase()}</Text></View><View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={styles.memberName}>{member.fullName || member.email}</Text><Text numberOfLines={1} style={styles.muted}>{member.email} · {member.role}</Text></View>{canManage && member.role !== 'owner' ? <View style={styles.memberActions}>{memberRoles.filter((role) => role !== member.role).slice(0, 1).map((role) => <Pressable key={role} onPress={() => void changeRole(member, role)} style={styles.smallButton}><Text style={styles.smallButtonText}>{role}</Text></Pressable>)}<Pressable onPress={() => confirmRemove(member)} style={styles.iconButton}><MaterialCommunityIcons name="account-remove-outline" size={18} color={colors.danger} /></Pressable></View> : null}</View>)}</View>

      <View style={styles.sectionCard}><Text style={styles.sectionTitle}>Shared projects</Text>{projects.length ? projects.map((project) => <View key={project.id} style={styles.projectRow}><View style={{ flex: 1 }}><Text numberOfLines={1} style={styles.memberName}>{project.title}</Text><Text style={styles.muted}>{project.type} · {project.status}</Text></View>{isOwner || project.user_id === user?.id ? <Pressable onPress={() => void unshareProject(project.id)} style={styles.iconButton}><MaterialCommunityIcons name="link-off" size={18} color={colors.danger} /></Pressable> : null}</View>) : <Text style={styles.emptyText}>No shared projects yet.</Text>}
        {canManage && assignable.length ? <><Text style={styles.subheading}>Share a personal project</Text>{assignable.slice(0, 12).map((project) => <Pressable key={project.id} onPress={() => void assignProject(project.id)} style={styles.assignRow}><View style={{ flex: 1 }}><Text numberOfLines={1} style={styles.memberName}>{project.title}</Text><Text style={styles.muted}>{project.type}</Text></View><MaterialCommunityIcons name="plus-circle-outline" size={20} color={colors.violetBright} /></Pressable>)}</> : null}
      </View>
    </> : null}
  </ScrollView>;
}

const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:colors.bg},content:{paddingHorizontal:18,paddingTop:10},hero:{flexDirection:'row',gap:13,alignItems:'center',paddingVertical:10,marginBottom:10},iconWrap:{width:48,height:48,borderRadius:16,backgroundColor:colors.violetSoft,alignItems:'center',justifyContent:'center'},title:{color:colors.text,fontSize:24,fontWeight:'900'},subtitle:{color:colors.muted,fontSize:12.5,lineHeight:18,marginTop:4},sectionTitle:{color:colors.text,fontSize:14,fontWeight:'900',marginBottom:9},subheading:{color:colors.text,fontSize:12,fontWeight:'900',marginTop:14,marginBottom:7},input:{minHeight:48,borderRadius:radius.md,borderWidth:1,borderColor:colors.border,backgroundColor:colors.panel,color:colors.text,paddingHorizontal:13,fontSize:13.5},inviteAccept:{borderRadius:radius.lg,borderWidth:1,borderColor:'#3C3158',backgroundColor:'#12101D',padding:14,gap:8},error:{color:colors.danger,fontSize:12,lineHeight:18,marginTop:10},message:{color:'#86EFAC',fontSize:12,lineHeight:18,marginTop:10},loading:{minHeight:100,alignItems:'center',justifyContent:'center',gap:8},muted:{color:colors.muted,fontSize:10.5,marginTop:3},workspaceChips:{gap:8,paddingRight:18,marginBottom:12},workspaceChip:{minWidth:150,borderRadius:radius.md,borderWidth:1,borderColor:colors.border,backgroundColor:colors.panel,padding:12},workspaceActive:{borderColor:colors.violet,backgroundColor:colors.violetSoft},workspaceName:{color:colors.text,fontSize:12.5,fontWeight:'900'},workspaceNameActive:{color:'#DDD6FE'},workspaceMeta:{color:colors.muted,fontSize:9.5,marginTop:4},createCard:{borderRadius:radius.lg,borderWidth:1,borderColor:colors.border,backgroundColor:colors.panel,padding:14,gap:8,marginBottom:12},detailsCard:{borderRadius:radius.lg,borderWidth:1,borderColor:colors.border,backgroundColor:colors.panel,padding:14,gap:8,marginBottom:12},detailsHeader:{flexDirection:'row',alignItems:'center',gap:8},detailsName:{color:colors.text,fontSize:18,fontWeight:'900'},sectionCard:{borderRadius:radius.lg,borderWidth:1,borderColor:colors.border,backgroundColor:colors.panel,padding:14,marginBottom:12},roleRow:{flexDirection:'row',gap:7,marginVertical:8},roleChip:{flex:1,minHeight:38,borderRadius:12,borderWidth:1,borderColor:colors.border,backgroundColor:colors.panelSoft,alignItems:'center',justifyContent:'center'},roleActive:{borderColor:colors.violet,backgroundColor:colors.violetSoft},roleText:{color:colors.muted,fontSize:10.5,fontWeight:'800',textTransform:'capitalize'},roleTextActive:{color:'#DDD6FE'},primaryAction:{minHeight:48,borderRadius:radius.md,backgroundColor:colors.violet,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},primaryText:{color:colors.white,fontSize:13,fontWeight:'900'},secondaryAction:{minHeight:44,borderRadius:radius.md,borderWidth:1,borderColor:colors.border,backgroundColor:colors.panelSoft,alignItems:'center',justifyContent:'center'},secondaryText:{color:colors.text,fontSize:12,fontWeight:'800'},disabled:{opacity:.4},linkCard:{marginTop:9,borderRadius:radius.md,borderWidth:1,borderColor:'#3C3158',backgroundColor:'#0B0A11',padding:10,flexDirection:'row',alignItems:'center',gap:8},linkText:{flex:1,color:'#C4B5FD',fontSize:10.5},memberRow:{minHeight:64,flexDirection:'row',alignItems:'center',gap:9,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border,paddingVertical:8},memberAvatar:{width:38,height:38,borderRadius:12,backgroundColor:colors.violetSoft,alignItems:'center',justifyContent:'center'},memberInitial:{color:'#DDD6FE',fontWeight:'900'},memberName:{color:colors.text,fontSize:12.5,fontWeight:'800'},memberActions:{flexDirection:'row',gap:5,alignItems:'center'},smallButton:{minHeight:34,borderRadius:10,borderWidth:1,borderColor:colors.border,paddingHorizontal:8,alignItems:'center',justifyContent:'center'},smallButtonText:{color:colors.muted,fontSize:9.5,textTransform:'capitalize'},iconButton:{width:36,height:36,borderRadius:11,backgroundColor:colors.panelSoft,alignItems:'center',justifyContent:'center'},projectRow:{minHeight:58,flexDirection:'row',alignItems:'center',gap:8,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},assignRow:{minHeight:52,flexDirection:'row',alignItems:'center',gap:8,borderRadius:12,backgroundColor:colors.panelSoft,paddingHorizontal:11,marginTop:6},emptyText:{color:colors.muted,fontSize:11.5,paddingVertical:12},
});
