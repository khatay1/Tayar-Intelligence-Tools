import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/useAuth';
import { colors, radius } from '@/lib/theme';
import {
  appendSection,
  archiveMobileWebsiteProject,
  createMobileWebsiteProject,
  generateMobileWebsiteCopy,
  listMobileWebsiteProjects,
  removeSection,
  replaceSectionCopy,
  saveMobileWebsiteProject,
  type MobileSectionType,
  type MobileWebsiteContent,
  type MobileWebsiteProjectRow,
  type MobileWebsiteSection,
} from '@/lib/website-builder';
import {
  publishMobileWebsiteProject,
  unpublishMobileWebsiteProject,
} from '@/lib/website-publish';

const sectionTypes: MobileSectionType[] = ['hero', 'features', 'about', 'services', 'pricing', 'testimonials', 'contact', 'footer'];

function errorText(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message || 'Unexpected error');
  return 'Unexpected error';
}

function shortDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString() : '';
}

function sectionIcon(type: MobileSectionType) {
  if (type === 'hero') return 'monitor-dashboard';
  if (type === 'features') return 'star-four-points-outline';
  if (type === 'about') return 'information-outline';
  if (type === 'services') return 'briefcase-outline';
  if (type === 'pricing') return 'tag-outline';
  if (type === 'testimonials') return 'comment-quote-outline';
  if (type === 'contact') return 'email-outline';
  return 'page-layout-footer';
}

export default function WebsiteBuilderScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [projects, setProjects] = useState<MobileWebsiteProjectRow[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState<MobileWebsiteProjectRow | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [brief, setBrief] = useState('');
  const [busy, setBusy] = useState(true);
  const [aiBusy, setAiBusy] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [dirty, setDirty] = useState(false);
  const [addingSection, setAddingSection] = useState(false);
  const activeUserIdRef = useRef(userId);
  const selectedIdRef = useRef(selectedId);
  const lifecycleSequenceRef = useRef(0);
  const loadSequenceRef = useRef(0);
  const operationLockRef = useRef(false);

  activeUserIdRef.current = userId;
  selectedIdRef.current = selectedId;

  const activePage = useMemo(() => {
    if (!draft) return null;
    return draft.content.pages.find((page) => page.id === draft.content.activePageId) || draft.content.pages[0] || null;
  }, [draft]);

  const canPublish = Boolean(user && draft && draft.user_id === user.id);
  const isPublished = Boolean(draft?.content.publishedUrl && draft.status === 'completed');
  const operationBusy = busy || aiBusy || publishBusy;

  const loadProjects = useCallback(async (preferredId?: string) => {
    const sequence = ++loadSequenceRef.current;
    const requestUserId = userId;
    setBusy(true);
    setError('');
    try {
      if (!requestUserId) return;
      const rows = await listMobileWebsiteProjects();
      if (sequence !== loadSequenceRef.current || activeUserIdRef.current !== requestUserId) return;
      setProjects(rows);
      const currentId = selectedIdRef.current;
      const nextId = preferredId && rows.some((row) => row.id === preferredId)
        ? preferredId
        : currentId && rows.some((row) => row.id === currentId)
          ? currentId
          : rows[0]?.id || '';
      setSelectedId(nextId);
      setDraft(nextId ? rows.find((row) => row.id === nextId) || null : null);
      setDirty(false);
    } catch (caught) {
      if (sequence === loadSequenceRef.current && activeUserIdRef.current === requestUserId) {
        setError(errorText(caught));
      }
    } finally {
      if (sequence === loadSequenceRef.current && activeUserIdRef.current === requestUserId) {
        setBusy(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    lifecycleSequenceRef.current += 1;
    loadSequenceRef.current += 1;
    operationLockRef.current = false;
    setProjects([]);
    setSelectedId('');
    setDraft(null);
    setDirty(false);
    setAiBusy(false);
    setPublishBusy(false);
    setError('');
    setMessage('');

    if (!userId) {
      setBusy(false);
      return;
    }

    void loadProjects();
    return () => {
      lifecycleSequenceRef.current += 1;
      loadSequenceRef.current += 1;
      operationLockRef.current = false;
    };
  }, [loadProjects, userId]);

  function isCurrentAccount(sequence: number, requestUserId: string) {
    return lifecycleSequenceRef.current === sequence && activeUserIdRef.current === requestUserId;
  }

  function isCurrentProject(sequence: number, requestUserId: string, projectId: string) {
    return isCurrentAccount(sequence, requestUserId) && selectedIdRef.current === projectId;
  }

  function mutateContent(update: (content: MobileWebsiteContent) => MobileWebsiteContent) {
    setDraft((current) => current ? { ...current, content: update(current.content) } : current);
    setDirty(true);
  }

  function mutateProject(update: (project: MobileWebsiteProjectRow) => MobileWebsiteProjectRow) {
    setDraft((current) => current ? update(current) : current);
    setDirty(true);
  }

  function applyProjectRow(next: MobileWebsiteProjectRow, successMessage: string) {
    setDraft(next);
    setSelectedId(next.id);
    setProjects((rows) => {
      const exists = rows.some((row) => row.id === next.id);
      return exists ? rows.map((row) => row.id === next.id ? next : row) : [next, ...rows];
    });
    setDirty(false);
    setMessage(successMessage);
    setError('');
  }

  async function createProject() {
    if (!userId || !newProjectName.trim() || operationLockRef.current) return;
    const sequence = lifecycleSequenceRef.current;
    const requestUserId = userId;
    const projectName = newProjectName.trim();
    operationLockRef.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const row = await createMobileWebsiteProject(requestUserId, projectName);
      if (!isCurrentAccount(sequence, requestUserId)) return;
      setNewProjectName('');
      await loadProjects(row.id);
      if (!isCurrentAccount(sequence, requestUserId)) return;
      setMessage('Website project created.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (caught) {
      if (isCurrentAccount(sequence, requestUserId)) setError(errorText(caught));
    } finally {
      if (isCurrentAccount(sequence, requestUserId)) {
        operationLockRef.current = false;
        setBusy(false);
      }
    }
  }

  async function saveProject() {
    if (!draft || !userId || operationLockRef.current) return;
    const sequence = lifecycleSequenceRef.current;
    const requestUserId = userId;
    const draftSnapshot = draft;
    operationLockRef.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const savedContent = await saveMobileWebsiteProject(draftSnapshot);
      if (!isCurrentProject(sequence, requestUserId, draftSnapshot.id)) return;
      const next = { ...draftSnapshot, content: savedContent, updated_at: new Date().toISOString() };
      applyProjectRow(next, 'Saved to Tayar Cloud.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (caught) {
      if (isCurrentProject(sequence, requestUserId, draftSnapshot.id)) {
        setError(errorText(caught));
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      if (isCurrentAccount(sequence, requestUserId)) {
        operationLockRef.current = false;
        setBusy(false);
      }
    }
  }

  async function runAI() {
    if (!draft || !userId || !brief.trim() || operationLockRef.current) return;
    const sequence = lifecycleSequenceRef.current;
    const requestUserId = userId;
    const draftSnapshot = draft;
    const briefSnapshot = brief.trim();
    operationLockRef.current = true;
    setAiBusy(true);
    setError('');
    setMessage('');
    try {
      const content = await generateMobileWebsiteCopy(briefSnapshot, draftSnapshot.content);
      if (!isCurrentProject(sequence, requestUserId, draftSnapshot.id)) return;
      setDraft({ ...draftSnapshot, title: content.siteName || draftSnapshot.title, content });
      setDirty(true);
      setMessage('AI draft applied. Review it, then tap Save or Publish.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (caught) {
      if (isCurrentProject(sequence, requestUserId, draftSnapshot.id)) {
        setError(errorText(caught));
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      if (isCurrentAccount(sequence, requestUserId)) {
        operationLockRef.current = false;
        setAiBusy(false);
      }
    }
  }

  async function publishProject() {
    if (!draft || !userId || operationLockRef.current) return;
    const sequence = lifecycleSequenceRef.current;
    const requestUserId = userId;
    const draftSnapshot = draft;
    operationLockRef.current = true;
    setPublishBusy(true);
    setError('');
    setMessage('');
    try {
      const next = await publishMobileWebsiteProject(draftSnapshot, requestUserId);
      if (!isCurrentProject(sequence, requestUserId, draftSnapshot.id)) return;
      applyProjectRow(next, 'Website published and live route verified.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (caught) {
      if (isCurrentProject(sequence, requestUserId, draftSnapshot.id)) {
        setError(errorText(caught));
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      if (isCurrentAccount(sequence, requestUserId)) {
        operationLockRef.current = false;
        setPublishBusy(false);
      }
    }
  }

  function confirmPublish() {
    if (!draft || !canPublish || publishBusy) return;
    Alert.alert(
      isPublished ? 'Publish website changes?' : 'Publish website?',
      'Tayar will validate the mobile-safe bundle, back up the current live files, upload and verify the new site, then commit the publish state. If anything fails before commit, the previous live site is restored.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: isPublished ? 'Publish changes' : 'Publish', onPress: () => void publishProject() },
      ],
    );
  }

  async function unpublishProject() {
    if (!draft || !userId || operationLockRef.current) return;
    const sequence = lifecycleSequenceRef.current;
    const requestUserId = userId;
    const draftSnapshot = draft;
    operationLockRef.current = true;
    setPublishBusy(true);
    setError('');
    setMessage('');
    try {
      const next = await unpublishMobileWebsiteProject(draftSnapshot, requestUserId);
      if (!isCurrentProject(sequence, requestUserId, draftSnapshot.id)) return;
      applyProjectRow(next, 'Website unpublished. The cloud project remains saved.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (caught) {
      if (isCurrentProject(sequence, requestUserId, draftSnapshot.id)) {
        setError(errorText(caught));
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      if (isCurrentAccount(sequence, requestUserId)) {
        operationLockRef.current = false;
        setPublishBusy(false);
      }
    }
  }

  function confirmUnpublish() {
    if (!isPublished || !canPublish || publishBusy) return;
    Alert.alert('Unpublish website?', 'The public files will be backed up first. If the project state cannot be committed, Tayar restores the public website automatically.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unpublish', style: 'destructive', onPress: () => void unpublishProject() },
    ]);
  }

  function selectProject(row: MobileWebsiteProjectRow) {
    if (operationBusy) return;
    if (dirty && draft?.id !== row.id) {
      Alert.alert('Unsaved changes', 'Save or discard your current changes before switching projects.', [
        { text: 'Stay', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => { setSelectedId(row.id); setDraft(row); setDirty(false); setError(''); setMessage(''); } },
      ]);
      return;
    }
    setSelectedId(row.id);
    setDraft(row);
    setDirty(false);
    setError('');
    setMessage('');
  }

  function selectPage(pageId: string) {
    mutateContent((content) => ({ ...content, activePageId: pageId, updatedAt: new Date().toISOString() }));
  }

  function updateSection(section: MobileWebsiteSection, key: 'title' | 'description' | 'buttonText' | 'buttonUrl', value: string) {
    if (!activePage) return;
    const values = {
      title: section.title,
      description: section.description,
      buttonText: section.buttonText,
      buttonUrl: section.buttonUrl,
      [key]: value,
    };
    mutateContent((content) => replaceSectionCopy(content, activePage.id, section.id, values));
  }

  function addSection(type: MobileSectionType) {
    if (!activePage) return;
    mutateContent((content) => appendSection(content, activePage.id, type));
    setAddingSection(false);
    void Haptics.selectionAsync();
  }

  function confirmRemoveSection(section: MobileWebsiteSection) {
    if (!activePage || activePage.sections.length <= 1) return;
    Alert.alert('Delete section?', `${section.type} · ${section.title}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => mutateContent((content) => removeSection(content, activePage.id, section.id)) },
    ]);
  }

  async function archiveProject() {
    if (!draft || !userId || operationLockRef.current) return;
    const sequence = lifecycleSequenceRef.current;
    const requestUserId = userId;
    const projectId = draft.id;
    operationLockRef.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await archiveMobileWebsiteProject(projectId);
      if (!isCurrentProject(sequence, requestUserId, projectId)) return;
      await loadProjects();
      if (!isCurrentAccount(sequence, requestUserId)) return;
      setMessage('Website archived.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (caught) {
      if (isCurrentAccount(sequence, requestUserId)) {
        setError(errorText(caught));
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      if (isCurrentAccount(sequence, requestUserId)) {
        operationLockRef.current = false;
        setBusy(false);
      }
    }
  }

  function confirmArchive() {
    if (!draft || operationBusy) return;
    Alert.alert('Archive website?', 'The project will disappear from your active projects. This does not delete an already published site.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Archive', style: 'destructive', onPress: () => void archiveProject() },
    ]);
  }

  function refreshProjects() {
    if (operationBusy) return;
    if (!dirty) {
      void loadProjects(selectedIdRef.current);
      return;
    }
    Alert.alert('Discard unsaved changes?', 'Reloading websites will replace your current unsaved edits with the cloud version.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Reload and discard', style: 'destructive', onPress: () => void loadProjects(selectedIdRef.current) },
    ]);
  }

  async function openPublishedSite() {
    const url = String(draft?.content.publishedUrl || '').trim();
    if (!url) return;
    try {
      await WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET });
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 44 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}><MaterialCommunityIcons name="web" size={26} color="#C4B5FD" /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Website Builder</Text>
          <Text style={styles.subtitle}>A mobile-first editor for the same Tayar website projects you use on the web.</Text>
        </View>
      </View>

      <View style={styles.safeCard}>
        <MaterialCommunityIcons name="shield-check-outline" size={20} color="#86EFAC" />
        <Text style={styles.safeText}>Native publishing now uses preflight validation, a live-file snapshot, upload verification and automatic rollback. Advanced web-only layouts are blocked from mobile publish instead of being rendered incorrectly.</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}

      <View style={styles.createCard}>
        <Text style={styles.sectionHeading}>New website</Text>
        <TextInput editable={!operationBusy} value={newProjectName} onChangeText={setNewProjectName} placeholder="Business or website name" placeholderTextColor={colors.muted} style={styles.input} maxLength={120} />
        <Pressable disabled={!newProjectName.trim() || operationBusy} onPress={() => void createProject()} style={[styles.primaryButton, (!newProjectName.trim() || operationBusy) && styles.disabled]}>
          {busy && !draft ? <ActivityIndicator color={colors.white} /> : <MaterialCommunityIcons name="plus" size={20} color={colors.white} />}
          <Text style={styles.primaryText}>Create website</Text>
        </Pressable>
      </View>

      <View style={styles.headerRow}>
        <Text style={styles.sectionHeading}>Your websites</Text>
        <Pressable disabled={operationBusy} onPress={refreshProjects} style={[styles.iconButton, operationBusy && styles.disabled]}><MaterialCommunityIcons name="refresh" size={19} color={colors.text} /></Pressable>
      </View>
      {busy && !projects.length ? <View style={styles.loading}><ActivityIndicator color={colors.violetBright} /><Text style={styles.muted}>Loading websites…</Text></View> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.projectStrip}>
        {projects.map((row) => (
          <Pressable key={row.id} disabled={operationBusy} onPress={() => selectProject(row)} style={[styles.projectCard, selectedId === row.id && styles.projectActive, operationBusy && styles.disabled]}>
            <View style={styles.projectTop}><MaterialCommunityIcons name="web-box" size={21} color={selectedId === row.id ? '#DDD6FE' : colors.violetBright} /><View style={[styles.statusDot, row.status === 'completed' && styles.statusLive]} /></View>
            <Text numberOfLines={1} style={[styles.projectName, selectedId === row.id && styles.projectNameActive]}>{row.title}</Text>
            <Text style={styles.projectMeta}>{row.status === 'completed' ? 'Published' : 'Draft'} · {shortDate(row.updated_at)}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {draft ? <>
        <View style={styles.editorCard}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}><Text style={styles.sectionHeading}>Site settings</Text><Text style={styles.muted}>{dirty ? 'Unsaved changes' : 'Synced with cloud'}</Text></View>
            {dirty ? <View style={styles.unsavedBadge}><Text style={styles.unsavedText}>Unsaved</Text></View> : null}
          </View>
          <Text style={styles.label}>Project title</Text>
          <TextInput editable={!operationBusy} value={draft.title} onChangeText={(value) => mutateProject((project) => ({ ...project, title: value.slice(0, 120), content: { ...project.content, siteName: value.slice(0, 100), brand: { ...project.content.brand, name: value.slice(0, 100) }, updatedAt: new Date().toISOString() } }))} style={styles.input} />
          <Text style={styles.label}>Brand name</Text>
          <TextInput editable={!operationBusy} value={draft.content.brand.name} onChangeText={(value) => mutateContent((content) => ({ ...content, brand: { ...content.brand, name: value.slice(0, 120) }, updatedAt: new Date().toISOString() }))} style={styles.input} />
          <Text style={styles.label}>Primary color</Text>
          <View style={styles.colorRow}><View style={[styles.colorSwatch, { backgroundColor: draft.content.brand.colors.primary }]} /><TextInput editable={!operationBusy} autoCapitalize="none" value={draft.content.brand.colors.primary} onChangeText={(value) => mutateContent((content) => ({ ...content, brand: { ...content.brand, colors: { ...content.brand.colors, primary: value.slice(0, 30) } }, updatedAt: new Date().toISOString() }))} style={[styles.input, { flex: 1, marginTop: 0 }]} /></View>
          <Text style={styles.label}>SEO title</Text>
          <TextInput editable={!operationBusy} value={draft.content.seo.title} onChangeText={(value) => mutateContent((content) => ({ ...content, seo: { ...content.seo, title: value.slice(0, 180) }, updatedAt: new Date().toISOString() }))} style={styles.input} />
          <Text style={styles.label}>SEO description</Text>
          <TextInput editable={!operationBusy} value={draft.content.seo.description} onChangeText={(value) => mutateContent((content) => ({ ...content, seo: { ...content.seo, description: value.slice(0, 500) }, updatedAt: new Date().toISOString() }))} style={[styles.input, styles.multiline]} multiline textAlignVertical="top" />
        </View>

        <View style={styles.aiCard}>
          <View style={styles.aiTitleRow}><View style={styles.sparkIcon}><MaterialCommunityIcons name="creation" size={20} color="#E9D5FF" /></View><View style={{ flex: 1 }}><Text style={styles.sectionHeading}>Build with Tayar AI</Text><Text style={styles.muted}>AI writes controlled copy; Tayar constructs the project schema locally.</Text></View></View>
          <TextInput editable={!operationBusy} value={brief} onChangeText={setBrief} placeholder="Example: Modern Swedish cleaning company in Falköping, trustworthy, clear pricing, booking CTA…" placeholderTextColor={colors.muted} style={[styles.input, styles.briefInput]} multiline textAlignVertical="top" maxLength={6000} />
          <Pressable disabled={!brief.trim() || operationBusy} onPress={() => void runAI()} style={[styles.aiButton, (!brief.trim() || operationBusy) && styles.disabled]}>{aiBusy ? <ActivityIndicator color={colors.white} /> : <MaterialCommunityIcons name="creation" size={20} color={colors.white} />}<Text style={styles.primaryText}>{aiBusy ? 'Building draft…' : 'Generate mobile draft'}</Text></Pressable>
        </View>

        <Text style={styles.sectionHeading}>Pages</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pageStrip}>
          {draft.content.pages.map((page) => <Pressable key={page.id} disabled={operationBusy} onPress={() => selectPage(page.id)} style={[styles.pageChip, page.id === activePage?.id && styles.pageActive]}><MaterialCommunityIcons name="file-document-outline" size={16} color={page.id === activePage?.id ? '#E9D5FF' : colors.muted} /><Text style={[styles.pageText, page.id === activePage?.id && styles.pageTextActive]}>{page.name}</Text></Pressable>)}
        </ScrollView>

        {activePage ? <>
          <View style={styles.headerRow}><View><Text style={styles.sectionHeading}>{activePage.name} sections</Text><Text style={styles.muted}>{activePage.sections.length} sections</Text></View><Pressable disabled={operationBusy} onPress={() => setAddingSection((value) => !value)} style={[styles.addButton, operationBusy && styles.disabled]}><MaterialCommunityIcons name={addingSection ? 'close' : 'plus'} size={18} color="#DDD6FE" /><Text style={styles.addText}>{addingSection ? 'Close' : 'Add'}</Text></Pressable></View>
          {addingSection ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeStrip}>{sectionTypes.map((type) => <Pressable key={type} disabled={operationBusy} onPress={() => addSection(type)} style={styles.typeChip}><MaterialCommunityIcons name={sectionIcon(type) as never} size={17} color={colors.violetBright} /><Text style={styles.typeText}>{type}</Text></Pressable>)}</ScrollView> : null}

          <View style={styles.sectionList}>{activePage.sections.map((section, index) => <View key={section.id} style={styles.sectionCard}>
            <View style={styles.sectionCardHeader}><View style={styles.sectionNumber}><Text style={styles.sectionNumberText}>{index + 1}</Text></View><View style={{ flex: 1 }}><Text style={styles.sectionType}>{section.type.toUpperCase()}</Text><Text numberOfLines={1} style={styles.sectionTitle}>{section.title || 'Untitled section'}</Text></View>{activePage.sections.length > 1 ? <Pressable disabled={operationBusy} onPress={() => confirmRemoveSection(section)} style={[styles.iconButton, operationBusy && styles.disabled]}><MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.danger} /></Pressable> : null}</View>
            <Text style={styles.label}>Heading</Text><TextInput editable={!operationBusy} value={section.title} onChangeText={(value) => updateSection(section, 'title', value)} style={styles.input} maxLength={180} />
            <Text style={styles.label}>Description</Text><TextInput editable={!operationBusy} value={section.description} onChangeText={(value) => updateSection(section, 'description', value)} style={[styles.input, styles.multiline]} multiline textAlignVertical="top" maxLength={2000} />
            <View style={styles.twoCol}><View style={{ flex: 1 }}><Text style={styles.label}>Button text</Text><TextInput editable={!operationBusy} value={section.buttonText} onChangeText={(value) => updateSection(section, 'buttonText', value)} style={styles.input} maxLength={100} /></View><View style={{ flex: 1 }}><Text style={styles.label}>Button link</Text><TextInput editable={!operationBusy} value={section.buttonUrl} onChangeText={(value) => updateSection(section, 'buttonUrl', value)} style={styles.input} autoCapitalize="none" maxLength={1000} /></View></View>
            <View style={[styles.previewSection, { backgroundColor: section.background || '#111827' }]}><Text style={[styles.previewHeading, { color: '#ffffff' }]}>{section.title || section.type}</Text><Text style={styles.previewText}>{section.description}</Text>{section.buttonText ? <View style={[styles.previewButton, { backgroundColor: section.accent || draft.content.brand.colors.primary }]}><Text style={styles.previewButtonText}>{section.buttonText}</Text></View> : null}</View>
          </View>)}</View>
        </> : null}

        <View style={styles.actionsCard}>
          <Pressable disabled={!dirty || operationBusy} onPress={() => void saveProject()} style={[styles.primaryButton, (!dirty || operationBusy) && styles.disabled]}>{busy ? <ActivityIndicator color={colors.white} /> : <MaterialCommunityIcons name="cloud-upload-outline" size={20} color={colors.white} />}<Text style={styles.primaryText}>{busy ? 'Saving…' : 'Save to Tayar Cloud'}</Text></Pressable>

          <View style={styles.publishState}>
            <View style={[styles.statusDot, isPublished ? styles.statusLive : styles.statusDraft]} />
            <View style={{ flex: 1 }}><Text style={styles.publishStateTitle}>{isPublished ? 'LIVE' : 'DRAFT'}</Text><Text style={styles.publishStateText}>{isPublished ? 'A verified public URL is saved for this project.' : 'The website is saved privately until you publish it.'}</Text></View>
          </View>

          {!canPublish ? <View style={styles.publishNote}><MaterialCommunityIcons name="lock-outline" size={18} color={colors.muted} /><Text style={styles.publishNoteText}>Only the project owner can publish or unpublish a shared website.</Text></View> : null}

          <Pressable disabled={!canPublish || operationBusy} onPress={confirmPublish} style={[styles.publishButton, (!canPublish || operationBusy) && styles.disabled]}>{publishBusy ? <ActivityIndicator color={colors.white} /> : <MaterialCommunityIcons name="earth" size={20} color={colors.white} />}<Text style={styles.primaryText}>{publishBusy ? 'Publishing safely…' : isPublished ? 'Publish changes' : 'Publish website'}</Text></Pressable>

          {draft.content.publishedUrl ? <Pressable disabled={operationBusy} onPress={() => void openPublishedSite()} style={[styles.secondaryButton, operationBusy && styles.disabled]}><MaterialCommunityIcons name="open-in-new" size={19} color="#DDD6FE" /><Text style={styles.secondaryText}>Open published site</Text></Pressable> : null}

          {isPublished ? <Pressable disabled={!canPublish || operationBusy} onPress={confirmUnpublish} style={[styles.unpublishButton, (!canPublish || operationBusy) && styles.disabled]}><MaterialCommunityIcons name="web-off" size={19} color="#FCA5A5" /><Text style={styles.unpublishText}>Unpublish website</Text></Pressable> : null}

          <View style={styles.publishNote}><MaterialCommunityIcons name="shield-check-outline" size={18} color="#86EFAC" /><Text style={styles.publishSafeText}>If a site contains advanced web-only elements or containers, mobile publish stops before touching live storage. Use the web builder for those releases.</Text></View>

          <Pressable disabled={operationBusy} onPress={confirmArchive} style={[styles.dangerButton, operationBusy && styles.disabled]}><MaterialCommunityIcons name="archive-outline" size={19} color={colors.danger} /><Text style={styles.dangerText}>Archive project</Text></Pressable>
        </View>
      </> : projects.length === 0 && !busy ? <View style={styles.empty}><MaterialCommunityIcons name="web-plus" size={34} color={colors.muted} /><Text style={styles.emptyTitle}>Create your first website</Text><Text style={styles.emptyText}>Start with the form above, then build the copy manually or with Tayar AI.</Text></View> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg }, content: { paddingHorizontal: 16, paddingTop: 10 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: radius.lg, borderWidth: 1, borderColor: '#46346A', backgroundColor: '#151120', padding: 16 },
  heroIcon: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.violetSoft },
  title: { color: colors.text, fontSize: 21, fontWeight: '900' }, subtitle: { color: colors.muted, fontSize: 11.5, lineHeight: 17, marginTop: 3 },
  safeCard: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', marginTop: 12, borderRadius: radius.md, borderWidth: 1, borderColor: '#22543D', backgroundColor: '#0C1D17', padding: 12 }, safeText: { flex: 1, color: '#8FD7AE', fontSize: 10.5, lineHeight: 16 },
  error: { color: colors.danger, fontSize: 12, lineHeight: 18, marginTop: 12 }, message: { color: '#86EFAC', fontSize: 12, lineHeight: 18, marginTop: 12 }, muted: { color: colors.muted, fontSize: 10.5, lineHeight: 15 },
  createCard: { marginTop: 16, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, padding: 14 }, sectionHeading: { color: colors.text, fontSize: 14, fontWeight: '900' },
  input: { minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panelSoft, color: colors.text, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, marginTop: 7 }, multiline: { minHeight: 82 }, briefInput: { minHeight: 116, marginTop: 13 }, label: { color: '#B8B5C8', fontSize: 10.5, fontWeight: '800', marginTop: 12 },
  primaryButton: { minHeight: 48, borderRadius: radius.md, backgroundColor: colors.violet, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 11 }, primaryText: { color: colors.white, fontSize: 13, fontWeight: '900' }, disabled: { opacity: 0.42 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 19, marginBottom: 9 }, iconButton: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panelSoft, alignItems: 'center', justifyContent: 'center' },
  loading: { minHeight: 90, alignItems: 'center', justifyContent: 'center', gap: 8 },
  projectStrip: { gap: 9, paddingRight: 18 }, projectCard: { width: 172, minHeight: 98, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, padding: 12 }, projectActive: { borderColor: colors.violet, backgroundColor: '#201833' }, projectTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, statusDot: { width: 8, height: 8, borderRadius: 99, backgroundColor: '#64748B' }, statusLive: { backgroundColor: '#34D399' }, statusDraft: { backgroundColor: '#64748B' }, projectName: { color: colors.text, fontSize: 13.5, fontWeight: '900', marginTop: 10 }, projectNameActive: { color: '#E9D5FF' }, projectMeta: { color: colors.muted, fontSize: 9.5, marginTop: 5 },
  editorCard: { marginTop: 18, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, padding: 14 }, unsavedBadge: { borderRadius: 99, backgroundColor: '#3A2510', paddingHorizontal: 8, paddingVertical: 4 }, unsavedText: { color: '#FBBF24', fontSize: 9, fontWeight: '900' }, colorRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 7 }, colorSwatch: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, borderColor: '#FFFFFF33' },
  aiCard: { marginTop: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: '#523685', backgroundColor: '#191126', padding: 14 }, aiTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, sparkIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#382255' }, aiButton: { minHeight: 48, borderRadius: radius.md, backgroundColor: '#7C3AED', marginTop: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  pageStrip: { gap: 8, paddingVertical: 8, paddingRight: 18 }, pageChip: { minHeight: 40, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 7 }, pageActive: { borderColor: colors.violet, backgroundColor: colors.violetSoft }, pageText: { color: colors.muted, fontSize: 11, fontWeight: '800' }, pageTextActive: { color: '#E9D5FF' },
  addButton: { minHeight: 38, borderRadius: 12, backgroundColor: colors.violetSoft, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 5 }, addText: { color: '#DDD6FE', fontSize: 11, fontWeight: '900' }, typeStrip: { gap: 8, paddingBottom: 11, paddingRight: 18 }, typeChip: { minHeight: 42, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }, typeText: { color: colors.text, fontSize: 10.5, fontWeight: '800', textTransform: 'capitalize' },
  sectionList: { gap: 11 }, sectionCard: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, padding: 13 }, sectionCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 }, sectionNumber: { width: 32, height: 32, borderRadius: 11, backgroundColor: colors.violetSoft, alignItems: 'center', justifyContent: 'center' }, sectionNumberText: { color: colors.violetBright, fontSize: 11, fontWeight: '900' }, sectionType: { color: colors.violetBright, fontSize: 8.5, fontWeight: '900', letterSpacing: 1.2 }, sectionTitle: { color: colors.text, fontSize: 13, fontWeight: '900', marginTop: 2 }, twoCol: { flexDirection: 'row', gap: 8 },
  previewSection: { marginTop: 13, minHeight: 135, borderRadius: 16, padding: 16, alignItems: 'center', justifyContent: 'center' }, previewHeading: { fontSize: 18, fontWeight: '900', textAlign: 'center' }, previewText: { color: '#CBD5E1', fontSize: 10.5, lineHeight: 15, textAlign: 'center', marginTop: 6 }, previewButton: { borderRadius: 10, paddingHorizontal: 13, paddingVertical: 8, marginTop: 12 }, previewButtonText: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '900' },
  actionsCard: { marginTop: 16, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, padding: 14 },
  publishState: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panelSoft, padding: 11 }, publishStateTitle: { color: colors.text, fontSize: 10.5, fontWeight: '900' }, publishStateText: { color: colors.muted, fontSize: 9.5, lineHeight: 14, marginTop: 2 },
  publishButton: { minHeight: 48, borderRadius: radius.md, backgroundColor: '#0EA5E9', marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryButton: { minHeight: 46, borderRadius: radius.md, borderWidth: 1, borderColor: '#4A356F', backgroundColor: colors.violetSoft, marginTop: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, secondaryText: { color: '#DDD6FE', fontSize: 12, fontWeight: '900' },
  unpublishButton: { minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: '#6B3038', backgroundColor: '#251116', marginTop: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, unpublishText: { color: '#FCA5A5', fontSize: 12, fontWeight: '900' },
  publishNote: { flexDirection: 'row', gap: 8, marginTop: 10, borderRadius: radius.md, backgroundColor: colors.panelSoft, padding: 11 }, publishNoteText: { flex: 1, color: colors.muted, fontSize: 10.5, lineHeight: 16 }, publishSafeText: { flex: 1, color: '#8FD7AE', fontSize: 10.5, lineHeight: 16 }, dangerButton: { minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: '#4B2430', backgroundColor: '#1E1116', marginTop: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, dangerText: { color: colors.danger, fontSize: 12, fontWeight: '900' },
  empty: { marginTop: 20, minHeight: 180, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, padding: 22 }, emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '900', marginTop: 9 }, emptyText: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 5 },
});
