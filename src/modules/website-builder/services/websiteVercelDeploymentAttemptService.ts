import type { SupabaseClient } from '@supabase/supabase-js';
import type { OwnedVercelDeploymentReport } from '../../../../server/website-owned-vercel-deployment';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const providerProject = /^prj_[A-Za-z0-9]{8,128}$/;
const providerDeployment = /^dpl_[A-Za-z0-9]{8,128}$/;
const sha = /^[0-9a-f]{40}$/;
const env = /^[A-Z][A-Z0-9_]{1,99}$/;
const observedState = /^[A-Z_]{3,40}$/;
const liveUrl = /^https:\/\/[a-z0-9-]+[.]vercel[.]app$/;
const statuses = new Set(['connecting', 'setup-incomplete', 'deployment-failed', 'ready']);

function validateReport(report: OwnedVercelDeploymentReport): string[] {
  const missing = [...report.missingEnvironment].sort();
  const hasValidMissing = missing.length <= 64
    && missing.every(key => env.test(key))
    && new Set(missing).size === missing.length;
  const hasValidLiveUrl = report.status === 'ready'
    ? missing.length === 0 && typeof report.liveUrl === 'string' && liveUrl.test(report.liveUrl)
    : report.liveUrl === null;
  if (!statuses.has(report.status) || !providerDeployment.test(report.deploymentId)
    || !observedState.test(report.observedState) || !hasValidMissing || !hasValidLiveUrl
    || (report.status === 'setup-incomplete' && missing.length === 0)) {
    throw new Error('Vercel deployment observation unavailable.');
  }
  return missing;
}

export async function beginWebsiteVercelDeploymentAttempt(input: {
  client: Pick<SupabaseClient, 'rpc'>; connectionId: string; projectId: string; ownerId: string;
  connectionVersion: number; expectedAttemptVersion: number; vercelProjectId: string;
  repositoryId: string; sourceCommitSha: string; target: 'preview' | 'production';
  requiredEnvironment: string[]; operationId: string; isCurrent(): boolean;
}): Promise<number> {
  const required = [...input.requiredEnvironment].sort();
  if (typeof window !== 'undefined' || ![input.connectionId,input.projectId,input.ownerId,input.operationId].every(value => uuid.test(value))
    || !Number.isSafeInteger(input.connectionVersion) || input.connectionVersion<1
    || !Number.isSafeInteger(input.expectedAttemptVersion) || input.expectedAttemptVersion<0
    || !providerProject.test(input.vercelProjectId) || !/^\d+$/.test(input.repositoryId)
    || !sha.test(input.sourceCommitSha) || !['preview','production'].includes(input.target)
    || required.length>64 || required.some(key => !env.test(key))
    || new Set(required).size!==required.length || !input.isCurrent()) throw new Error('Vercel deployment attempt unavailable.');
  const { data, error } = await input.client.rpc('website_begin_vercel_deployment_attempt', {
    p_connection_id: input.connectionId,p_project_id: input.projectId,p_owner_id: input.ownerId,
    p_connection_version: input.connectionVersion,p_expected_attempt_version: input.expectedAttemptVersion,
    p_vercel_project_id: input.vercelProjectId,p_repository_id: input.repositoryId,
    p_source_commit_sha: input.sourceCommitSha,p_target: input.target,
    p_required_environment: required,p_operation_id: input.operationId,
  });
  if (error || !Number.isSafeInteger(data) || data<1 || !input.isCurrent()) throw new Error('Vercel deployment attempt unavailable.');
  return data;
}

export async function commitWebsiteVercelDeploymentObservation(input: {
  client: Pick<SupabaseClient, 'rpc'>; connectionId: string; projectId: string; ownerId: string;
  expectedAttemptVersion: number; operationId: string; commitId: string;
  report: OwnedVercelDeploymentReport; isCurrent(): boolean;
}): Promise<{ attemptVersion: number; connectionVersion: number }> {
  const missingEnvironment = validateReport(input.report);
  if (typeof window !== 'undefined' || ![input.connectionId,input.projectId,input.ownerId,input.operationId,input.commitId].every(value => uuid.test(value))
    || !Number.isSafeInteger(input.expectedAttemptVersion) || input.expectedAttemptVersion<1
    || !input.isCurrent()) throw new Error('Vercel deployment observation unavailable.');
  const args = { p_connection_id: input.connectionId,p_project_id: input.projectId,p_owner_id: input.ownerId,
    p_expected_attempt_version: input.expectedAttemptVersion,p_operation_id: input.operationId,
    p_deployment_id: input.report.deploymentId,p_status: input.report.status,
    p_observed_state: input.report.observedState,p_missing_environment: missingEnvironment,
    p_live_url: input.report.liveUrl,p_commit_id: input.commitId };
  const reconcile = async () => {
    const { data, error } = await input.client.rpc('website_reconcile_vercel_deployment_observation', {
      p_connection_id: input.connectionId,p_project_id: input.projectId,p_owner_id: input.ownerId,
      p_expected_attempt_version: input.expectedAttemptVersion,p_operation_id: input.operationId,
      p_deployment_id: input.report.deploymentId,p_status: input.report.status,
      p_observed_state: input.report.observedState,p_missing_environment: missingEnvironment,
      p_live_url: input.report.liveUrl,p_commit_id: input.commitId });
    if (error || !input.isCurrent()) throw new Error(); return data;
  };
  try {
    const { data, error } = await input.client.rpc('website_commit_vercel_deployment_observation', args);
    if (!error && data && data.attemptVersion===input.expectedAttemptVersion+1
      && Number.isSafeInteger(data.connectionVersion) && input.isCurrent()) return data;
    const recovered = await reconcile();
    if (recovered?.attemptVersion===input.expectedAttemptVersion+1
      && Number.isSafeInteger(recovered.connectionVersion)) return recovered;
  } catch {
    try { const recovered=await reconcile(); if (recovered?.attemptVersion===input.expectedAttemptVersion+1
      && Number.isSafeInteger(recovered.connectionVersion)) return recovered; } catch { /* safe error */ }
  }
  throw new Error('Vercel deployment observation unavailable.');
}
