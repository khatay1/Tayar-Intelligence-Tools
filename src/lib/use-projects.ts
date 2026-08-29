import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';

export interface Project {
  id: string;
  user_id: string;
  title: string;
  type: string;
  content: Record<string, unknown>;
  status: string;
  created_at: string;
  updated_at: string;
}

export function useProjects() {
  const { success, error, loading, update } = useToast();
  const [saving, setSaving] = useState(false);

  // Create a new project. Returns the project id or null on failure.
  const createProject = useCallback(async (
    userId: string,
    title: string,
    type: string,
    content: Record<string, unknown> = {},
    status = 'draft'
  ): Promise<string | null> => {
    const { data, error: err } = await supabase
      .from('projects')
      .insert({ user_id: userId, title, type, content, status })
      .select('id')
      .single();
    if (err) {
      error('Failed to create project');
      return null;
    }
    return data?.id ?? null;
  }, [error]);

  // Auto-save: update an existing project's content + title.
  const saveProject = useCallback(async (
    projectId: string,
    updates: { title?: string; content?: Record<string, unknown>; status?: string }
  ): Promise<boolean> => {
    setSaving(true);
    const { error: err } = await supabase
      .from('projects')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', projectId);
    setSaving(false);
    if (err) {
      error('Failed to save');
      return false;
    }
    return true;
  }, [error]);

  // Save with toast feedback (used by Save Draft buttons)
  const saveProjectWithToast = useCallback(async (
    projectId: string,
    updates: { title?: string; content?: Record<string, unknown>; status?: string },
    successMsg = 'Draft saved successfully'
  ): Promise<boolean> => {
    const toastId = loading('Saving...');
    const ok = await saveProject(projectId, updates);
    if (ok) {
      update(toastId, successMsg, 'success');
      // Also log activity
      await supabase.from('activity_log').insert({
        action: `Saved ${updates.title || 'project'}`,
        tool: updates.title || 'workspace',
      });
    } else {
      update(toastId, 'Failed to save', 'error');
    }
    return ok;
  }, [loading, saveProject, update]);

  // Delete a project
  const deleteProject = useCallback(async (projectId: string): Promise<boolean> => {
    const toastId = loading('Deleting...');
    const { error: err } = await supabase.from('projects').delete().eq('id', projectId);
    if (err) {
      update(toastId, 'Failed to delete', 'error');
      return false;
    }
    update(toastId, 'Project deleted', 'success');
    return true;
  }, [loading, update]);

  // Rename a project
  const renameProject = useCallback(async (projectId: string, newTitle: string): Promise<boolean> => {
    const { error: err } = await supabase
      .from('projects')
      .update({ title: newTitle, updated_at: new Date().toISOString() })
      .eq('id', projectId);
    if (err) {
      error('Failed to rename');
      return false;
    }
    success('Project renamed');
    return true;
  }, [success, error]);

  // Duplicate a project
  const duplicateProject = useCallback(async (project: Project): Promise<string | null> => {
    const toastId = loading('Duplicating...');
    const { data, error: err } = await supabase
      .from('projects')
      .insert({
        user_id: project.user_id,
        title: `${project.title} (Copy)`,
        type: project.type,
        content: project.content,
        status: 'draft',
      })
      .select('id')
      .single();
    if (err || !data) {
      update(toastId, 'Failed to duplicate', 'error');
      return null;
    }
    update(toastId, 'Project duplicated', 'success');
    return data.id;
  }, [loading, update]);

  // Create a file entry linked to a project (for "My Files")
  const createFileEntry = useCallback(async (
    userId: string,
    projectId: string,
    filename: string,
    fileType: string
  ): Promise<void> => {
    await supabase.from('workspace_files').insert({
      user_id: userId,
      project_id: projectId,
      name: filename,
      type: fileType,
      status: 'completed',
    });
  }, []);

  // Log activity
  const logActivity = useCallback(async (action: string, tool: string): Promise<void> => {
    await supabase.from('activity_log').insert({ action, tool });
  }, []);

  return {
    saving,
    createProject,
    saveProject,
    saveProjectWithToast,
    deleteProject,
    renameProject,
    duplicateProject,
    createFileEntry,
    logActivity,
  };
}
