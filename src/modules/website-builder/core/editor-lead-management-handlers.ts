import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { LeadStage, WebsiteLead } from './website-builder-model';
import { getWebsiteLeadPhone, getWebsiteLeadSource } from './website-lead-utils';
import { createWebsiteFormUploadUrl, deleteWebsiteFormUploads } from '../services/websiteFormService';
import { bulkUpdateWebsiteLeadStage, deleteWebsiteLead, updateWebsiteLeadCrm, updateWebsiteLeadStatus, updateWebsiteLeadsByStatus } from '../services/websiteLeadService';

interface LeadManagementContext {
  user: { id: string } | null;
  cloudProjectId: string | null;
  projectTeamAccess: { canManage: boolean };
  activeProjectOwnerId: string;
  projectLoadSequenceRef: MutableRefObject<number>;
  activeUserIdRef: MutableRefObject<string | null>;
  leads: WebsiteLead[];
  selectedLeadIds: string[];
  setLeads: Dispatch<SetStateAction<WebsiteLead[]>>;
  setSelectedLeadIds: Dispatch<SetStateAction<string[]>>;
  setLeadsError: Dispatch<SetStateAction<string>>;
  l: (text: string) => string;
}

export function createLeadManagementHandlers({
  user,
  cloudProjectId,
  projectTeamAccess,
  activeProjectOwnerId,
  projectLoadSequenceRef,
  activeUserIdRef,
  leads,
  selectedLeadIds,
  setLeads,
  setSelectedLeadIds,
  setLeadsError,
  l,
}: LeadManagementContext) {
  async function updateLeadStatus(leadId: string, status: WebsiteLead['status']) {
    if (!user || !cloudProjectId || !projectTeamAccess.canManage) return;

    const updateLoadSequence = projectLoadSequenceRef.current;
    const updateUserId = user.id;
    const updateProjectId = cloudProjectId;
    const updateOwnerId = activeProjectOwnerId;
    const updateIsCurrent = () =>
      projectLoadSequenceRef.current === updateLoadSequence &&
      activeUserIdRef.current === updateUserId;
    const updatedAt = new Date().toISOString();

    const { error } = await updateWebsiteLeadStatus({
      leadId,
      projectId: updateProjectId,
      ownerId: updateOwnerId,
      status,
      updatedAt,
    });

    if (!updateIsCurrent()) return;

    if (error) {
      setLeadsError('Could not update this lead.');
      return;
    }

    setLeads((current) => current.map((lead) => lead.id === leadId ? { ...lead, status, updated_at: updatedAt } : lead));
  }

  async function updateLeadCrm(leadId: string, updates: Partial<Pick<WebsiteLead, 'stage' | 'priority' | 'tags' | 'notes'>>) {
    if (!user || !cloudProjectId || !projectTeamAccess.canManage) return;

    const updateLoadSequence = projectLoadSequenceRef.current;
    const updateUserId = user.id;
    const updateProjectId = cloudProjectId;
    const updateOwnerId = activeProjectOwnerId;
    const updateIsCurrent = () =>
      projectLoadSequenceRef.current === updateLoadSequence &&
      activeUserIdRef.current === updateUserId;
    const sanitized = {
      ...updates,
      ...(updates.tags ? { tags: updates.tags.map((tag) => tag.trim()).filter(Boolean).slice(0, 12) } : {}),
      ...(typeof updates.notes === 'string' ? { notes: updates.notes.slice(0, 4000) } : {}),
      updated_at: new Date().toISOString(),
    };

    const { error } = await updateWebsiteLeadCrm({
      leadId,
      projectId: updateProjectId,
      ownerId: updateOwnerId,
      updates: sanitized as Record<string, unknown>,
    });

    if (!updateIsCurrent()) return;

    if (error) {
      setLeadsError('Could not update CRM details for this lead.');
      return;
    }

    setLeads((current) => current.map((lead) => lead.id === leadId ? { ...lead, ...sanitized } : lead));
  }

  async function bulkUpdateLeadStage(stage: LeadStage) {
    if (!user || !cloudProjectId || !projectTeamAccess.canManage || !selectedLeadIds.length) return;

    const updateLoadSequence = projectLoadSequenceRef.current;
    const updateUserId = user.id;
    const updateProjectId = cloudProjectId;
    const updateOwnerId = activeProjectOwnerId;
    const updateIsCurrent = () =>
      projectLoadSequenceRef.current === updateLoadSequence &&
      activeUserIdRef.current === updateUserId;
    const ids = [...selectedLeadIds];
    const updatedAt = new Date().toISOString();

    const { error } = await bulkUpdateWebsiteLeadStage({
      leadIds: ids,
      projectId: updateProjectId,
      ownerId: updateOwnerId,
      stage,
      updatedAt,
    });

    if (!updateIsCurrent()) return;

    if (error) {
      setLeadsError('Could not update the selected leads.');
      return;
    }

    setLeads((current) => current.map((lead) => ids.includes(lead.id) ? { ...lead, stage, updated_at: updatedAt } : lead));
  }


  async function copyLeadSummary(lead: WebsiteLead) {
    const meta = getWebsiteLeadSource(lead);
    const phone = getWebsiteLeadPhone(lead);
    const lines = [
      `Lead: ${lead.name}`,
      lead.email ? `Email: ${lead.email}` : '',
      phone ? `Phone: ${phone}` : '',
      `Stage: ${lead.stage || 'new'}`,
      `Priority: ${Number(lead.priority || 0)}`,
      lead.tags?.length ? `Tags: ${lead.tags.join(', ')}` : '',
      meta.source ? `Source: ${meta.source}${meta.medium ? ` / ${meta.medium}` : ''}` : '',
      meta.campaign ? `Campaign: ${meta.campaign}` : '',
      lead.page_path ? `Page: ${lead.page_path}` : '',
      '',
      lead.message || '',
      lead.notes ? `\nNotes: ${lead.notes}` : '',
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
    } catch {
      window.alert(lines.join('\n'));
    }
  }

  async function deleteLead(leadId: string) {
    if (!user || !cloudProjectId || !projectTeamAccess.canManage) return;
    const confirmed = window.confirm(l('Delete this lead permanently?'));
    if (!confirmed) return;

    const deleteLoadSequence = projectLoadSequenceRef.current;
    const deleteUserId = user.id;
    const deleteProjectId = cloudProjectId;
    const deleteOwnerId = activeProjectOwnerId;
    const uploadPaths = leads.find((lead) => lead.id === leadId)?.files?.map((file) => file.path) || [];
    const deleteIsCurrent = () =>
      projectLoadSequenceRef.current === deleteLoadSequence &&
      activeUserIdRef.current === deleteUserId;

    const { error } = await deleteWebsiteLead({
      leadId,
      projectId: deleteProjectId,
      ownerId: deleteOwnerId,
    });

    if (!deleteIsCurrent()) return;

    if (error) {
      setLeadsError('Could not delete this lead.');
      return;
    }

    setLeads((current) => current.filter((lead) => lead.id !== leadId));
    setSelectedLeadIds((current) => current.filter((id) => id !== leadId));
    if (uploadPaths.length) {
      const cleanup = await deleteWebsiteFormUploads(uploadPaths);
      if (deleteIsCurrent() && cleanup.error) setLeadsError('The submission was deleted, but one or more private uploads need cleanup.');
    }
  }

  async function openWebsiteFormUpload(path: string) {
    const { data, error } = await createWebsiteFormUploadUrl(path);
    if (error || !data?.signedUrl) {
      setLeadsError('Could not open this private form upload.');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  async function markAllLeadsRead() {
    if (!user || !cloudProjectId || !projectTeamAccess.canManage) return;
    const newIds = leads.filter((lead) => lead.status === 'new').map((lead) => lead.id);
    if (!newIds.length) return;

    const updateLoadSequence = projectLoadSequenceRef.current;
    const updateUserId = user.id;
    const updateProjectId = cloudProjectId;
    const updateOwnerId = activeProjectOwnerId;
    const updateIsCurrent = () =>
      projectLoadSequenceRef.current === updateLoadSequence &&
      activeUserIdRef.current === updateUserId;

    const { error } = await updateWebsiteLeadsByStatus({
      projectId: updateProjectId,
      ownerId: updateOwnerId,
      fromStatus: 'new',
      toStatus: 'read',
      updatedAt: new Date().toISOString(),
    });

    if (!updateIsCurrent()) return;

    if (error) {
      setLeadsError('Could not mark all leads as read.');
      return;
    }

    setLeads((current) => current.map((lead) =>
      lead.status === 'new' ? { ...lead, status: 'read' } : lead
    ));
  }
  async function archiveReadLeads() {
    if (!user || !cloudProjectId || !projectTeamAccess.canManage) return;
    const readCount = leads.filter((lead) => lead.status === 'read').length;
    if (!readCount) return;

    const updateLoadSequence = projectLoadSequenceRef.current;
    const updateUserId = user.id;
    const updateProjectId = cloudProjectId;
    const updateOwnerId = activeProjectOwnerId;
    const updateIsCurrent = () =>
      projectLoadSequenceRef.current === updateLoadSequence &&
      activeUserIdRef.current === updateUserId;

    const { error } = await updateWebsiteLeadsByStatus({
      projectId: updateProjectId,
      ownerId: updateOwnerId,
      fromStatus: 'read',
      toStatus: 'archived',
      updatedAt: new Date().toISOString(),
    });

    if (!updateIsCurrent()) return;

    if (error) {
      setLeadsError('Could not archive read leads.');
      return;
    }

    setLeads((current) => current.map((lead) =>
      lead.status === 'read' ? { ...lead, status: 'archived' } : lead
    ));
  }

  return { updateLeadStatus, updateLeadCrm, bulkUpdateLeadStage, copyLeadSummary, deleteLead, openWebsiteFormUpload, markAllLeadsRead, archiveReadLeads };
}
