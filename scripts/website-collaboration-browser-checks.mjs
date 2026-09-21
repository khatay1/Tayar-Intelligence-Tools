import assert from 'node:assert/strict';
import { build } from 'esbuild';

export async function runCollaborationBrowserChecks(evaluate, waitFor) {
  const fixture = `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { WebsiteCollaborationPanel } from './src/modules/website-builder/v2-ui/WebsiteCollaborationPanel';
    const state = window.collabTest = { pending: [], channels: [], comments: 0, presence: 0, heartbeats: 0, delay: true, failMutation: false };
    state.comment = (body) => ({ id: body, projectId: body, userId: 'user', authorName: 'Author', body, anchor: {}, createdAt: new Date().toISOString(), resolvedAt: null });
    state.list = (project, resolved) => {
      state.comments++;
      return state.delay ? new Promise(resolve => state.pending.push({ project, resolved, resolve })) : Promise.resolve({ data: [state.comment(project)], error: null });
    };
    state.supabase = {
      channel() {
        const channel = { handlers: [], on(_, filter, callback) { this.handlers.push({ filter, callback }); return this; }, subscribe() { return this; } };
        state.channels.push(channel); return channel;
      },
      removeChannel(channel) { state.channels = state.channels.filter(item => item !== channel); },
    };
    const host = document.createElement('div'); document.body.append(host);
    const root = createRoot(host);
    state.mount = (projectId, elementId = 'one') => root.render(React.createElement(WebsiteCollaborationPanel, { projectId, elementId, canEdit: true, canManage: true, pageId: 'home', pageName: 'Home', darkMode: true, onNavigate() {} }));
    state.emit = table => state.channels.forEach(channel => channel.handlers.filter(({ filter }) => filter.table === table).forEach(({ callback }) => callback()));
    state.resolve = (index, text) => state.pending[index].resolve({ data: [state.comment(text)], error: null });
    state.close = () => { root.unmount(); host.remove(); };
    state.mount('project-a');
  `;
  const mocks = {
    '@/context/AuthContext': `export const useAuth = () => ({ user: { id: 'user', email: 'user@test.invalid', user_metadata: {} } });`,
    '@/lib/ui-localization': `export const useLocalizer = () => value => value;`,
    '@/lib/supabase': `export const supabase = { channel: (...args) => window.collabTest.supabase.channel(...args), removeChannel: (...args) => window.collabTest.supabase.removeChannel(...args) };`,
    '../services/websiteCollaborationService': `
      export const listWebsiteProjectComments = (...args) => window.collabTest.list(...args);
      export const listWebsiteProjectPresence = async () => { window.collabTest.presence++; return { data: [], error: null }; };
      export const heartbeatWebsiteProjectPresence = async () => { window.collabTest.heartbeats++; return { error: null }; };
      export const createWebsiteProjectComment = async () => ({ error: null });
      export const deleteWebsiteProjectComment = async () => ({ error: null });
      export const resolveWebsiteProjectComment = async () => { if (window.collabTest.failMutation) throw new Error('Temporary review failure'); return { error: null }; };
    `,
  };
  const output = await build({ stdin: { contents: fixture, resolveDir: process.cwd(), loader: 'tsx' },
    bundle: true, format: 'iife', platform: 'browser', write: false, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'collaboration-fixture', setup(builder) {
      builder.onResolve({ filter: /.*/ }, ({ path }) => path in mocks ? { path, namespace: 'fixture' } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ contents: mocks[path] }));
    } }],
  });
  await evaluate(output.outputFiles[0].text);
  await waitFor('first project request', 'window.collabTest.pending.length === 1');
  await evaluate(`collabTest.delay = false; collabTest.mount('project-b')`);
  await waitFor('new project request', 'collabTest.comments === 2');
  await evaluate(`document.querySelector('button[aria-label="Project collaboration"]').click()`);
  await waitFor('new project comment', `document.body.textContent.includes('project-b')`);
  await evaluate(`collabTest.resolve(0, 'STALE_PROJECT_A')`);
  await evaluate(`new Promise(resolve => setTimeout(resolve, 30))`);
  assert.equal(await evaluate(`document.body.textContent.includes('STALE_PROJECT_A')`), false);
  console.log('[browser] PASS collaboration project switch rejects delayed comments');

  await evaluate(`collabTest.delay = true; document.querySelector('[aria-label="Refresh"]').click()`);
  await waitFor('refresh pending', 'collabTest.pending.length === 2');
  await evaluate(`document.querySelector('section[aria-label="Project collaboration"] input[type="checkbox"]').click()`);
  await waitFor('filter pending', 'collabTest.pending.length === 3');
  await evaluate(`collabTest.resolve(2, 'LATEST_FILTER'); collabTest.resolve(1, 'STALE_FILTER')`);
  await waitFor('latest filter', `document.body.textContent.includes('LATEST_FILTER')`);
  assert.equal(await evaluate(`document.body.textContent.includes('STALE_FILTER')`), false);
  console.log('[browser] PASS collaboration filter rejects out-of-order responses');

  const before = await evaluate('({ comments: collabTest.comments, presence: collabTest.presence, heartbeats: collabTest.heartbeats })');
  await evaluate(`collabTest.emit('website_project_presence'); collabTest.mount('project-b', 'two')`);
  await waitFor('selection update', `collabTest.presence > ${before.presence}`);
  await evaluate(`new Promise(resolve => setTimeout(resolve, 30))`);
  assert.equal(await evaluate('collabTest.comments'), before.comments);
  assert.equal(await evaluate('collabTest.heartbeats'), before.heartbeats);
  console.log('[browser] PASS presence refresh avoids comment queries and selection heartbeat storms');

  await evaluate(`collabTest.failMutation = true; document.querySelector('button[title="Resolve"]').click()`);
  await waitFor('mutation failure', `document.body.textContent.includes('Temporary review failure')`);
  assert.equal(await evaluate(`document.querySelector('button[title="Resolve"]').disabled`), false);
  console.log('[browser] PASS rejected review mutation releases busy state');
  await evaluate('collabTest.close()');
}
