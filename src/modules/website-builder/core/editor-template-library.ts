export type EditorTemplateKind = 'section' | 'page' | 'site';
export type EditorTemplateCategory = 'business' | 'saas' | 'portfolio' | 'commerce' | 'content' | 'launch';

export interface EditorTemplateLibraryItem {
  id: string;
  name: string;
  description: string;
  kind: EditorTemplateKind;
  category: EditorTemplateCategory;
  tags: string[];
  sectionTypes?: string[];
  pageSlugs?: string[];
  featured?: boolean;
  premium?: boolean;
  aiCustomizable?: boolean;
}

export const EDITOR_TEMPLATE_LIBRARY: EditorTemplateLibraryItem[] = [
  { id: 'hero-conversion', name: 'Conversion Hero', description: 'Hero with a focused value proposition and primary action.', kind: 'section', category: 'saas', tags: ['hero', 'cta', 'landing', 'conversion'], sectionTypes: ['hero'], featured: true, aiCustomizable: true },
  { id: 'features-proof', name: 'Features + Proof', description: 'Feature grid with supporting proof and trust content.', kind: 'section', category: 'saas', tags: ['features', 'proof', 'benefits'], sectionTypes: ['features', 'testimonials'], featured: true, aiCustomizable: true },
  { id: 'pricing-conversion', name: 'Pricing Conversion', description: 'Pricing block prepared for clear plan comparison.', kind: 'section', category: 'business', tags: ['pricing', 'plans', 'conversion'], sectionTypes: ['pricing'], aiCustomizable: true },
  { id: 'contact-lead', name: 'Lead Contact', description: 'Contact section focused on qualified lead capture.', kind: 'section', category: 'business', tags: ['contact', 'lead', 'form'], sectionTypes: ['contact'], aiCustomizable: true },
  { id: 'landing-saas', name: 'SaaS Landing Page', description: 'Complete SaaS landing flow from hero through pricing and contact.', kind: 'page', category: 'saas', tags: ['saas', 'landing', 'startup'], sectionTypes: ['hero', 'features', 'testimonials', 'pricing', 'contact', 'footer'], pageSlugs: ['/'], featured: true, aiCustomizable: true },
  { id: 'business-home', name: 'Business Homepage', description: 'Professional homepage for services and local businesses.', kind: 'page', category: 'business', tags: ['business', 'services', 'company'], sectionTypes: ['hero', 'about', 'services', 'testimonials', 'contact', 'footer'], pageSlugs: ['/'], featured: true, aiCustomizable: true },
  { id: 'portfolio-home', name: 'Portfolio Homepage', description: 'Portfolio-focused page with work, story and contact flow.', kind: 'page', category: 'portfolio', tags: ['portfolio', 'creative', 'personal'], sectionTypes: ['hero', 'features', 'about', 'testimonials', 'contact', 'footer'], pageSlugs: ['/'], aiCustomizable: true },
  { id: 'launch-page', name: 'Product Launch', description: 'Launch page with benefits, social proof and countdown-ready content.', kind: 'page', category: 'launch', tags: ['launch', 'product', 'waitlist'], sectionTypes: ['hero', 'features', 'testimonials', 'contact', 'footer'], pageSlugs: ['/'], aiCustomizable: true },
  { id: 'service-site', name: 'Service Business Site', description: 'Multi-page starter structure for a service business.', kind: 'site', category: 'business', tags: ['business', 'services', 'multi-page'], sectionTypes: ['hero', 'about', 'services', 'testimonials', 'contact', 'footer'], pageSlugs: ['/', '/about', '/services', '/contact'], featured: true, aiCustomizable: true },
  { id: 'saas-site', name: 'SaaS Product Site', description: 'Multi-page SaaS structure for product, pricing and company content.', kind: 'site', category: 'saas', tags: ['saas', 'product', 'multi-page'], sectionTypes: ['hero', 'features', 'pricing', 'testimonials', 'contact', 'footer'], pageSlugs: ['/', '/product', '/pricing', '/about', '/contact'], featured: true, aiCustomizable: true },
  { id: 'commerce-site', name: 'Commerce Brand Site', description: 'Brand-led commerce structure prepared for product storytelling.', kind: 'site', category: 'commerce', tags: ['commerce', 'brand', 'store'], sectionTypes: ['hero', 'features', 'testimonials', 'contact', 'footer'], pageSlugs: ['/', '/shop', '/about', '/contact'], aiCustomizable: true },
  { id: 'content-site', name: 'Content Publisher', description: 'Content-first site structure prepared for dynamic CMS expansion.', kind: 'site', category: 'content', tags: ['content', 'blog', 'cms'], sectionTypes: ['hero', 'features', 'about', 'footer'], pageSlugs: ['/', '/articles', '/about'], aiCustomizable: true },
];

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function filterEditorTemplateLibrary(
  query = '',
  kind?: EditorTemplateKind,
  category?: EditorTemplateCategory,
  catalog: EditorTemplateLibraryItem[] = EDITOR_TEMPLATE_LIBRARY,
) {
  const normalized = normalize(query);
  return catalog.filter((item) => {
    if (kind && item.kind !== kind) return false;
    if (category && item.category !== category) return false;
    if (!normalized) return true;
    const haystack = normalize([item.name, item.description, item.kind, item.category, ...item.tags].join(' '));
    const tokens = normalized.split(/\s+/).filter(Boolean);
    return haystack.includes(normalized) || (tokens.length > 0 && tokens.every((token) => haystack.includes(token)));
  });
}
