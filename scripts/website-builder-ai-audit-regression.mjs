import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { build } from 'esbuild';

const result = await build({
  entryPoints: [resolve('src/modules/website-builder/core/editor-ai-candidate-audit.ts')],
  bundle: true, platform: 'node', format: 'esm', write: false,
});
const { updateSectionContent, validateAIProjectIntegrity, auditAIWebsiteCandidate } =
  await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString('base64')}`);

const section = {
  id: 'section-1', type: 'hero', title: 'Old title', description: 'Old description',
  buttonText: 'Learn more', buttonUrl: '/about', background: '#111111', accent: '#222222',
  containers: [],
  elements: [
    { id: 'heading-1', type: 'heading', content: 'Old title', style: {}, responsive: {} },
    { id: 'button-1', type: 'button', content: 'Learn more', href: 'page:missing', style: {}, responsive: {} },
  ],
};
const page = { id: 'page-1', name: 'Home', slug: 'home', sections: [section] };

assert.deepEqual(validateAIProjectIntegrity([page], page.id, []), []);
assert.ok(validateAIProjectIntegrity([page, { ...page, id: 'page-2' }], page.id, [])
  .some((message) => message.includes('Duplicate or missing section id')));
assert.ok(validateAIProjectIntegrity([page], 'missing-home', [])
  .some((message) => message.includes('selected home page')));
assert.ok(validateAIProjectIntegrity([{ ...page, sections: [{ ...section, elements: [{ ...section.elements[0], containerId: 'missing' }] }] }], page.id, [])
  .some((message) => message.includes('missing container')));

const updated = updateSectionContent(section, { title: 'New title', accent: '#AABBCC', buttonText: 'Read' });
assert.equal(updated.title, 'New title');
assert.equal(updated.elements[0].content, 'New title');
assert.equal(updated.elements[1].style.backgroundColor, '#AABBCC');
assert.equal(updated.elements[1].content, 'Read');
assert.equal(section.elements[0].content, 'Old title', 'source section remains unchanged');

const review = auditAIWebsiteCandidate([page], { title: '', description: '' }, {
  enabled: true, showCta: true, ctaLabel: '', ctaHref: '',
});
assert.ok(review.findings.some((finding) => finding.title === 'Button links to a missing page'));
assert.ok(review.findings.some((finding) => finding.title === 'Global SEO title is missing'));
assert.ok(review.score < 100);
assert.ok(review.fixPrompt?.includes('Button links to a missing page'));

console.log('PASS Website Builder AI candidate integrity, content updates and deterministic audit');
