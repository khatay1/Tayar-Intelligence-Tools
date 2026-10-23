import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { explicitlyRequestsApplication, isExplicitPresentationOnlyRequest } from '../src/modules/website-builder/core/application-intent.ts';

const functional = [
  'بدي تطبيق عقارات متكامل لإضافة العقارات وتعديلها وحذفها',
  'أنشئ منصة عقارات فيها حسابات وطلبات',
  'اعمل نظام إدارة العقارات للموظفين',
  'موقع عقارات فيه لوحة تحكم لإدارة الإعلانات',
  'Build a property management application with saved listings',
  'Create a real estate app with property records',
  'Build a custom app for my rental business',
  'ابني تطبيق حجوزات وطلبات',
  'Build a property management application with a landing page',
  'Landing page plus a working CRM for my team',
  'Build a brochure site and a custom real estate app',
  'صفحة تعريفية مع نظام إدارة العقارات',
  'موقع تعريفي عن شركتي مع لوحة تحكم لإدارة العقارات',
  'بدي صفحة هبوط وبنفس الوقت تطبيق عقارات',
  'Build an inventory management platform with marketing pages',
  'I want a property management application with a landing page',
  'Design an inventory app with a brochure website',
  'Build a real estate website where agents can add, edit and delete property listings',
  'I need an online marketplace with sellers, buyers and orders',
  'أريد موقع عقارات يسمح للمستخدمين بالتسجيل وإضافة عقاراتهم',
  'بدي موقع لإضافة عقارات جديدة والتعديل عليها من لوحة الإدارة',
  'Build an interactive portal with user login and saved properties',
  'Please create a booking and payment platform',
  'بدي نظام متابعة مهام وصلاحيات وتسجيل دخول',
  'أريد موقع عقاري فيه بحث وتصفية وإدارة حجوزات',
  'Create a real estate marketplace',
  'Build an ecommerce store where buyers place orders and pay',
  'Create an app for staff to approve expenses',
  'Build a site where customers can place and pay for orders',
  'صفحة تعريفية مع تطبيق إدارة العقارات والموظفين',
  'Build a landing page plus a booking platform',
];
const presentationOnly = [
  'بدي موقع عقارات تعريفي يعرض الصور وفريق الشركة',
  'بدي صفحة هبوط لتطبيق عقارات',
  'اعمل صفحة تعريفية عن منصة عقارات',
  'Create a landing page for my property management app',
  'Build a brochure website for our CRM',
  'Landing page for my property management app',
  'Create a landing page about our working CRM',
  'موقع تسويقي لشركة تطوير نظام إدارة العقارات',
  'صفحة هبوط لنظام إدارة العقارات',
  'Landing page with app screenshots',
  'Marketing website with CRM logo',
  'Landing page with app store links',
  'Brochure with my app teaser',
  'Website for real estate with home and contact pages',
  'Apply a new design system to the landing page',
  'Landing page for my booking platform, with screenshots of login and orders',
  'موقع تسويقي لمنصة الحجوزات يعرض ميزات تسجيل الدخول وإضافة الطلبات',
  'Build a real estate landing page with search filters for listings',
  'Build an informational website about property management systems and database design',
  'Landing page for my online marketplace',
  'Marketing page showcasing ecommerce functionality',
  'Website describing how real estate agents add and edit properties in our app',
  'Create a brochure about booking and payments platform',
  'Landing page listing the features of our real estate CRM',
  'صفحة تسويقية عن نظام إدارة العقارات مع شرح الإضافة والتعديل',
  '',
];
for (const prompt of functional) assert.equal(explicitlyRequestsApplication(prompt), true, 'functional intent: '+prompt);
for (const prompt of presentationOnly) assert.equal(explicitlyRequestsApplication(prompt), false, 'presentation-only intent: '+prompt);
for (const prompt of presentationOnly.filter(x => x)) assert.equal(isExplicitPresentationOnlyRequest(prompt), /landing|brochure|marketing|showcase|informational|describing|explaining|about|صفحة|موقع تسويقي|موقع تعريفي/iu.test(prompt), 'presentation flag: '+prompt);
const source = await readFile(new URL('../src/modules/website-builder/core/editor-generated-application.ts', import.meta.url), 'utf8');
assert.match(source, /import\s*\{\s*explicitlyRequestsApplication\s*,\s*isExplicitPresentationOnlyRequest\s*\}\s*from\s*'\.\/application-intent'/);
assert.match(source, /const informationalOnly\s*=\s*isExplicitPresentationOnlyRequest\(prompt\)/);
assert.match(source, /const requested\s*=\s*explicitlyRequestsApplication\(prompt\)\s*\|\|\s*\(!informationalOnly/);
assert.match(source, /requestedCapabilities\.size\s*>\s*0\s*&&\s*!informationalOnly/);
assert.match(source, /if\s*\(generated\.application\s*===\s*undefined\)/);
assert.match(source, /throw new Error\('This request needs a real application definition and bound forms/);
// Isolate the actual no-application rejection branch from the generation core.
// This is a targeted branch test, NOT the full editor handler or a DB/runtime E2E.
const start = source.indexOf('  const informationalOnly =');
const endMarker = '    return undefined;\n  }';
const end = source.indexOf(endMarker, start) + endMarker.length;
assert.ok(start >= 0 && end > start, 'expected generator no-application branch must exist');
const guard = runInNewContext('(generated, pages, prompt, requestedCapabilities, explicitlyRequestsApplication, isExplicitPresentationOnlyRequest) => { ' + source.slice(start, end) + ' }');
const brochure = { projectKind: 'website', application: undefined };
const pages = [{ sections: [{ type: 'hero' }] }];
for (const prompt of functional) assert.throws(
  () => guard(brochure, pages, prompt, new Set(['records']), explicitlyRequestsApplication, isExplicitPresentationOnlyRequest),
  /This request needs a real application definition/, 'reject a brochure downgrade: '+prompt,
);
for (const prompt of presentationOnly) {
  try { assert.equal(guard(brochure, pages, prompt, new Set(isExplicitPresentationOnlyRequest(prompt) ? ['auth', 'payment', 'booking'] : []), explicitlyRequestsApplication, isExplicitPresentationOnlyRequest), undefined, 'leave simple brochure available: '+prompt); }
  catch (error) { throw new Error("Brochure regression for '"+prompt+"': "+error.message); }
}
assert.throws(() => guard({ projectKind: 'application' }, pages, 'Make a website', new Set(), explicitlyRequestsApplication, isExplicitPresentationOnlyRequest), /real application definition/);
assert.throws(() => guard(brochure, [{ sections: [{ applicationFormBinding: { tableId: 'records' } }] }], 'Website', new Set(), explicitlyRequestsApplication, isExplicitPresentationOnlyRequest), /real application definition/);
console.log('PASS: '+functional.length+' application, '+presentationOnly.length+' brochure prompts in detector and real rejection branch; malformed app output blocked.');
