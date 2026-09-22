import { supabase } from '@/lib/supabase';
import { normalizeEditorPublishPlan, validateEditorPublishPlan, type EditorPublishPlan } from '../core/editor-publishing';

export type WebsitePublishScheduleStatus = 'scheduled' | 'processing' | 'published' | 'failed' | 'cancelled';

export interface WebsitePublishSchedule {
  id: string;
  projectId: string;
  ownerId: string;
  plan: EditorPublishPlan;
  status: WebsitePublishScheduleStatus;
  createdAt: string;
  updatedAt: string;
  lastError?: string;
}

export async function listWebsitePublishSchedules(projectId: string, ownerId: string) {
  return supabase
    .from('website_publish_schedules')
    .select('id, project_id, user_id, environment, mode, page_ids, scheduled_at, release_note, status, last_error, created_at, updated_at')
    .eq('project_id', projectId)
    .eq('user_id', ownerId)
    .order('scheduled_at', { ascending: true });
}

export async function createWebsitePublishSchedule(input: {
  id: string;
  projectId: string;
  ownerId: string;
  plan: Partial<EditorPublishPlan>;
  allPageIds: string[];
}) {
  const plan = normalizeEditorPublishPlan(input.plan, input.allPageIds);
  const errors = validateEditorPublishPlan(plan);
  if (!plan.scheduledAt) errors.push('Scheduled publishing requires a future date and time.');
  if (errors.length) return { data: null, error: new Error(errors.join(' ')) };
  return supabase.from('website_publish_schedules').insert({
    id: input.id,
    project_id: input.projectId,
    user_id: input.ownerId,
    environment: plan.environment,
    mode: plan.mode,
    page_ids: plan.pageIds,
    scheduled_at: plan.scheduledAt,
    release_note: plan.releaseNote,
    status: 'scheduled',
  }).select('id').single();
}

export async function cancelWebsitePublishSchedule(input: { id: string; projectId: string; ownerId: string }) {
  return supabase
    .from('website_publish_schedules')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', input.id)
    .eq('project_id', input.projectId)
    .eq('user_id', input.ownerId)
    .eq('status', 'scheduled')
    .select('id')
    .single();
}

export async function rescheduleWebsitePublish(input: {
  id: string;
  projectId: string;
  ownerId: string;
  scheduledAt: string;
}) {
  const timestamp = Date.parse(input.scheduledAt);
  if (!Number.isFinite(timestamp) || timestamp <= Date.now()) return { data: null, error: new Error('Scheduled publish time must be in the future.') };
  return supabase
    .from('website_publish_schedules')
    .update({ scheduled_at: new Date(timestamp).toISOString(), status: 'scheduled', last_error: null, updated_at: new Date().toISOString() })
    .eq('id', input.id)
    .eq('project_id', input.projectId)
    .eq('user_id', input.ownerId)
    .in('status', ['scheduled', 'failed'])
    .select('id')
    .single();
}
