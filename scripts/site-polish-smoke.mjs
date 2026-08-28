import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const exists = p => fs.existsSync(path.join(root, p));
const files = {
  app: 'src/App.tsx', navbar: 'src/components/Navbar.tsx', hero: 'src/components/Hero.tsx', tools: 'src/components/AITools.tsx',
  business: 'src/components/BusinessSolutions.tsx', stats: 'src/components/Stats.tsx', pricing: 'src/components/Pricing.tsx',
  useCases: 'src/components/Testimonials.tsx', faq: 'src/components/FAQ.tsx', cta: 'src/components/CTA.tsx', footer: 'src/components/Footer.tsx',
  copy: 'src/lib/landing-copy.ts', seo: 'src/lib/seo.ts', index: 'index.html', css: 'src/index.css',
};

let passed = 0;
let failed = 0;
const results = [];
function check(name, ok) {
  results.push({ name, ok: Boolean(ok) });
  ok ? passed++ : failed++;
}

for (const [name, file] of Object.entries(files)) check(`${name} source exists`, exists(file));

const navbar = read(files.navbar);
const hero = read(files.hero);
const landingFiles = [files.navbar, files.hero, files.tools, files.business, files.pricing, files.useCases, files.faq, files.cta, files.footer].map(read).join('\n');
const copy = read(files.copy);
const app = read(files.app);
const index = read(files.index);
const seo = read(files.seo);

check('Navbar debug console log removed', !/NAVBAR LANGUAGE TEST|console\.log\(/.test(navbar));
check('Hero uses deterministic visuals', !/Math\.random\(/.test(hero));
check('Landing contains no dead href="#" links', !/href=["']#["']/.test(landingFiles));
check('Fake trusted-user social proof removed', !/Trusted by\s+[\d,]+|Loved by Thousands|15K\+|1\.2M\+/.test(landingFiles));
check('Landing copy contains English', /\ben:\s*\{/.test(copy));
check('Landing copy contains Arabic', /\bar:\s*\{/.test(copy));
check('Landing copy contains Swedish', /\bsv:\s*\{/.test(copy));
check('Arabic copy keeps V1 Website Builder messaging', /Website Builder V1/.test(copy));
check('Pricing reflects Free 1 website and 3 pages', /1 Website Builder project/.test(copy) && /Up to 3 pages/.test(copy));
check('Pricing reflects Pro 10 websites and 25 pages', /Up to 10 websites/.test(copy) && /Up to 25 pages per site/.test(copy));
check('Pricing reflects Business 50 websites and 100 pages', /Up to 50 websites/.test(copy) && /Up to 100 pages per site/.test(copy));
check('Public About route exists', /'about'/.test(app) && /AboutPage/.test(app));
check('Public Privacy route exists', /'privacy'/.test(app) && /PrivacyPolicy/.test(app));
check('Public Terms route exists', /'terms'/.test(app) && /TermsOfService/.test(app));
check('Landing has skip-to-content accessibility link', /skip-link/.test(app));
check('FAQ buttons expose aria-expanded', /aria-expanded/.test(read(files.faq)));
check('Navbar exposes language control', /setLanguage/.test(navbar) && /Globe2/.test(navbar));
check('SEO avoids old 50+ tool claim', !/50\+ tools/.test(seo + index));
check('SEO avoids old 100+ language claim', !/100\+ languages/.test(seo + index));
check('SEO describes Website Builder V1', /Website Builder V1/.test(seo + index));
check('SEO supports configurable public site URL', /VITE_PUBLIC_SITE_URL/.test(seo));
check('Auth and workspace SEO are noindex', (seo.match(/noindex, nofollow/g) || []).length >= 6);
check('Global CSS includes reduced-motion handling', /prefers-reduced-motion/.test(read(files.css)));
check('Global CSS includes responsive site container', /\.site-container/.test(read(files.css)));

console.log(`Site polish smoke test: ${passed} passed, ${failed} failed`);
for (const result of results) console.log(`  ${result.ok ? '✓' : '✗'} ${result.name}`);
if (failed) process.exit(1);
