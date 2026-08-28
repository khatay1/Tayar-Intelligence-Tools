import type {
  SectionType,
  WebsiteBrand,
  WebsiteElement,
  WebsiteElementType,
  WebsiteElementContainer,
  WebsiteFormField,
  WebsiteSEO,
  WebsiteSection,
} from './types';

export const SECTION_LABELS: Record<SectionType, string> = {
  hero: 'Hero',
  features: 'Features',
  about: 'About',
  services: 'Services',
  pricing: 'Pricing',
  testimonials: 'Testimonials',
  contact: 'Contact',
  footer: 'Footer',
};

export const ELEMENT_LABELS: Record<WebsiteElementType, string> = {
  heading: 'Heading',
  text: 'Text',
  button: 'Button',
  image: 'Image',
  video: 'Video',
  list: 'List',
  divider: 'Divider',
  spacer: 'Spacer',
  accordion: 'Accordion',
  tabs: 'Tabs',
  gallery: 'Gallery',
  embed: 'Map / Embed',
  code: 'Custom HTML',
  countdown: 'Countdown',
  stats: 'Stats / Counters',
  'testimonials-slider': 'Testimonials Slider',
};

export const defaultBrand: WebsiteBrand = {
  name: 'My Brand',
  industry: 'Business',
  style: 'Modern',
  colors: { primary: '#7c3aed', secondary: '#0f172a' },
  tone: 'Professional',
};

export const defaultSEO: WebsiteSEO = {
  title: 'My Website',
  description: '',
  keywords: [],
};



function normalizeElementContainer(container: Partial<WebsiteElementContainer>, index: number): WebsiteElementContainer {
  const number = (value: unknown, fallback: number, min: number, max: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
  };
  return {
    id: typeof container.id === 'string' && container.id ? container.id : `container-${Date.now()}-${index}`,
    name: typeof container.name === 'string' && container.name.trim() ? container.name.slice(0, 80) : `Container ${index + 1}`,
    layout: container.layout === 'row' ? 'row' : 'stack',
    gap: number(container.gap, 16, 0, 80),
    align: container.align === 'start' || container.align === 'end' || container.align === 'stretch' ? container.align : 'center',
    backgroundColor: typeof container.backgroundColor === 'string' ? container.backgroundColor : '#ffffff08',
    padding: number(container.padding, 20, 0, 120),
    borderRadius: number(container.borderRadius, 16, 0, 120),
    borderWidth: number(container.borderWidth, 1, 0, 16),
    borderColor: typeof container.borderColor === 'string' ? container.borderColor : '#ffffff18',
    shadow: container.shadow === 'sm' || container.shadow === 'md' || container.shadow === 'lg' || container.shadow === 'xl' ? container.shadow : 'none',
    layoutColumn: container.layoutColumn ? number(container.layoutColumn, 1, 1, 3) : undefined,
    columnSpan: container.columnSpan ? number(container.columnSpan, 1, 1, 3) : undefined,
  };
}

export function createDefaultContactFormFields(): WebsiteFormField[] {
  return [
    { id: `field-name-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: 'name', label: 'Name', type: 'text', placeholder: 'Your name', required: true },
    { id: `field-email-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: 'email', label: 'Email', type: 'email', placeholder: 'Your email', required: true },
    { id: `field-message-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: 'message', label: 'Message', type: 'textarea', placeholder: 'Your message', required: true },
  ];
}

function elementId(type: WebsiteElementType) {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createElement(type: WebsiteElementType, accent = '#7c3aed'): WebsiteElement {
  if (type === 'heading') {
    return { id: elementId(type), type, content: 'New heading', style: { color: '#ffffff', fontSize: 42, fontWeight: 800, textAlign: 'center' } };
  }
  if (type === 'text') {
    return { id: elementId(type), type, content: 'Add your text here.', style: { color: '#cbd5e1', fontSize: 16, fontWeight: 400, textAlign: 'center' } };
  }
  if (type === 'button') {
    return { id: elementId(type), type, content: 'Learn More', href: '#contact', style: { color: '#ffffff', backgroundColor: accent, fontSize: 14, fontWeight: 700, textAlign: 'center', padding: 12, borderRadius: 12 } };
  }
  if (type === 'image') {
    return { id: elementId(type), type, content: 'Image', src: '', style: { width: 100, borderRadius: 16 } };
  }
  if (type === 'video') {
    return { id: elementId(type), type, content: 'Video', src: '', style: { width: 100, borderRadius: 16, backgroundColor: '#000000' } };
  }
  if (type === 'list') {
    return { id: elementId(type), type, content: 'First benefit\nSecond benefit\nThird benefit', style: { color: '#cbd5e1', fontSize: 16, fontWeight: 400, textAlign: 'left' } };
  }
  if (type === 'divider') {
    return { id: elementId(type), type, content: '', style: { backgroundColor: accent, width: 100, opacity: 0.35 } };
  }
  if (type === 'spacer') {
    return { id: elementId(type), type, content: '', style: { padding: 24, width: 100 } };
  }
  if (type === 'accordion') {
    return { id: elementId(type), type, content: 'What do you offer? | Describe your service here.\nHow does it work? | Explain the process in a clear answer.\nHow can I start? | Add the next step for your customer.', style: { color: '#ffffff', backgroundColor: '#ffffff08', fontSize: 16, width: 100, borderRadius: 14, padding: 14 } };
  }
  if (type === 'tabs') {
    return { id: elementId(type), type, content: 'Overview | Add your overview content here.\nFeatures | Describe the main features here.\nDetails | Add more information here.', style: { color: '#ffffff', backgroundColor: '#ffffff08', fontSize: 16, width: 100, borderRadius: 14, padding: 14 } };
  }
  if (type === 'gallery') {
    return { id: elementId(type), type, content: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2\nhttps://images.unsplash.com/photo-1497366754035-f200968a6e72\nhttps://images.unsplash.com/photo-1497366216548-37526070297c', style: { width: 100, borderRadius: 14 } };
  }
  if (type === 'embed') {
    return { id: elementId(type), type, content: 'Map or embedded content', src: '', style: { width: 100, borderRadius: 14, backgroundColor: '#ffffff08' } };
  }
  if (type === 'countdown') {
    return { id: elementId(type), type, content: '2026-12-31T23:59:59 | Launching soon', style: { color: '#ffffff', backgroundColor: '#ffffff08', width: 100, borderRadius: 16, padding: 18, textAlign: 'center' } };
  }
  if (type === 'stats') {
    return { id: elementId(type), type, content: '120 | Projects completed\n98 | Satisfaction %\n24 | Countries served', style: { color: '#ffffff', backgroundColor: '#ffffff08', width: 100, borderRadius: 16, padding: 18, textAlign: 'center' } };
  }
  if (type === 'testimonials-slider') {
    return { id: elementId(type), type, content: 'Alex | Amazing experience and excellent results.\nSarah | Professional, simple and exactly what we needed.\nDaniel | The easiest way to present our business online.', style: { color: '#ffffff', backgroundColor: '#ffffff08', width: 100, borderRadius: 16, padding: 18, textAlign: 'center' } };
  }
  return { id: elementId(type), type, content: '<div style="padding:24px;text-align:center"><strong>Custom HTML</strong><p>Edit this block in the inspector.</p></div>', style: { width: 100, borderRadius: 14 } };
}

export function createDefaultElements(section: Pick<WebsiteSection, 'title' | 'description' | 'buttonText' | 'buttonUrl' | 'accent' | 'image'>): WebsiteElement[] {
  const elements: WebsiteElement[] = [
    { ...createElement('heading', section.accent), content: section.title },
    { ...createElement('text', section.accent), content: section.description },
  ];
  if (section.image) elements.push({ ...createElement('image', section.accent), src: section.image });
  if (section.buttonText) elements.push({ ...createElement('button', section.accent), content: section.buttonText, href: section.buttonUrl });
  return elements;
}

function buildSection(id: string, type: SectionType, data: Omit<WebsiteSection, 'id' | 'type' | 'elements'>): WebsiteSection {
  const section = { id, type, ...data } as Omit<WebsiteSection, 'elements'>;
  return { ...section, layout: 'stack', layoutGap: 20, layoutAlign: 'center', elements: createDefaultElements(section) };
}

export const defaultSections: WebsiteSection[] = [
  buildSection('hero-1', 'hero', { title: 'Build Something Amazing', description: 'Create a professional website for your business, portfolio, service or personal brand.', buttonText: 'Get Started', buttonUrl: '#contact', background: '#111827', accent: '#7c3aed' }),
  buildSection('features-1', 'features', { title: 'Everything You Need', description: 'Showcase the key benefits that make your product or service different.', buttonText: 'Explore Features', buttonUrl: '#features', background: '#0f172a', accent: '#8b5cf6' }),
  buildSection('about-1', 'about', { title: 'About Your Business', description: 'Tell visitors who you are, what you do and why they should choose you.', buttonText: 'Learn More', buttonUrl: '#about', background: '#111827', accent: '#a855f7' }),
  buildSection('contact-1', 'contact', { title: "Let's Work Together", description: 'Ready to get started? Give your customers an easy way to contact you.', buttonText: 'Contact Us', buttonUrl: 'mailto:hello@example.com', background: '#0f172a', accent: '#7c3aed' }),
  buildSection('footer-1', 'footer', { title: 'Your Company', description: 'All rights reserved.', buttonText: '', buttonUrl: '', background: '#020617', accent: '#7c3aed' }),
];

export function createSection(type: SectionType): WebsiteSection {
  const templates: Record<SectionType, Omit<WebsiteSection, 'id' | 'type' | 'elements'>> = {
    hero: { title: 'New Hero Section', description: 'Introduce your website and your main offer.', buttonText: 'Get Started', buttonUrl: '#contact', background: '#111827', accent: '#7c3aed' },
    features: { title: 'Our Features', description: 'Show the main benefits of your product or service.', buttonText: 'Learn More', buttonUrl: '#features', background: '#0f172a', accent: '#8b5cf6' },
    about: { title: 'About Us', description: 'Tell your visitors more about your company.', buttonText: 'Read More', buttonUrl: '#about', background: '#111827', accent: '#a855f7' },
    services: { title: 'Our Services', description: 'Present the services you offer to your customers.', buttonText: 'View Services', buttonUrl: '#services', background: '#0f172a', accent: '#6366f1' },
    pricing: { title: 'Simple Pricing', description: 'Present your plans and pricing clearly.', buttonText: 'Choose Plan', buttonUrl: '#contact', background: '#111827', accent: '#8b5cf6' },
    testimonials: { title: 'What Customers Say', description: 'Build trust with testimonials from your customers.', buttonText: 'See Reviews', buttonUrl: '#contact', background: '#0f172a', accent: '#a855f7' },
    contact: { title: 'Contact Us', description: 'Make it easy for customers to get in touch.', buttonText: 'Send Message', buttonUrl: 'mailto:hello@example.com', background: '#111827', accent: '#7c3aed' },
    footer: { title: 'Your Company', description: 'All rights reserved.', buttonText: '', buttonUrl: '', background: '#020617', accent: '#7c3aed' },
  };
  const data = templates[type];
  const section = buildSection(`${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type, data);
  if (type === 'contact') {
    return {
      ...section,
      formFields: createDefaultContactFormFields(),
      formSuccessMessage: 'Thanks! Your message has been sent.',
      formSuccessAction: 'message',
      formRedirectUrl: '',
    };
  }
  return section;
}

export function normalizeSection(section: Partial<WebsiteSection> & Pick<WebsiteSection, 'id' | 'type'>): WebsiteSection {
  const base = createSection(section.type);
  const merged = { ...base, ...section } as WebsiteSection;
  const layout = section.layout === 'two-column' || section.layout === 'three-column' ? section.layout : 'stack';
  const columnCount = layout === 'three-column' ? 3 : layout === 'two-column' ? 2 : 1;
  const layoutGapValue = Number(section.layoutGap);
  const layoutGap = Number.isFinite(layoutGapValue) ? Math.min(80, Math.max(0, layoutGapValue)) : 20;
  const layoutAlign = section.layoutAlign === 'start' || section.layoutAlign === 'end' || section.layoutAlign === 'stretch'
    ? section.layoutAlign
    : 'center';
  const sourceElements = Array.isArray(section.elements) && section.elements.length
    ? section.elements
    : createDefaultElements(merged);

  const containers = Array.isArray(section.containers)
    ? section.containers.map((container, index) => normalizeElementContainer(container, index)).slice(0, 30)
    : [];
  const containerIds = new Set(containers.map((container) => container.id));

  return {
    ...merged,
    layout,
    layoutGap,
    layoutAlign,
    containers,
    formFields: section.type === 'contact'
      ? (Array.isArray(section.formFields) ? section.formFields : createDefaultContactFormFields())
      : section.formFields,
    formSuccessMessage: section.type === 'contact'
      ? (section.formSuccessMessage || 'Thanks! Your message has been sent.')
      : section.formSuccessMessage,
    formSuccessAction: section.type === 'contact' && section.formSuccessAction === 'redirect' ? 'redirect' : 'message',
    formRedirectUrl: section.type === 'contact' && typeof section.formRedirectUrl === 'string' ? section.formRedirectUrl : '',
    elements: sourceElements.map((element, index) => ({
      ...element,
      containerId: element.containerId && containerIds.has(element.containerId) ? element.containerId : undefined,
      layoutColumn: layout === 'stack'
        ? undefined
        : Math.min(columnCount, Math.max(1, Number(element.layoutColumn) || ((index % columnCount) + 1))),
    })),
  };
}
