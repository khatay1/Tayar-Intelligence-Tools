import { supabase } from '@/lib/supabase';
import { CodePatchPlan } from './patch-plan';
import { validateControlledPackageOperation } from './package-editor';
import {
  applyFileOperations,
  FileRollbackEntry,
  fingerprintFileStore,
  inspectProjectFileStore,
  restoreFileOperations,
  FileWriteOperation,
} from './project-file-store';

interface StoredApply {
  id: string;
  componentId: string;
  summary: string;
  appliedAt: string;
  fingerprintBefore: string;
  fingerprintAfter: string;
  rollback: FileRollbackEntry[];
}

interface AssistantState {
  version: 1;
  lastApply?: StoredApply | null;
  lastRollbackAt?: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assistantState(content: Record<string, unknown>): AssistantState {
  const value = content._tayarCodeAssistant;
  if (!isRecord(value)) return { version: 1 };
  return {
    version: 1,
    lastApply: isRecord(value.lastApply) ? value.lastApply as unknown as StoredApply : null,
    lastRollbackAt: typeof value.lastRollbackAt === 'string' ? value.lastRollbackAt : null,
  };
}

function newApplyId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `apply-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function loadProject(projectId: string) {
  const { data, error } = await supabase
    .from('projects')
    .select('id, content, updated_at')
    .eq('id', projectId)
    .maybeSingle();

  if (error) throw new Error('Unable to load the project for apply.');
  if (!data) throw new Error('Project not found.');
  if (!isRecord(data.content)) throw new Error('Project content is not writable code-project data.');
  return data;
}

export async function applyCodePatch(
  projectId: string,
  expectedFingerprint: string,
  plan: CodePatchPlan,
  componentId: string,
  controlledPackageOperation: FileWriteOperation | null = null,
): Promise<{ applyId: string; fingerprintAfter: string }> {
  const data = await loadProject(projectId);
  const currentContent = data.content as Record<string, unknown>;
  const currentStore = inspectProjectFileStore(currentContent);

  if (currentStore.kind === 'unsupported') throw new Error('Safe Apply only supports projects with a recognized content.files store.');
  if (currentStore.fingerprint !== expectedFingerprint) {
    throw new Error('Project files changed since this patch was planned. Refresh project context and generate a new patch.');
  }

  if (controlledPackageOperation) {
    validateControlledPackageOperation(currentContent, controlledPackageOperation, plan.dependenciesToInstall);
  }
  const operations = controlledPackageOperation ? [...plan.operations, controlledPackageOperation] : plan.operations;
  const applied = applyFileOperations(currentContent, operations);
  const fingerprintAfter = fingerprintFileStore(applied.content.files);
  const applyId = newApplyId();
  const now = new Date().toISOString();
  const previousState = assistantState(currentContent);
  const nextState: AssistantState = {
    ...previousState,
    version: 1,
    lastApply: {
      id: applyId,
      componentId,
      summary: plan.summary,
      appliedAt: now,
      fingerprintBefore: currentStore.fingerprint,
      fingerprintAfter,
      rollback: applied.rollback,
    },
  };
  const nextContent = { ...applied.content, _tayarCodeAssistant: nextState };

  const { data: updated, error } = await supabase
    .from('projects')
    .update({ content: nextContent, updated_at: now })
    .eq('id', projectId)
    .eq('updated_at', data.updated_at)
    .select('id')
    .maybeSingle();

  if (error) throw new Error('Failed to apply the project patch.');
  if (!updated) throw new Error('Project changed during apply. No patch was written.');

  return { applyId, fingerprintAfter };
}

export async function rollbackCodePatch(
  projectId: string,
  expectedApplyId: string,
): Promise<void> {
  const data = await loadProject(projectId);
  const currentContent = data.content as Record<string, unknown>;
  const state = assistantState(currentContent);
  const lastApply = state.lastApply;

  if (!lastApply || lastApply.id !== expectedApplyId || !Array.isArray(lastApply.rollback)) {
    throw new Error('The requested rollback checkpoint is no longer available.');
  }

  const currentStore = inspectProjectFileStore(currentContent);
  if (currentStore.kind === 'unsupported') throw new Error('Project file store is no longer supported for rollback.');
  if (currentStore.fingerprint !== lastApply.fingerprintAfter) {
    throw new Error('Project files changed after the patch. Automatic rollback is blocked to protect newer work.');
  }

  const restored = restoreFileOperations(currentContent, lastApply.rollback);
  const now = new Date().toISOString();
  const nextContent = {
    ...restored,
    _tayarCodeAssistant: {
      ...state,
      version: 1,
      lastApply: null,
      lastRollbackAt: now,
    } satisfies AssistantState,
  };

  const { data: updated, error } = await supabase
    .from('projects')
    .update({ content: nextContent, updated_at: now })
    .eq('id', projectId)
    .eq('updated_at', data.updated_at)
    .select('id')
    .maybeSingle();

  if (error) throw new Error('Failed to rollback the project patch.');
  if (!updated) throw new Error('Project changed during rollback. No rollback was written.');
}
