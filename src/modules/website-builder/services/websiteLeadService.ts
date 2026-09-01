import { supabase } from '@/lib/supabase';

export async function listWebsiteLeads(projectId: string) {
  return supabase
    .from('website_leads')
    .select('id, project_id, user_id, name, email, message, form_data, page_path, status, stage, priority, tags, notes, updated_at, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(100);
}

export async function updateWebsiteLeadStatus(input: {
  leadId: string;
  projectId: string;
  ownerId: string;
  status: 'new' | 'read' | 'archived';
  updatedAt: string;
}) {
  return supabase
    .from('website_leads')
    .update({ status: input.status, updated_at: input.updatedAt })
    .eq('id', input.leadId)
    .eq('project_id', input.projectId)
    .eq('user_id', input.ownerId);
}

export async function updateWebsiteLeadCrm(input: {
  leadId: string;
  projectId: string;
  ownerId: string;
  updates: Record<string, unknown>;
}) {
  return supabase
    .from('website_leads')
    .update(input.updates)
    .eq('id', input.leadId)
    .eq('project_id', input.projectId)
    .eq('user_id', input.ownerId);
}

export async function bulkUpdateWebsiteLeadStage(input: {
  leadIds: string[];
  projectId: string;
  ownerId: string;
  stage: string;
  updatedAt: string;
}) {
  return supabase
    .from('website_leads')
    .update({ stage: input.stage, updated_at: input.updatedAt })
    .eq('project_id', input.projectId)
    .eq('user_id', input.ownerId)
    .in('id', input.leadIds);
}

export async function deleteWebsiteLead(input: {
  leadId: string;
  projectId: string;
  ownerId: string;
}) {
  return supabase
    .from('website_leads')
    .delete()
    .eq('id', input.leadId)
    .eq('project_id', input.projectId)
    .eq('user_id', input.ownerId);
}
