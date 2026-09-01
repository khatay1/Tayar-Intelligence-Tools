import type {
  EditorElementLike,
  EditorPageLike,
  EditorSectionLike,
} from './editor-model';

export interface EditorSemanticValidationResult {
  ok: boolean;
  errors: string[];
}

export type EditorSemanticRecordKind =
  | 'page'
  | 'section'
  | 'element'
  | 'container'
  | 'form-field'
  | 'theme'
  | 'seo'
  | 'header'
  | 'restyle';

const SECTION_TYPES = new Set([
  'hero',
  'features',
  'about',
  'services',
  'pricing',
  'testimonials',
  'contact',
  'footer',
]);

const ELEMENT_TYPES = new Set([
  'heading',
  'text',
  'button',
  'image',
  'video',
  'list',
  'divider',
  'spacer',
  'accordion',
  'tabs',
  'gallery',
  'embed',
  'code',
  'countdown',
  'stats',
  'testimonials-slider',
]);

const SECTION_LAYOUTS = new Set(['stack', 'two-column', 'three-column']);
const SECTION_ALIGNS = new Set(['start', 'center', 'end', 'stretch']);
const SECTION_BACKGROUND_MODES = new Set(['color', 'gradient', 'image']);
const SECTION_BACKGROUND_POSITIONS = new Set([
  'center',
  'top',
  'bottom',
  'left',
  'right',
]);
const SECTION_BACKGROUND_SIZES = new Set(['cover', 'contain', 'auto']);
const SECTION_CONTENT_WIDTHS = new Set(['boxed', 'full']);
const ELEMENT_TEXT_ALIGNS = new Set(['left', 'center', 'right']);
const ELEMENT_SELF_ALIGNS = new Set([
  'auto',
  'start',
  'center',
  'end',
  'stretch',
]);
const BORDER_STYLES = new Set(['solid', 'dashed', 'dotted']);
const SHADOWS = new Set(['none', 'sm', 'md', 'lg', 'xl']);
const ANIMATIONS = new Set([
  'none',
  'fade',
  'fade-up',
  'fade-down',
  'fade-left',
  'fade-right',
  'zoom-in',
  'zoom-out',
]);
const CONTAINER_LAYOUTS = new Set(['stack', 'row']);
const CONTAINER_ALIGNS = new Set(['start', 'center', 'end', 'stretch']);
const FORM_FIELD_TYPES = new Set([
  'text',
  'email',
  'tel',
  'textarea',
  'select',
  'checkbox',
]);
const FORM_SUCCESS_ACTIONS = new Set(['message', 'redirect']);
const FONT_FAMILIES = new Set([
  'Inter',
  'Arial',
  'Georgia',
  'Trebuchet MS',
  'Courier New',
  'system-ui',
]);

// Multiline editor text allows \u0009, \u000A and \u000D, but rejects \u000B and other controls.
const CONTROL_CHARACTER_PATTERN = {
  test(value: string) {
    for (let index = 0; index < value.length; index += 1) {
      const code = value.charCodeAt(index);
      if (
        code === 0x7f ||
        (code <= 0x1f &&
          code !== 0x09 &&
          code !== 0x0a &&
          code !== 0x0d)
      ) {
        return true;
      }
    }
    return false;
  },
};

const URL_CONTROL_CHARACTER_PATTERN = {
  test(value: string) {
    for (let index = 0; index < value.length; index += 1) {
      const code = value.charCodeAt(index);
      if (code <= 0x1f || code === 0x7f) {
        return true;
      }
    }
    return false;
  },
};
const HEX_6_PATTERN = /^#[0-9a-f]{6}$/i;
const CSS_COLOR_PATTERN = /^(?:#[0-9a-f]{3,4}|#[0-9a-f]{6}|#[0-9a-f]{8}|transparent)$/i;
const LANGUAGE_PATTERN = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/;
const ANCHOR_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,119}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function pushError(errors: string[], label: string, message: string) {
  if (errors.length >= 50) return;
  errors.push(`${label} ${message}`);
}

function optionalString(
  record: Record<string, unknown>,
  key: string,
  errors: string[],
  label: string,
  maxLength: number,
  options: { allowEmpty?: boolean; trimmed?: boolean } = {},
) {
  const value = record[key];
  if (value === undefined) return;
  if (typeof value !== 'string') {
    pushError(errors, `${label}.${key}`, 'must be a string');
    return;
  }
  if (CONTROL_CHARACTER_PATTERN.test(value)) {
    pushError(errors, `${label}.${key}`, 'cannot contain control characters');
  }
  if (value.length > maxLength) {
    pushError(errors, `${label}.${key}`, `exceeds ${maxLength} characters`);
  }
  if (options.trimmed && value !== value.trim()) {
    pushError(errors, `${label}.${key}`, 'cannot contain surrounding whitespace');
  }
  if (options.allowEmpty === false && !value.trim()) {
    pushError(errors, `${label}.${key}`, 'cannot be blank');
  }
}

function optionalBoolean(
  record: Record<string, unknown>,
  key: string,
  errors: string[],
  label: string,
) {
  const value = record[key];
  if (value !== undefined && typeof value !== 'boolean') {
    pushError(errors, `${label}.${key}`, 'must be a boolean');
  }
}

function optionalNumber(
  record: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
  errors: string[],
  label: string,
  options: { integer?: boolean; step?: number } = {},
) {
  const value = record[key];
  if (value === undefined) return;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    pushError(errors, `${label}.${key}`, 'must be a finite number');
    return;
  }
  if (value < min || value > max) {
    pushError(errors, `${label}.${key}`, `must be between ${min} and ${max}`);
  }
  if (options.integer && !Number.isInteger(value)) {
    pushError(errors, `${label}.${key}`, 'must be an integer');
  }
  if (
    options.step &&
    Math.abs(value / options.step - Math.round(value / options.step)) > 1e-8
  ) {
    pushError(errors, `${label}.${key}`, `must use increments of ${options.step}`);
  }
}

function optionalEnum(
  record: Record<string, unknown>,
  key: string,
  values: ReadonlySet<string>,
  errors: string[],
  label: string,
) {
  const value = record[key];
  if (value === undefined) return;
  if (typeof value !== 'string' || !values.has(value)) {
    pushError(
      errors,
      `${label}.${key}`,
      `must be one of: ${[...values].join(', ')}`,
    );
  }
}

function optionalColor(
  record: Record<string, unknown>,
  key: string,
  errors: string[],
  label: string,
  strictHex = false,
) {
  const value = record[key];
  if (value === undefined) return;
  const pattern = strictHex ? HEX_6_PATTERN : CSS_COLOR_PATTERN;
  if (typeof value !== 'string' || !pattern.test(value)) {
    pushError(
      errors,
      `${label}.${key}`,
      strictHex
        ? 'must be a 6-digit hex color'
        : 'must be a supported CSS color',
    );
  }
}

function hasSafeUrlCharacters(value: string) {
  return (
    !URL_CONTROL_CHARACTER_PATTERN.test(value) &&
    !/[<>\\"']/.test(value) &&
    value === value.trim()
  );
}

function validHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function validLinkUrl(value: string) {
  if (!value) return true;
  if (!hasSafeUrlCharacters(value)) return false;
  if (
    value.startsWith('#') ||
    value.startsWith('/') ||
    value.startsWith('./') ||
    value.startsWith('../')
  ) {
    return !value.startsWith('//');
  }
  if (/^(?:mailto|tel):/i.test(value)) return true;
  if (/^page:[a-z0-9][a-z0-9-]{0,239}$/i.test(value)) return true;
  return validHttpUrl(value);
}

function validMediaUrl(value: string) {
  if (!value) return true;
  if (!hasSafeUrlCharacters(value)) return false;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  return validHttpUrl(value);
}

function optionalUrl(
  record: Record<string, unknown>,
  key: string,
  mode: 'link' | 'media' | 'http',
  errors: string[],
  label: string,
  maxLength = 2000,
) {
  const value = record[key];
  if (value === undefined) return;
  if (typeof value !== 'string') {
    pushError(errors, `${label}.${key}`, 'must be a URL string');
    return;
  }
  if (value.length > maxLength) {
    pushError(errors, `${label}.${key}`, `exceeds ${maxLength} characters`);
    return;
  }
  const valid =
    mode === 'link'
      ? validLinkUrl(value)
      : mode === 'media'
        ? validMediaUrl(value)
        : value === '' || validHttpUrl(value);
  if (!valid) {
    pushError(errors, `${label}.${key}`, 'uses an unsupported or malformed URL');
  }
}

function validatePageRecord(
  record: Record<string, unknown>,
  errors: string[],
  label: string,
) {
  optionalString(record, 'name', errors, label, 120, { allowEmpty: false });
  optionalString(record, 'slug', errors, label, 240, { trimmed: true });
  if (
    typeof record.slug === 'string' &&
    (/[\s?#]/.test(record.slug) || record.slug.includes('..'))
  ) {
    pushError(errors, `${label}.slug`, 'contains unsafe URL-path characters');
  }
  optionalString(record, 'seoTitle', errors, label, 160);
  optionalString(record, 'seoDescription', errors, label, 1000);
  optionalUrl(record, 'canonicalUrl', 'http', errors, label);
  optionalUrl(record, 'socialImage', 'media', errors, label);
  optionalBoolean(record, 'showInNavigation', errors, label);
  optionalBoolean(record, 'noIndex', errors, label);
  optionalString(record, 'language', errors, label, 40, {
    allowEmpty: true,
    trimmed: true,
  });
  if (
    typeof record.language === 'string' &&
    record.language &&
    !LANGUAGE_PATTERN.test(record.language)
  ) {
    pushError(errors, `${label}.language`, 'must use a valid language tag');
  }
  optionalString(record, 'translationKey', errors, label, 160, {
    trimmed: true,
  });
}

function validateSectionResponsive(
  value: unknown,
  errors: string[],
  label: string,
) {
  if (value === undefined) return;
  if (!isRecord(value)) {
    pushError(errors, label, 'must be an object');
    return;
  }
  const devices = new Set(['desktop', 'tablet', 'mobile']);
  for (const [device, style] of Object.entries(value)) {
    if (!devices.has(device)) {
      pushError(errors, label, `contains unsupported device ${device}`);
      continue;
    }
    if (!isRecord(style)) {
      pushError(errors, `${label}.${device}`, 'must be an object');
      continue;
    }
    optionalNumber(style, 'minHeight', 0, 1600, errors, `${label}.${device}`);
    optionalNumber(style, 'sectionPaddingY', 0, 240, errors, `${label}.${device}`);
    optionalNumber(style, 'sectionPaddingX', 0, 160, errors, `${label}.${device}`);
    optionalNumber(style, 'layoutGap', 0, 80, errors, `${label}.${device}`);
  }
}

function validateSectionRecord(
  record: Record<string, unknown>,
  errors: string[],
  label: string,
) {
  optionalEnum(record, 'type', SECTION_TYPES, errors, label);
  optionalString(record, 'title', errors, label, 500);
  optionalString(record, 'description', errors, label, 20_000);
  optionalString(record, 'buttonText', errors, label, 200);
  optionalUrl(record, 'buttonUrl', 'link', errors, label);
  optionalColor(record, 'background', errors, label, true);
  optionalColor(record, 'accent', errors, label, true);
  optionalUrl(record, 'image', 'media', errors, label, 5000);
  optionalString(record, 'imagePrompt', errors, label, 8000);
  optionalString(record, 'formSuccessMessage', errors, label, 2000);
  optionalEnum(record, 'formSuccessAction', FORM_SUCCESS_ACTIONS, errors, label);
  optionalUrl(record, 'formRedirectUrl', 'link', errors, label);
  optionalString(record, 'anchorId', errors, label, 120, { trimmed: true });
  if (
    typeof record.anchorId === 'string' &&
    record.anchorId &&
    !ANCHOR_PATTERN.test(record.anchorId)
  ) {
    pushError(
      errors,
      `${label}.anchorId`,
      'must start with a letter and contain only letters, numbers, _ or -',
    );
  }
  optionalEnum(record, 'layout', SECTION_LAYOUTS, errors, label);
  optionalNumber(record, 'layoutGap', 0, 80, errors, label);
  optionalEnum(record, 'layoutAlign', SECTION_ALIGNS, errors, label);
  optionalEnum(record, 'backgroundMode', SECTION_BACKGROUND_MODES, errors, label);
  optionalUrl(record, 'backgroundImage', 'media', errors, label, 5000);
  optionalEnum(
    record,
    'backgroundPosition',
    SECTION_BACKGROUND_POSITIONS,
    errors,
    label,
  );
  optionalEnum(record, 'backgroundSize', SECTION_BACKGROUND_SIZES, errors, label);
  optionalColor(record, 'gradientFrom', errors, label, true);
  optionalColor(record, 'gradientTo', errors, label, true);
  optionalNumber(record, 'gradientAngle', 0, 360, errors, label);
  optionalColor(record, 'overlayColor', errors, label, true);
  optionalNumber(record, 'overlayOpacity', 0, 1, errors, label);
  optionalNumber(record, 'minHeight', 0, 1600, errors, label);
  optionalNumber(record, 'sectionPaddingY', 0, 240, errors, label);
  optionalNumber(record, 'sectionPaddingX', 0, 160, errors, label);
  optionalNumber(record, 'sectionRadius', 0, 240, errors, label);
  optionalEnum(record, 'contentWidth', SECTION_CONTENT_WIDTHS, errors, label);
  optionalBoolean(record, 'hidden', errors, label);
  validateSectionResponsive(record.responsive, errors, `${label}.responsive`);

  if (record.formFields !== undefined) {
    if (!Array.isArray(record.formFields)) {
      pushError(errors, `${label}.formFields`, 'must be an array');
    } else {
      record.formFields.forEach((field, index) => {
        if (!isRecord(field)) {
          pushError(
            errors,
            `${label}.formFields[${index}]`,
            'must be an object',
          );
          return;
        }
        const fieldLabel = `${label}.formFields[${index}]`;
        validateFormFieldRecord(
          field,
          errors,
          fieldLabel,
        );
        for (const requiredKey of ['name', 'label', 'type', 'required']) {
          if (field[requiredKey] === undefined) {
            pushError(
              errors,
              `${fieldLabel}.${requiredKey}`,
              'is required',
            );
          }
        }
      });
    }
  }

  if (
    record.formSuccessAction === 'redirect' &&
    typeof record.formRedirectUrl === 'string' &&
    !record.formRedirectUrl
  ) {
    pushError(
      errors,
      `${label}.formRedirectUrl`,
      'is required when formSuccessAction is redirect',
    );
  }
}

function validateElementStyle(
  value: unknown,
  errors: string[],
  label: string,
) {
  if (value === undefined) return;
  if (!isRecord(value)) {
    pushError(errors, label, 'must be an object');
    return;
  }

  optionalColor(value, 'color', errors, label);
  optionalColor(value, 'backgroundColor', errors, label);
  optionalNumber(value, 'fontSize', 8, 160, errors, label);
  optionalNumber(value, 'fontWeight', 100, 900, errors, label, {
    integer: true,
  });
  optionalEnum(value, 'textAlign', ELEMENT_TEXT_ALIGNS, errors, label);
  optionalNumber(value, 'padding', 0, 240, errors, label);
  optionalNumber(value, 'borderRadius', 0, 240, errors, label);
  optionalNumber(value, 'width', 0, 100, errors, label);
  optionalNumber(value, 'maxWidth', 0, 2400, errors, label);
  optionalNumber(value, 'marginTop', -240, 480, errors, label);
  optionalNumber(value, 'marginRight', -240, 480, errors, label);
  optionalNumber(value, 'marginBottom', -240, 480, errors, label);
  optionalNumber(value, 'marginLeft', -240, 480, errors, label);
  optionalNumber(value, 'positionX', -2000, 2000, errors, label);
  optionalNumber(value, 'positionY', -2000, 2000, errors, label);
  optionalNumber(value, 'order', -100, 100, errors, label, { integer: true });
  optionalBoolean(value, 'hidden', errors, label);
  optionalEnum(value, 'alignSelf', ELEMENT_SELF_ALIGNS, errors, label);
  optionalNumber(value, 'columnSpan', 1, 3, errors, label, { integer: true });
  optionalNumber(value, 'lineHeight', 0.5, 4, errors, label);
  optionalNumber(value, 'letterSpacing', -10, 40, errors, label);
  optionalNumber(value, 'opacity', 0, 1, errors, label);
  optionalNumber(value, 'rotate', -360, 360, errors, label);
  optionalNumber(value, 'borderWidth', 0, 32, errors, label);
  optionalColor(value, 'borderColor', errors, label);
  optionalEnum(value, 'borderStyle', BORDER_STYLES, errors, label);
  optionalEnum(value, 'shadow', SHADOWS, errors, label);
  optionalNumber(value, 'hoverScale', 0.5, 2, errors, label);
  optionalNumber(value, 'hoverOpacity', 0, 1, errors, label);
  optionalColor(value, 'hoverBackgroundColor', errors, label);
  optionalColor(value, 'hoverColor', errors, label);
  optionalEnum(value, 'hoverShadow', SHADOWS, errors, label);
  optionalEnum(value, 'animation', ANIMATIONS, errors, label);
  optionalNumber(value, 'animationDuration', 0, 10_000, errors, label);
  optionalNumber(value, 'animationDelay', 0, 10_000, errors, label);
  optionalNumber(value, 'animationDistance', 0, 1000, errors, label);
}

function validateElementResponsive(
  value: unknown,
  errors: string[],
  label: string,
) {
  if (value === undefined) return;
  if (!isRecord(value)) {
    pushError(errors, label, 'must be an object');
    return;
  }
  const devices = new Set(['desktop', 'tablet', 'mobile']);
  for (const [device, style] of Object.entries(value)) {
    if (!devices.has(device)) {
      pushError(errors, label, `contains unsupported device ${device}`);
      continue;
    }
    validateElementStyle(style, errors, `${label}.${device}`);
  }
}

function validateElementRecord(
  record: Record<string, unknown>,
  errors: string[],
  label: string,
) {
  optionalEnum(record, 'type', ELEMENT_TYPES, errors, label);
  optionalString(record, 'content', errors, label, 100_000);
  optionalUrl(record, 'href', 'link', errors, label, 5000);
  optionalUrl(record, 'src', 'media', errors, label, 5000);
  optionalString(record, 'alt', errors, label, 2000);
  optionalString(record, 'title', errors, label, 1000);
  validateElementStyle(record.style, errors, `${label}.style`);
  validateElementResponsive(record.responsive, errors, `${label}.responsive`);
  optionalNumber(record, 'layoutColumn', 1, 3, errors, label, { integer: true });
  optionalBoolean(record, 'animationOnce', errors, label);
  optionalBoolean(record, 'muted', errors, label);
}

function validateContainerRecord(
  record: Record<string, unknown>,
  errors: string[],
  label: string,
) {
  optionalString(record, 'name', errors, label, 80, { allowEmpty: false });
  optionalEnum(record, 'layout', CONTAINER_LAYOUTS, errors, label);
  optionalNumber(record, 'gap', 0, 80, errors, label);
  optionalEnum(record, 'align', CONTAINER_ALIGNS, errors, label);
  optionalColor(record, 'backgroundColor', errors, label);
  optionalNumber(record, 'padding', 0, 240, errors, label);
  optionalNumber(record, 'borderRadius', 0, 240, errors, label);
  optionalNumber(record, 'borderWidth', 0, 32, errors, label);
  optionalColor(record, 'borderColor', errors, label);
  optionalEnum(record, 'shadow', SHADOWS, errors, label);
  optionalNumber(record, 'layoutColumn', 1, 3, errors, label, { integer: true });
  optionalNumber(record, 'columnSpan', 1, 3, errors, label, { integer: true });
}

function validateFormFieldRecord(
  record: Record<string, unknown>,
  errors: string[],
  label: string,
) {
  optionalString(record, 'name', errors, label, 120, {
    allowEmpty: false,
    trimmed: true,
  });
  optionalString(record, 'label', errors, label, 240);
  optionalEnum(record, 'type', FORM_FIELD_TYPES, errors, label);
  optionalString(record, 'placeholder', errors, label, 500);
  optionalBoolean(record, 'required', errors, label);

  if (record.options !== undefined) {
    if (!Array.isArray(record.options)) {
      pushError(errors, `${label}.options`, 'must be an array');
    } else if (record.options.length > 50) {
      pushError(errors, `${label}.options`, 'cannot contain more than 50 values');
    } else {
      record.options.forEach((option, index) => {
        if (
          typeof option !== 'string' ||
          option.length > 500 ||
          CONTROL_CHARACTER_PATTERN.test(option)
        ) {
          pushError(
            errors,
            `${label}.options[${index}]`,
            'must be a short text value',
          );
        }
      });
    }
  }
}

function validateThemeRecord(
  record: Record<string, unknown>,
  errors: string[],
  label: string,
) {
  optionalColor(record, 'primaryColor', errors, label, true);
  optionalColor(record, 'secondaryColor', errors, label, true);
  optionalColor(record, 'backgroundColor', errors, label, true);
  optionalColor(record, 'textColor', errors, label, true);
  optionalColor(record, 'mutedTextColor', errors, label, true);
  optionalEnum(record, 'fontFamily', FONT_FAMILIES, errors, label);
  optionalNumber(record, 'contentWidth', 720, 1440, errors, label);
  optionalNumber(record, 'buttonRadius', 0, 40, errors, label);
  optionalNumber(record, 'sectionSpacing', 40, 140, errors, label);
}

function validateSeoRecord(
  record: Record<string, unknown>,
  errors: string[],
  label: string,
) {
  optionalString(record, 'title', errors, label, 160);
  optionalString(record, 'description', errors, label, 1000);
  if (record.keywords !== undefined) {
    if (!Array.isArray(record.keywords)) {
      pushError(errors, `${label}.keywords`, 'must be an array');
    } else if (record.keywords.length > 50) {
      pushError(errors, `${label}.keywords`, 'cannot contain more than 50 keywords');
    } else {
      record.keywords.forEach((keyword, index) => {
        if (
          typeof keyword !== 'string' ||
          keyword.length > 100 ||
          CONTROL_CHARACTER_PATTERN.test(keyword)
        ) {
          pushError(
            errors,
            `${label}.keywords[${index}]`,
            'must be a short text keyword',
          );
        }
      });
    }
  }
}

function validateHeaderRecord(
  record: Record<string, unknown>,
  errors: string[],
  label: string,
) {
  optionalBoolean(record, 'enabled', errors, label);
  optionalBoolean(record, 'sticky', errors, label);
  optionalBoolean(record, 'mobileMenu', errors, label);
  optionalBoolean(record, 'languageSwitcher', errors, label);
  optionalString(record, 'brandText', errors, label, 80);
  optionalUrl(record, 'logoUrl', 'media', errors, label, 1000);
  optionalBoolean(record, 'showCta', errors, label);
  optionalString(record, 'ctaLabel', errors, label, 80);
  optionalUrl(record, 'ctaHref', 'link', errors, label, 1000);
  optionalColor(record, 'backgroundColor', errors, label, true);
  optionalColor(record, 'textColor', errors, label, true);
  optionalColor(record, 'activeColor', errors, label, true);
  optionalColor(record, 'hoverColor', errors, label, true);
  optionalColor(record, 'ctaBackgroundColor', errors, label, true);
  optionalColor(record, 'ctaTextColor', errors, label, true);
  optionalNumber(record, 'navGap', 4, 48, errors, label);
  optionalNumber(record, 'brandSize', 12, 32, errors, label);
  optionalNumber(record, 'navSize', 10, 24, errors, label);
  optionalColor(record, 'borderColor', errors, label, true);
}

function validateRestyleRecord(
  record: Record<string, unknown>,
  errors: string[],
  label: string,
) {
  validateThemeRecord(record, errors, label);
  optionalColor(record, 'accentColor', errors, label, true);
}

export function inspectEditorSemanticRecord(
  kind: EditorSemanticRecordKind,
  value: unknown,
  label = kind,
): EditorSemanticValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { ok: false, errors: [`${label} must be an object`] };
  }

  if (kind === 'page') validatePageRecord(value, errors, label);
  else if (kind === 'section') validateSectionRecord(value, errors, label);
  else if (kind === 'element') validateElementRecord(value, errors, label);
  else if (kind === 'container') validateContainerRecord(value, errors, label);
  else if (kind === 'form-field') validateFormFieldRecord(value, errors, label);
  else if (kind === 'theme') validateThemeRecord(value, errors, label);
  else if (kind === 'seo') validateSeoRecord(value, errors, label);
  else if (kind === 'header') validateHeaderRecord(value, errors, label);
  else validateRestyleRecord(value, errors, label);

  return { ok: errors.length === 0, errors };
}

export function assertEditorSemanticRecord(
  kind: EditorSemanticRecordKind,
  value: unknown,
  label = kind,
) {
  const result = inspectEditorSemanticRecord(kind, value, label);
  if (!result.ok) {
    throw new Error(result.errors[0] || `${label} contains invalid values`);
  }
  return result;
}

export function inspectEditorElementSemantic(
  element: unknown,
  label = 'element',
): EditorSemanticValidationResult {
  const result = inspectEditorSemanticRecord('element', element, label);
  if (!result.ok || !isRecord(element)) return result;
  const errors = [...result.errors];

  if (
    typeof element.type !== 'string' ||
    !ELEMENT_TYPES.has(element.type)
  ) {
    pushError(errors, `${label}.type`, 'is required and must be a supported element type');
  }
  if (typeof element.content !== 'string') {
    pushError(errors, `${label}.content`, 'is required and must be a string');
  }
  if (!isRecord(element.style)) {
    pushError(errors, `${label}.style`, 'is required and must be an object');
  }

  return { ok: errors.length === 0, errors };
}

export function assertEditorElementSemantic(
  element: unknown,
  label = 'element',
) {
  const result = inspectEditorElementSemantic(element, label);
  if (!result.ok) throw new Error(result.errors[0] || `${label} is invalid`);
  return result;
}

export function inspectEditorContainerSemantic(
  container: unknown,
  label = 'container',
): EditorSemanticValidationResult {
  const result = inspectEditorSemanticRecord('container', container, label);
  if (!result.ok || !isRecord(container)) return result;
  const errors = [...result.errors];

  for (const key of [
    'name',
    'layout',
    'gap',
    'align',
    'backgroundColor',
    'padding',
    'borderRadius',
    'borderWidth',
    'borderColor',
    'shadow',
  ]) {
    if (container[key] === undefined) {
      pushError(errors, `${label}.${key}`, 'is required');
    }
  }

  return { ok: errors.length === 0, errors };
}

export function assertEditorContainerSemantic(
  container: unknown,
  label = 'container',
) {
  const result = inspectEditorContainerSemantic(container, label);
  if (!result.ok) throw new Error(result.errors[0] || `${label} is invalid`);
  return result;
}

export function inspectEditorFormFieldSemantic(
  field: unknown,
  label = 'formField',
): EditorSemanticValidationResult {
  const result = inspectEditorSemanticRecord('form-field', field, label);
  if (!result.ok || !isRecord(field)) return result;
  const errors = [...result.errors];

  for (const key of ['name', 'label', 'type', 'required']) {
    if (field[key] === undefined) {
      pushError(errors, `${label}.${key}`, 'is required');
    }
  }

  return { ok: errors.length === 0, errors };
}

export function assertEditorFormFieldSemantic(
  field: unknown,
  label = 'formField',
) {
  const result = inspectEditorFormFieldSemantic(field, label);
  if (!result.ok) throw new Error(result.errors[0] || `${label} is invalid`);
  return result;
}

export function inspectEditorSectionSemantic(
  section: unknown,
  label = 'section',
): EditorSemanticValidationResult {
  const result = inspectEditorSemanticRecord('section', section, label);
  if (!result.ok || !isRecord(section)) return result;
  const errors = [...result.errors];

  if (
    typeof section.type !== 'string' ||
    !SECTION_TYPES.has(section.type)
  ) {
    pushError(errors, `${label}.type`, 'is required and must be a supported section type');
  }

  for (const key of [
    'title',
    'description',
    'buttonText',
    'buttonUrl',
    'background',
    'accent',
  ]) {
    if (section[key] === undefined) {
      pushError(errors, `${label}.${key}`, 'is required');
    }
  }

  if (!Array.isArray(section.elements) || section.elements.length === 0) {
    pushError(errors, `${label}.elements`, 'must be a non-empty array');
  } else {
    section.elements.forEach((element, index) => {
      const nested = inspectEditorElementSemantic(
        element,
        `${label}.elements[${index}]`,
      );
      errors.push(...nested.errors);
    });
  }

  if (section.containers !== undefined) {
    if (!Array.isArray(section.containers)) {
      pushError(errors, `${label}.containers`, 'must be an array');
    } else {
      section.containers.forEach((container, index) => {
        const nested = inspectEditorContainerSemantic(
          container,
          `${label}.containers[${index}]`,
        );
        errors.push(...nested.errors);
      });
    }
  }

  if (section.formFields !== undefined) {
    if (!Array.isArray(section.formFields)) {
      pushError(errors, `${label}.formFields`, 'must be an array');
    } else {
      section.formFields.forEach((field, index) => {
        const nested = inspectEditorFormFieldSemantic(
          field,
          `${label}.formFields[${index}]`,
        );
        errors.push(...nested.errors);
      });
    }
  }

  return { ok: errors.length === 0, errors: errors.slice(0, 50) };
}

export function assertEditorSectionSemantic(
  section: unknown,
  label = 'section',
) {
  const result = inspectEditorSectionSemantic(section, label);
  if (!result.ok) throw new Error(result.errors[0] || `${label} is invalid`);
  return result;
}

export function inspectEditorPageSemantic(
  page: unknown,
  label = 'page',
): EditorSemanticValidationResult {
  const result = inspectEditorSemanticRecord('page', page, label);
  if (!result.ok || !isRecord(page)) return result;
  const errors = [...result.errors];

  if (typeof page.name !== 'string' || !page.name.trim()) {
    pushError(errors, `${label}.name`, 'is required and cannot be blank');
  }

  if (!Array.isArray(page.sections) || page.sections.length === 0) {
    pushError(errors, `${label}.sections`, 'must be a non-empty array');
  } else {
    page.sections.forEach((section, index) => {
      const nested = inspectEditorSectionSemantic(
        section,
        `${label}.sections[${index}]`,
      );
      errors.push(...nested.errors);
    });
  }

  return { ok: errors.length === 0, errors: errors.slice(0, 50) };
}

export function assertEditorPageSemantic(
  page: EditorPageLike,
  label = 'page',
) {
  const result = inspectEditorPageSemantic(page, label);
  if (!result.ok) throw new Error(result.errors[0] || `${label} is invalid`);
  return result;
}

export function assertEditorSectionLikeSemantic(
  section: EditorSectionLike,
  label = 'section',
) {
  return assertEditorSectionSemantic(section, label);
}

export function assertEditorElementLikeSemantic(
  element: EditorElementLike,
  label = 'element',
) {
  return assertEditorElementSemantic(element, label);
}
