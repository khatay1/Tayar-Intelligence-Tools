export type EditorInsertCategory = 'layout' | 'content' | 'media' | 'forms' | 'advanced';

export interface EditorInsertCatalogItem {
  id: string;
  label: string;
  description: string;
  category: EditorInsertCategory;
  elementType?: string;
  sectionType?: string;
  keywords: string[];
  recommended?: boolean;
}

export const EDITOR_INSERT_CATALOG: EditorInsertCatalogItem[] = [
  { id: 'section', label: 'Flexible Section', description: 'Add a flexible section you can fully restyle and replace with your own elements.', category: 'layout', sectionType: 'features', keywords: ['section', 'layout', 'container', 'flexible'], recommended: true },
  { id: 'hero-section', label: 'Hero', description: 'Add a hero section.', category: 'layout', sectionType: 'hero', keywords: ['hero', 'banner', 'landing'], recommended: true },
  { id: 'features-section', label: 'Features', description: 'Add a features section.', category: 'layout', sectionType: 'features', keywords: ['features', 'benefits'] },
  { id: 'about-section', label: 'About', description: 'Add an about section.', category: 'layout', sectionType: 'about', keywords: ['about', 'company'] },
  { id: 'services-section', label: 'Services', description: 'Add a services section.', category: 'layout', sectionType: 'services', keywords: ['services', 'offer'] },
  { id: 'pricing-section', label: 'Pricing', description: 'Add a pricing section.', category: 'layout', sectionType: 'pricing', keywords: ['pricing', 'plans'] },
  { id: 'testimonials-section', label: 'Testimonials', description: 'Add a testimonials section.', category: 'layout', sectionType: 'testimonials', keywords: ['testimonials', 'reviews'] },
  { id: 'contact-section', label: 'Contact', description: 'Add a contact section and form.', category: 'layout', sectionType: 'contact', keywords: ['contact', 'form'] },
  { id: 'footer-section', label: 'Footer', description: 'Add a footer section.', category: 'layout', sectionType: 'footer', keywords: ['footer', 'links'] },
  { id: 'container', label: 'Container', description: 'Group elements in a reusable layout.', category: 'layout', elementType: 'container', keywords: ['container', 'group', 'layout'] },
  { id: 'heading', label: 'Heading', description: 'Add a title or section heading.', category: 'content', elementType: 'heading', keywords: ['heading', 'title', 'text'], recommended: true },
  { id: 'text', label: 'Text', description: 'Add paragraph or supporting copy.', category: 'content', elementType: 'text', keywords: ['text', 'paragraph', 'copy'], recommended: true },
  { id: 'button', label: 'Button', description: 'Add a call-to-action button.', category: 'content', elementType: 'button', keywords: ['button', 'cta', 'link'], recommended: true },
  { id: 'list', label: 'List', description: 'Add a structured list of items.', category: 'content', elementType: 'list', keywords: ['list', 'bullets', 'features'] },
  { id: 'image', label: 'Image', description: 'Add an image from uploads or AI.', category: 'media', elementType: 'image', keywords: ['image', 'photo', 'media'], recommended: true },
  { id: 'gallery', label: 'Gallery', description: 'Show multiple images together.', category: 'media', elementType: 'gallery', keywords: ['gallery', 'images', 'portfolio'] },
  { id: 'video', label: 'Video', description: 'Embed or display a video.', category: 'media', elementType: 'video', keywords: ['video', 'youtube', 'media'] },
  { id: 'embed', label: 'Map / Embed', description: 'Embed a map or external page.', category: 'media', elementType: 'embed', keywords: ['map', 'embed', 'iframe'] },
  { id: 'contact-form', label: 'Contact Form', description: 'Collect visitor messages safely.', category: 'forms', sectionType: 'contact', keywords: ['form', 'contact', 'email'], recommended: true },
  { id: 'divider', label: 'Divider', description: 'Create visual separation.', category: 'advanced', elementType: 'divider', keywords: ['divider', 'line', 'separator'] },
  { id: 'spacer', label: 'Spacer', description: 'Add controlled visual spacing.', category: 'advanced', elementType: 'spacer', keywords: ['space', 'spacer', 'gap'] },
  { id: 'accordion', label: 'Accordion', description: 'Expandable content for FAQs.', category: 'advanced', elementType: 'accordion', keywords: ['accordion', 'faq', 'collapse'] },
  { id: 'tabs', label: 'Tabs', description: 'Organize related content in tabs.', category: 'advanced', elementType: 'tabs', keywords: ['tabs', 'navigation', 'content'] },
  { id: 'stats', label: 'Stats', description: 'Show numbers and counters.', category: 'advanced', elementType: 'stats', keywords: ['stats', 'counter', 'numbers'] },
  { id: 'countdown', label: 'Countdown', description: 'Add a countdown timer.', category: 'advanced', elementType: 'countdown', keywords: ['countdown', 'timer', 'launch'] },
  { id: 'testimonials-slider', label: 'Testimonials Slider', description: 'Show customer testimonials in a slider.', category: 'advanced', elementType: 'testimonials-slider', keywords: ['testimonials', 'reviews', 'slider'] },
  { id: 'code', label: 'Custom HTML', description: 'Add sanitized custom HTML.', category: 'advanced', elementType: 'code', keywords: ['html', 'code', 'custom'] },
];

export function filterEditorInsertCatalog(
  query = '',
  category?: EditorInsertCategory,
  catalog: EditorInsertCatalogItem[] = EDITOR_INSERT_CATALOG,
) {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const normalized = normalize(query);
  return catalog.filter((item) => {
    if (category && item.category !== category) return false;
    if (!normalized) return true;
    const haystack = normalize([item.label, item.description, ...item.keywords].join(' '));
    if (haystack.includes(normalized)) return true;
    const tokens = normalized.split(/\s+/).filter(Boolean);
    return tokens.length > 0 && tokens.every((token) => haystack.includes(token));
  });
}
