import type {
  EditorFormFieldLike,
  EditorProjectLike,
  EditorSectionLike,
} from './editor-model';
import {
  findEditorElement,
  findEditorPage,
  findEditorSection,
} from './editor-model';
import type { EditorSelection } from './editor-selection';
import { editorPayloadHasForbiddenKey } from './editor-payload-safety';

export interface EditorInspectorField {
  key: string;
  label: string;
  value: unknown;
  kind: 'text' | 'textarea' | 'number' | 'color' | 'select' | 'toggle';
  group: 'content' | 'design' | 'responsive' | 'settings';
  section?: string;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  placeholder?: string;
  inheritedValue?: unknown;
  overridden?: boolean;
}

interface FieldOptions {
  section?: string;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  placeholder?: string;
  inheritedValue?: unknown;
  overridden?: boolean;
}

const field = (
  key: string,
  label: string,
  value: unknown,
  kind: EditorInspectorField['kind'],
  group: EditorInspectorField['group'],
  options: FieldOptions = {},
): EditorInspectorField => ({
  key,
  label,
  value,
  kind,
  group,
  ...options,
});

const TEXT_LIKE_TYPES = new Set([
  'heading',
  'text',
  'button',
  'list',
  'accordion',
  'tabs',
  'countdown',
  'stats',
  'testimonials-slider',
]);

const CONTENT_TYPES = new Set([
  'heading',
  'text',
  'button',
  'list',
  'accordion',
  'tabs',
  'gallery',
  'embed',
  'code',
  'countdown',
  'stats',
  'testimonials-slider',
]);

const MEDIA_TYPES = new Set([
  'image',
  'video',
  'embed',
]);

const SHADOW_OPTIONS = ['none', 'sm', 'md', 'lg', 'xl'];
const ALIGN_OPTIONS = ['left', 'center', 'right'];
const SELF_ALIGN_OPTIONS = ['auto', 'start', 'center', 'end', 'stretch'];
const ANIMATION_OPTIONS = [
  'none',
  'fade',
  'fade-up',
  'fade-down',
  'fade-left',
  'fade-right',
  'zoom-in',
  'zoom-out',
  'slide-up',
  'slide-down',
  'slide-left',
  'slide-right',
  'blur-in',
  'flip-in',
  'bounce-in',
];

function findContainer(
  section: EditorSectionLike,
  containerId: string,
) {
  return section.containers?.find(
    (container) => container.id === containerId,
  );
}

function findFormField(
  section: EditorSectionLike,
  formFieldId: string,
): EditorFormFieldLike | undefined {
  return section.formFields?.find(
    (formField) => formField.id === formFieldId,
  );
}

function responsiveElementFields(
  device: 'tablet' | 'mobile',
  responsive: Record<string, unknown>,
  baseStyle: Record<string, unknown>,
): EditorInspectorField[] {
  const deviceStyle =
    (responsive[device] as Record<string, unknown> | undefined) || {};
  const prefix = `responsive.${device}`;
  const title = device === 'tablet' ? 'Tablet overrides' : 'Mobile overrides';
  const override = (key: string) => ({
    inheritedValue: baseStyle[key],
    overridden: Object.prototype.hasOwnProperty.call(deviceStyle, key),
  });

  return [
    field(`${prefix}.fontSize`, 'Font size', deviceStyle.fontSize ?? '', 'number', 'responsive', {
      section: title,
      min: 8,
      max: 160,
      unit: 'px',
      ...override('fontSize'),
    }),
    field(`${prefix}.fontWeight`, 'Font weight', deviceStyle.fontWeight ?? '', 'number', 'responsive', {
      section: title,
      min: 100,
      max: 900,
      step: 100,
      ...override('fontWeight'),
    }),
    field(`${prefix}.textAlign`, 'Text align', deviceStyle.textAlign ?? '', 'select', 'responsive', {
      section: title,
      options: ['', ...ALIGN_OPTIONS],
      ...override('textAlign'),
    }),
    field(`${prefix}.width`, 'Width %', deviceStyle.width ?? '', 'number', 'responsive', {
      section: title,
      min: 0,
      max: 100,
      unit: '%',
      ...override('width'),
    }),
    field(`${prefix}.maxWidth`, 'Max width', deviceStyle.maxWidth ?? '', 'number', 'responsive', {
      section: title,
      min: 0,
      max: 2400,
      unit: 'px',
      ...override('maxWidth'),
    }),
    field(`${prefix}.padding`, 'Padding', deviceStyle.padding ?? '', 'number', 'responsive', {
      section: title,
      min: 0,
      max: 240,
      unit: 'px',
      ...override('padding'),
    }),
    field(`${prefix}.marginTop`, 'Margin top', deviceStyle.marginTop ?? '', 'number', 'responsive', {
      section: title,
      min: -240,
      max: 480,
      unit: 'px',
      ...override('marginTop'),
    }),
    field(`${prefix}.marginRight`, 'Margin right', deviceStyle.marginRight ?? '', 'number', 'responsive', {
      section: title,
      min: -240,
      max: 480,
      unit: 'px',
      ...override('marginRight'),
    }),
    field(`${prefix}.marginBottom`, 'Margin bottom', deviceStyle.marginBottom ?? '', 'number', 'responsive', {
      section: title,
      min: -240,
      max: 480,
      unit: 'px',
      ...override('marginBottom'),
    }),
    field(`${prefix}.marginLeft`, 'Margin left', deviceStyle.marginLeft ?? '', 'number', 'responsive', {
      section: title,
      min: -240,
      max: 480,
      unit: 'px',
      ...override('marginLeft'),
    }),
    field(`${prefix}.columnSpan`, 'Column span', deviceStyle.columnSpan ?? '', 'number', 'responsive', {
      section: title,
      min: 1,
      max: 3,
      ...override('columnSpan'),
    }),
    field(`${prefix}.hidden`, 'Hide on device', Boolean(deviceStyle.hidden ?? baseStyle.hidden), 'toggle', 'responsive', {
      section: title,
      ...override('hidden'),
    }),
    field(`${prefix}.positionX`, 'Position X', deviceStyle.positionX ?? '', 'number', 'responsive', {
      section: title, min: -2000, max: 2000, unit: 'px', ...override('positionX'),
    }),
    field(`${prefix}.positionY`, 'Position Y', deviceStyle.positionY ?? '', 'number', 'responsive', {
      section: title, min: -2000, max: 2000, unit: 'px', ...override('positionY'),
    }),
    field(`${prefix}.height`, 'Height', deviceStyle.height ?? '', 'number', 'responsive', {
      section: title, min: 0, max: 2400, unit: 'px', ...override('height'),
    }),
    field(`${prefix}.minHeight`, 'Min height', deviceStyle.minHeight ?? '', 'number', 'responsive', {
      section: title, min: 0, max: 2400, unit: 'px', ...override('minHeight'),
    }),
    field(`${prefix}.maxHeight`, 'Max height', deviceStyle.maxHeight ?? '', 'number', 'responsive', {
      section: title, min: 0, max: 2400, unit: 'px', ...override('maxHeight'),
    }),
    field(`${prefix}.animation`, 'Animation', deviceStyle.animation ?? '', 'select', 'responsive', {
      section: `${title} motion`, options: ['', ...ANIMATION_OPTIONS], ...override('animation'),
    }),
    field(`${prefix}.animationDuration`, 'Duration ms', deviceStyle.animationDuration ?? '', 'number', 'responsive', {
      section: `${title} motion`, min: 100, max: 4000, step: 50, ...override('animationDuration'),
    }),
    field(`${prefix}.animationDelay`, 'Delay ms', deviceStyle.animationDelay ?? '', 'number', 'responsive', {
      section: `${title} motion`, min: 0, max: 5000, step: 50, ...override('animationDelay'),
    }),
    field(`${prefix}.animationEasing`, 'Easing', deviceStyle.animationEasing ?? '', 'select', 'responsive', {
      section: `${title} motion`, options: ['', 'smooth', 'ease', 'linear', 'spring'], ...override('animationEasing'),
    }),
    field(`${prefix}.parallaxSpeed`, 'Parallax speed', deviceStyle.parallaxSpeed ?? '', 'number', 'responsive', {
      section: `${title} motion`, min: -1, max: 1, step: 0.05, ...override('parallaxSpeed'),
    }),
  ];
}

function buildElementFields(
  element: Record<string, unknown>,
): EditorInspectorField[] {
  const type = String(element.type || '');
  const style =
    (element.style as Record<string, unknown> | undefined) || {};
  const responsive =
    (element.responsive as Record<string, unknown> | undefined) || {};
  const fields: EditorInspectorField[] = [];

  if (CONTENT_TYPES.has(type)) {
    fields.push(
      field('content', type === 'code' ? 'HTML' : 'Content', element.content ?? '', 'textarea', 'content', {
        section: 'Content',
        placeholder: type === 'code' ? '<div>...</div>' : undefined,
      }),
    );
  }

  if (MEDIA_TYPES.has(type)) {
    fields.push(
      field('src', 'Source URL', element.src ?? '', 'text', 'content', {
        section: 'Media',
        placeholder: 'https://...',
      }),
    );
  }

  if (type === 'image') {
    fields.push(
      field('alt', 'Alt text', element.alt ?? '', 'text', 'content', {
        section: 'Media',
        placeholder: 'Describe the image',
      }),
    );
  }

  if (type === 'button') {
    fields.push(
      field('href', 'Link', element.href ?? '', 'text', 'content', {
        section: 'Link',
        placeholder: '#contact or https://...',
      }),
    );
  }

  if (TEXT_LIKE_TYPES.has(type)) {
    fields.push(
      field('style.color', 'Text color', style.color ?? '#ffffff', 'color', 'design', {
        section: 'Typography',
      }),
      field('style.fontSize', 'Font size', style.fontSize ?? '', 'number', 'design', {
        section: 'Typography',
        min: 8,
        max: 160,
      }),
      field('style.fontWeight', 'Font weight', style.fontWeight ?? '', 'number', 'design', {
        section: 'Typography',
        min: 100,
        max: 900,
        step: 100,
      }),
      field('style.textAlign', 'Text align', style.textAlign ?? 'left', 'select', 'design', {
        section: 'Typography',
        options: ALIGN_OPTIONS,
      }),
      field('style.lineHeight', 'Line height', style.lineHeight ?? '', 'number', 'design', {
        section: 'Typography',
        min: 0.5,
        max: 4,
        step: 0.05,
      }),
      field('style.letterSpacing', 'Letter spacing', style.letterSpacing ?? '', 'number', 'design', {
        section: 'Typography',
        min: -10,
        max: 40,
        step: 0.1,
      }),
    );
  }

  fields.push(
    field('style.backgroundColor', 'Background', style.backgroundColor ?? 'transparent', 'color', 'design', {
      section: 'Surface',
    }),
    field('style.opacity', 'Opacity', style.opacity ?? '', 'number', 'design', {
      section: 'Surface',
      min: 0,
      max: 1,
      step: 0.05,
    }),

    field('style.width', 'Width %', style.width ?? '', 'number', 'design', {
      section: 'Size & spacing',
      min: 0,
      max: 100,
      unit: '%',
    }),
    field('style.minWidth', 'Min width', style.minWidth ?? '', 'number', 'design', {
      section: 'Size & spacing', min: 0, max: 2400, unit: 'px',
    }),
    field('style.maxWidth', 'Max width', style.maxWidth ?? '', 'number', 'design', {
      section: 'Size & spacing',
      min: 0,
      max: 2400,
      unit: 'px',
    }),
    field('style.height', 'Height', style.height ?? '', 'number', 'design', {
      section: 'Size & spacing', min: 0, max: 2400, unit: 'px',
    }),
    field('style.minHeight', 'Min height', style.minHeight ?? '', 'number', 'design', {
      section: 'Size & spacing', min: 0, max: 2400, unit: 'px',
    }),
    field('style.maxHeight', 'Max height', style.maxHeight ?? '', 'number', 'design', {
      section: 'Size & spacing', min: 0, max: 2400, unit: 'px',
    }),
    field('style.aspectRatio', 'Aspect ratio', style.aspectRatio ?? '', 'number', 'design', {
      section: 'Size & spacing', min: 0.1, max: 10, step: 0.01,
    }),
    field('style.padding', 'Padding', style.padding ?? '', 'number', 'design', {
      section: 'Size & spacing',
      min: 0,
      max: 240,
    }),
    field('style.marginTop', 'Margin top', style.marginTop ?? '', 'number', 'design', {
      section: 'Size & spacing',
      min: -240,
      max: 480,
    }),
    field('style.marginRight', 'Margin right', style.marginRight ?? '', 'number', 'design', {
      section: 'Size & spacing',
      min: -240,
      max: 480,
    }),
    field('style.marginBottom', 'Margin bottom', style.marginBottom ?? '', 'number', 'design', {
      section: 'Size & spacing',
      min: -240,
      max: 480,
    }),
    field('style.marginLeft', 'Margin left', style.marginLeft ?? '', 'number', 'design', {
      section: 'Size & spacing',
      min: -240,
      max: 480,
    }),

    field('style.alignSelf', 'Align self', style.alignSelf ?? 'auto', 'select', 'design', {
      section: 'Layout',
      options: SELF_ALIGN_OPTIONS,
    }),
    field('style.columnSpan', 'Column span', style.columnSpan ?? '', 'number', 'design', {
      section: 'Layout',
      min: 1,
      max: 3,
    }),
    field('style.positionX', 'Position X', style.positionX ?? '', 'number', 'design', {
      section: 'Layout',
      min: -2000,
      max: 2000,
    }),
    field('style.positionY', 'Position Y', style.positionY ?? '', 'number', 'design', {
      section: 'Layout',
      min: -2000,
      max: 2000,
    }),
    field('style.order', 'Order', style.order ?? '', 'number', 'design', {
      section: 'Layout',
      min: -100,
      max: 100,
    }),
    field('style.flexGrow', 'Flex grow', style.flexGrow ?? '', 'number', 'design', {
      section: 'Layout', min: 0, max: 20, step: 0.1,
    }),
    field('style.flexShrink', 'Flex shrink', style.flexShrink ?? '', 'number', 'design', {
      section: 'Layout', min: 0, max: 20, step: 0.1,
    }),
    field('style.rotate', 'Rotate °', style.rotate ?? '', 'number', 'design', {
      section: 'Layout',
      min: -360,
      max: 360,
    }),

    field('style.borderRadius', 'Border radius', style.borderRadius ?? '', 'number', 'design', {
      section: 'Border & shadow',
      min: 0,
      max: 240,
    }),
    field('style.borderWidth', 'Border width', style.borderWidth ?? '', 'number', 'design', {
      section: 'Border & shadow',
      min: 0,
      max: 32,
    }),
    field('style.borderColor', 'Border color', style.borderColor ?? '#ffffff', 'color', 'design', {
      section: 'Border & shadow',
    }),
    field('style.borderStyle', 'Border style', style.borderStyle ?? 'solid', 'select', 'design', {
      section: 'Border & shadow',
      options: ['solid', 'dashed', 'dotted'],
    }),
    field('style.shadow', 'Shadow', style.shadow ?? 'none', 'select', 'design', {
      section: 'Border & shadow',
      options: SHADOW_OPTIONS,
    }),

    field('style.hoverScale', 'Hover scale', style.hoverScale ?? '', 'number', 'design', {
      section: 'Hover',
      min: 0.5,
      max: 2,
      step: 0.01,
    }),
    field('style.hoverOpacity', 'Hover opacity', style.hoverOpacity ?? '', 'number', 'design', {
      section: 'Hover',
      min: 0,
      max: 1,
      step: 0.05,
    }),
    field('style.hoverBackgroundColor', 'Hover background', style.hoverBackgroundColor ?? '#000000', 'color', 'design', {
      section: 'Hover',
    }),
    field('style.hoverColor', 'Hover text color', style.hoverColor ?? '#ffffff', 'color', 'design', {
      section: 'Hover',
    }),
    field('style.hoverShadow', 'Hover shadow', style.hoverShadow ?? 'none', 'select', 'design', {
      section: 'Hover',
      options: SHADOW_OPTIONS,
    }),

    field('style.animation', 'Animation', style.animation ?? 'none', 'select', 'design', {
      section: 'Animation',
      options: ANIMATION_OPTIONS,
    }),
    field('style.animationDuration', 'Duration ms', style.animationDuration ?? '', 'number', 'design', {
      section: 'Animation',
      min: 0,
      max: 10000,
      step: 50,
    }),
    field('style.animationDelay', 'Delay ms', style.animationDelay ?? '', 'number', 'design', {
      section: 'Animation',
      min: 0,
      max: 10000,
      step: 50,
    }),
    field('style.animationDistance', 'Distance', style.animationDistance ?? '', 'number', 'design', {
      section: 'Animation',
      min: 0,
      max: 1000,
    }),
    field('style.animationEasing', 'Easing', style.animationEasing ?? 'smooth', 'select', 'design', {
      section: 'Animation',
      options: ['smooth', 'ease', 'linear', 'spring'],
    }),
    field('style.animationIterations', 'Iterations', style.animationIterations ?? 1, 'number', 'design', {
      section: 'Animation',
      min: 1,
      max: 20,
      step: 1,
    }),
    field('style.parallaxSpeed', 'Parallax speed', style.parallaxSpeed ?? 0, 'number', 'design', {
      section: 'Animation',
      min: -1,
      max: 1,
      step: 0.05,
    }),

    ...responsiveElementFields('tablet', responsive, style),
    ...responsiveElementFields('mobile', responsive, style),

    field('style.hidden', 'Hide element', Boolean(style.hidden), 'toggle', 'settings', {
      section: 'Visibility',
    }),
    field('layoutColumn', 'Layout column', element.layoutColumn ?? '', 'number', 'settings', {
      section: 'Layout',
      min: 1,
      max: 3,
    }),
    field('containerId', 'Container ID', element.containerId ?? '', 'text', 'settings', {
      section: 'Layout',
      placeholder: 'Leave empty for section root',
    }),
    field('symbolId', 'Reusable component', element.symbolId ?? '', 'text', 'settings', {
      section: 'Advanced',
    }),
    field('animationOnce', 'Animate once', element.animationOnce !== false, 'toggle', 'settings', {
      section: 'Advanced',
    }),
    field('animationTrigger', 'Animation trigger', element.animationTrigger ?? 'scroll', 'select', 'settings', {
      section: 'Advanced',
      options: ['scroll', 'load', 'hover', 'click'],
    }),
  );

  return fields;
}

function buildSectionFields(
  section: Record<string, unknown>,
): EditorInspectorField[] {
  const responsive =
    (section.responsive as Record<string, unknown> | undefined) || {};
  const fields: EditorInspectorField[] = [
    field('title', 'Section title', section.title ?? '', 'text', 'content', {
      section: 'Content',
    }),
    field('description', 'Description', section.description ?? '', 'textarea', 'content', {
      section: 'Content',
    }),
    field('buttonText', 'Button text', section.buttonText ?? '', 'text', 'content', {
      section: 'Call to action',
    }),
    field('buttonUrl', 'Button link', section.buttonUrl ?? '', 'text', 'content', {
      section: 'Call to action',
      placeholder: '#contact or https://...',
    }),
    field('image', 'Section image', section.image ?? '', 'text', 'content', {
      section: 'Media',
      placeholder: 'https://...',
    }),

    field('layout', 'Layout', section.layout ?? 'stack', 'select', 'design', {
      section: 'Layout',
      options: ['stack', 'two-column', 'three-column'],
    }),
    field('layoutGap', 'Gap', section.layoutGap ?? 20, 'number', 'design', {
      section: 'Layout',
      min: 0,
      max: 80,
    }),
    field('layoutAlign', 'Alignment', section.layoutAlign ?? 'center', 'select', 'design', {
      section: 'Layout',
      options: ['start', 'center', 'end', 'stretch'],
    }),
    field('contentWidth', 'Content width', section.contentWidth ?? 'boxed', 'select', 'design', {
      section: 'Layout',
      options: ['boxed', 'full'],
    }),
    field('minHeight', 'Minimum height', section.minHeight ?? '', 'number', 'design', {
      section: 'Layout',
      min: 0,
      max: 1600,
    }),
    field('sectionPaddingY', 'Vertical padding', section.sectionPaddingY ?? 48, 'number', 'design', {
      section: 'Layout',
      min: 0,
      max: 240,
    }),
    field('sectionPaddingX', 'Horizontal padding', section.sectionPaddingX ?? '', 'number', 'design', {
      section: 'Layout',
      min: 0,
      max: 160,
    }),
    field('sectionRadius', 'Section radius', section.sectionRadius ?? '', 'number', 'design', {
      section: 'Layout',
      min: 0,
      max: 240,
    }),

    field('backgroundMode', 'Background mode', section.backgroundMode ?? 'color', 'select', 'design', {
      section: 'Background',
      options: ['color', 'gradient', 'image'],
    }),
    field('background', 'Background color', section.background ?? '#111827', 'color', 'design', {
      section: 'Background',
    }),
    field('accent', 'Accent color', section.accent ?? '#7c3aed', 'color', 'design', {
      section: 'Background',
    }),
    field('backgroundImage', 'Background image', section.backgroundImage ?? '', 'text', 'design', {
      section: 'Background',
      placeholder: 'https://...',
    }),
    field('backgroundPosition', 'Image position', section.backgroundPosition ?? 'center', 'select', 'design', {
      section: 'Background',
      options: ['center', 'top', 'bottom', 'left', 'right'],
    }),
    field('backgroundSize', 'Image size', section.backgroundSize ?? 'cover', 'select', 'design', {
      section: 'Background',
      options: ['cover', 'contain', 'auto'],
    }),
    field('gradientFrom', 'Gradient from', section.gradientFrom ?? '#7c3aed', 'color', 'design', {
      section: 'Gradient',
    }),
    field('gradientTo', 'Gradient to', section.gradientTo ?? '#0f172a', 'color', 'design', {
      section: 'Gradient',
    }),
    field('gradientAngle', 'Gradient angle', section.gradientAngle ?? 135, 'number', 'design', {
      section: 'Gradient',
      min: 0,
      max: 360,
    }),
    field('overlayColor', 'Overlay color', section.overlayColor ?? '#000000', 'color', 'design', {
      section: 'Overlay',
    }),
    field('overlayOpacity', 'Overlay opacity', section.overlayOpacity ?? '', 'number', 'design', {
      section: 'Overlay',
      min: 0,
      max: 1,
      step: 0.05,
    }),
  ];

  (['tablet', 'mobile'] as const).forEach((device) => {
    const deviceStyle =
      (responsive[device] as Record<string, unknown> | undefined) || {};
    const prefix = `responsive.${device}`;
    const title = device === 'tablet' ? 'Tablet section' : 'Mobile section';

    fields.push(
      field(`${prefix}.minHeight`, 'Minimum height', deviceStyle.minHeight ?? '', 'number', 'responsive', {
        section: title,
        min: 0,
        max: 1600,
      }),
      field(`${prefix}.sectionPaddingY`, 'Vertical padding', deviceStyle.sectionPaddingY ?? '', 'number', 'responsive', {
        section: title,
        min: 0,
        max: 240,
      }),
      field(`${prefix}.sectionPaddingX`, 'Horizontal padding', deviceStyle.sectionPaddingX ?? '', 'number', 'responsive', {
        section: title,
        min: 0,
        max: 160,
      }),
      field(`${prefix}.layoutGap`, 'Gap', deviceStyle.layoutGap ?? '', 'number', 'responsive', {
        section: title,
        min: 0,
        max: 80,
      }),
    );
  });

  fields.push(
    field('anchorId', 'Anchor ID', section.anchorId ?? '', 'text', 'settings', {
      section: 'Navigation',
      placeholder: 'about-us',
    }),
    field('imagePrompt', 'AI image prompt', section.imagePrompt ?? '', 'textarea', 'settings', {
      section: 'AI & media',
    }),
    field('hidden', 'Hide section', Boolean(section.hidden), 'toggle', 'settings', {
      section: 'Visibility',
    }),
  );

  if (String(section.type || '') === 'contact') {
    fields.push(
      field('formSuccessMessage', 'Success message', section.formSuccessMessage ?? '', 'textarea', 'content', {
        section: 'Form response',
      }),
      field('formSuccessAction', 'After submit', section.formSuccessAction ?? 'message', 'select', 'content', {
        section: 'Form response',
        options: ['message', 'redirect'],
      }),
      field('formRedirectUrl', 'Redirect URL', section.formRedirectUrl ?? '', 'text', 'content', {
        section: 'Form response',
        placeholder: 'https://...',
      }),
    );
  }

  return fields;
}

function buildContainerFields(
  container: Record<string, unknown>,
): EditorInspectorField[] {
  return [
    field('name', 'Container name', container.name ?? 'Container', 'text', 'content', {
      section: 'Container',
    }),

    field('layout', 'Layout', container.layout ?? 'stack', 'select', 'design', {
      section: 'Layout',
      options: ['stack', 'row', 'grid'],
    }),
    field('gap', 'Gap', container.gap ?? 16, 'number', 'design', {
      section: 'Layout',
      min: 0,
      max: 80,
      unit: 'px',
    }),
    field('rowGap', 'Row gap', container.rowGap ?? '', 'number', 'design', {
      section: 'Layout', min: 0, max: 80, unit: 'px',
    }),
    field('columns', 'Grid columns', container.columns ?? 2, 'number', 'design', {
      section: 'Layout', min: 1, max: 12, step: 1,
    }),
    field('wrap', 'Wrap items', container.wrap !== false, 'toggle', 'design', {
      section: 'Layout',
    }),
    field('align', 'Alignment', container.align ?? 'stretch', 'select', 'design', {
      section: 'Layout',
      options: ['start', 'center', 'end', 'stretch'],
    }),
    field('justify', 'Justify content', container.justify ?? 'center', 'select', 'design', {
      section: 'Layout', options: ['start', 'center', 'end', 'between'],
    }),
    field('padding', 'Padding', container.padding ?? 0, 'number', 'design', {
      section: 'Spacing',
      min: 0,
      max: 240,
    }),
    field('backgroundColor', 'Background', container.backgroundColor ?? 'transparent', 'color', 'design', {
      section: 'Surface',
    }),
    field('borderRadius', 'Border radius', container.borderRadius ?? 0, 'number', 'design', {
      section: 'Border & shadow',
      min: 0,
      max: 240,
    }),
    field('borderWidth', 'Border width', container.borderWidth ?? 0, 'number', 'design', {
      section: 'Border & shadow',
      min: 0,
      max: 32,
    }),
    field('borderColor', 'Border color', container.borderColor ?? '#374151', 'color', 'design', {
      section: 'Border & shadow',
    }),
    field('shadow', 'Shadow', container.shadow ?? 'none', 'select', 'design', {
      section: 'Border & shadow',
      options: SHADOW_OPTIONS,
    }),

    field('layoutColumn', 'Layout column', container.layoutColumn ?? '', 'number', 'settings', {
      section: 'Grid',
      min: 1,
      max: 3,
    }),
    field('columnSpan', 'Column span', container.columnSpan ?? '', 'number', 'settings', {
      section: 'Grid',
      min: 1,
      max: 3,
    }),
  ];
}

function buildFormFieldFields(
  formField: Record<string, unknown>,
): EditorInspectorField[] {
  const options = Array.isArray(formField.options)
    ? formField.options.join(', ')
    : String(formField.options || '');

  return [
    field('label', 'Label', formField.label ?? '', 'text', 'content', {
      section: 'Field',
    }),
    field('name', 'Field name', formField.name ?? '', 'text', 'content', {
      section: 'Field',
    }),
    field('type', 'Type', formField.type ?? 'text', 'select', 'content', {
      section: 'Field',
      options: ['text', 'email', 'tel', 'url', 'number', 'date', 'textarea', 'select', 'radio', 'checkbox', 'file'],
    }),
    field('placeholder', 'Placeholder', formField.placeholder ?? '', 'text', 'content', {
      section: 'Field',
    }),
    field('options', 'Options', options, 'textarea', 'content', {
      section: 'Field',
      placeholder: 'Option 1, Option 2, Option 3',
    }),
    field('required', 'Required', Boolean(formField.required), 'toggle', 'settings', {
      section: 'Validation',
    }),
  ];
}

export function buildEditorInspectorFields<P extends EditorProjectLike>(
  project: P,
  selection: EditorSelection,
): EditorInspectorField[] {
  if (!selection.pageId) return [];

  const page = findEditorPage(project, selection.pageId)?.page;
  if (!page) return [];

  if (!selection.sectionId) {
    return [
      field('name', 'Page name', page.name || '', 'text', 'content', {
        section: 'Page',
      }),
      field('slug', 'Slug', page.slug || '', 'text', 'settings', {
        section: 'URL',
        placeholder: '/about',
      }),
      field('seoTitle', 'SEO title', page.seoTitle || '', 'text', 'content', {
        section: 'SEO',
      }),
      field('seoDescription', 'SEO description', page.seoDescription || '', 'textarea', 'content', {
        section: 'SEO',
      }),
      field('canonicalUrl', 'Canonical URL', page.canonicalUrl || '', 'text', 'settings', {
        section: 'SEO',
        placeholder: 'https://example.com/page',
      }),
      field('socialImage', 'Social image URL', page.socialImage || '', 'text', 'settings', {
        section: 'SEO',
        placeholder: 'https://...',
      }),
      field('showInNavigation', 'Show in navigation', page.showInNavigation !== false, 'toggle', 'settings', {
        section: 'Navigation',
      }),
      field('noIndex', 'Hide from search engines', Boolean(page.noIndex), 'toggle', 'settings', {
        section: 'SEO',
      }),
      field('language', 'Page language', page.language || '', 'text', 'settings', {
        section: 'Localization',
        placeholder: 'en, sv, ar...',
      }),
      field('translationKey', 'Translation group', page.translationKey || '', 'text', 'settings', {
        section: 'Localization',
      }),
    ];
  }

  const section =
    findEditorSection(project, selection.pageId, selection.sectionId)?.section;
  if (!section) return [];

  if (selection.elementId) {
    const element =
      findEditorElement(
        project,
        selection.pageId,
        selection.sectionId,
        selection.elementId,
      )?.element;
    return element
      ? buildElementFields(element as Record<string, unknown>)
      : [];
  }

  if (selection.containerId) {
    const container = findContainer(section, selection.containerId);
    return container
      ? buildContainerFields(container as Record<string, unknown>)
      : [];
  }

  if (selection.formFieldId) {
    const formField = findFormField(section, selection.formFieldId);
    return formField
      ? buildFormFieldFields(formField as Record<string, unknown>)
      : [];
  }

  return buildSectionFields(section as Record<string, unknown>);
}

export function patchForEditorInspectorField(
  key: string,
  value: unknown,
) {
  const parts = key.split('.').filter(Boolean);
  if (
    !parts.length ||
    parts.length > 4 ||
    parts.some(
      (part) =>
        part.length > 80 ||
        editorPayloadHasForbiddenKey(part),
    )
  ) {
    return {};
  }

  if (parts.length === 1) {
    return { [key]: value };
  }

  const root: Record<string, unknown> = {};
  let cursor = root;

  for (let index = 0; index < parts.length - 1; index += 1) {
    const next: Record<string, unknown> = {};
    cursor[parts[index]] = next;
    cursor = next;
  }

  cursor[parts[parts.length - 1]] = value;
  return root;
}
