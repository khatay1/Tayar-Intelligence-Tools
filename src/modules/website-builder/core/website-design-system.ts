import type { WebsitePage, WebsiteTheme } from './website-builder-model';

export type WebsiteDesignSeverity = 'critical' | 'warning' | 'improvement';

export type WebsiteDesignIssue = {
  code: string;
  severity: WebsiteDesignSeverity;
  title: string;
  detail: string;
};

export type WebsiteDesignSystemReport = {
  score: number;
  issues: WebsiteDesignIssue[];
  metrics: {
    contrastFailures: number;
    customColors: number;
    fontSizes: number;
    radiusValues: number;
    offGridSpacing: number;
  };
};

export type WebsiteDesignSystemPreset = {
  id: 'saas' | 'editorial' | 'bold' | 'calm';
  name: string;
  description: string;
  theme: WebsiteTheme;
};

export const WEBSITE_DESIGN_SYSTEM_PRESETS: WebsiteDesignSystemPreset[] = [
  { id: 'saas', name: 'SaaS clarity', description: 'Crisp violet product system', theme: { primaryColor: '#7c3aed', secondaryColor: '#111827', backgroundColor: '#030712', textColor: '#f9fafb', mutedTextColor: '#d1d5db', fontFamily: 'Inter', contentWidth: 1200, buttonRadius: 12, sectionSpacing: 88 } },
  { id: 'editorial', name: 'Editorial', description: 'Warm, spacious publishing system', theme: { primaryColor: '#9a3412', secondaryColor: '#f5f0e8', backgroundColor: '#fffdf8', textColor: '#1c1917', mutedTextColor: '#57534e', fontFamily: 'Georgia', contentWidth: 1080, buttonRadius: 4, sectionSpacing: 104 } },
  { id: 'bold', name: 'Bold studio', description: 'High-contrast creative system', theme: { primaryColor: '#facc15', secondaryColor: '#18181b', backgroundColor: '#09090b', textColor: '#fafafa', mutedTextColor: '#d4d4d8', fontFamily: 'Trebuchet MS', contentWidth: 1280, buttonRadius: 20, sectionSpacing: 96 } },
  { id: 'calm', name: 'Calm service', description: 'Accessible blue service system', theme: { primaryColor: '#1d4ed8', secondaryColor: '#e0f2fe', backgroundColor: '#f8fafc', textColor: '#0f172a', mutedTextColor: '#475569', fontFamily: 'Inter', contentWidth: 1120, buttonRadius: 10, sectionSpacing: 80 } },
];

function rgb(hex: string) {
  const raw = hex.replace('#', '');
  const value = /^[0-9a-f]{3}$/i.test(raw) ? raw.split('').map((part) => part + part).join('') : raw;
  if (!/^[0-9a-f]{6}$/i.test(value)) return null;
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
}

function luminance(hex: string) {
  const color = rgb(hex);
  if (!color) return 0;
  const channels = color.map((value) => {
    const normalized = value / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function contrastRatio(foreground: string, background: string) {
  if (!rgb(foreground) || !rgb(background)) return NaN;
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function accessibleText(background: string) {
  const dark = '#111827';
  const light = '#f9fafb';
  const darkRatio = contrastRatio(dark, background);
  const lightRatio = contrastRatio(light, background);
  const best = darkRatio >= lightRatio ? dark : light;
  return best;
}

function nearest(value: number, scale: number[]) {
  let best = scale[0];
  for (const candidate of scale) {
    if (Math.abs(candidate - value) < Math.abs(best - value)) best = candidate;
  }
  return best;
}

export function repairWebsiteDesignTheme(theme: WebsiteTheme): WebsiteTheme {
  const textColor = contrastRatio(theme.textColor, theme.backgroundColor) >= 4.5
    ? theme.textColor
    : accessibleText(theme.backgroundColor);
  const mutedTextColor = contrastRatio(theme.mutedTextColor, theme.backgroundColor) >= 4.5
    ? theme.mutedTextColor
    : accessibleText(theme.backgroundColor);
  return {
    ...theme,
    textColor,
    mutedTextColor,
    contentWidth: nearest(theme.contentWidth, [960, 1080, 1120, 1200, 1280, 1360]),
    buttonRadius: nearest(theme.buttonRadius, [0, 4, 8, 10, 12, 16, 20, 24, 32]),
    sectionSpacing: nearest(theme.sectionSpacing, [48, 64, 72, 80, 88, 96, 104, 112, 128]),
  };
}

export function analyzeWebsiteDesignSystem(theme: WebsiteTheme, pages: WebsitePage[]): WebsiteDesignSystemReport {
  const issues: WebsiteDesignIssue[] = [];
  const contrastPairs = [
    ['Body text', theme.textColor, theme.backgroundColor, 4.5],
    ['Muted text', theme.mutedTextColor, theme.backgroundColor, 4.5],
    ['Text on secondary surface', theme.textColor, theme.secondaryColor, 4.5],
    ['Primary accent', theme.primaryColor, theme.backgroundColor, 3],
  ] as const;
  let contrastFailures = 0;
  contrastPairs.forEach(([label, foreground, background, minimum]) => {
    const ratio = contrastRatio(foreground, background);
    if (!Number.isFinite(ratio) || ratio >= minimum) return;
    contrastFailures += 1;
    issues.push({
      code: `contrast-${label.toLowerCase().replace(/\s+/g, '-')}`,
      severity: 'warning',
      title: `${label} contrast is too low`,
      detail: `${ratio.toFixed(2)}:1 contrast; target at least ${minimum}:1.`,
    });
  });

  const tokenColors = new Set([theme.primaryColor, theme.secondaryColor, theme.backgroundColor, theme.textColor, theme.mutedTextColor].map((value) => value.toLowerCase()));
  const customColors = new Set<string>();
  const fontSizes = new Set<number>();
  const radii = new Set<number>([theme.buttonRadius]);
  let offGridSpacing = 0;
  let tinyText = 0;
  let tightLines = 0;

  pages.forEach((page) => page.sections.forEach((section) => {
    [section.background, section.accent].forEach((value) => {
      if (/^#[0-9a-f]{6}$/i.test(value || '') && !tokenColors.has(value.toLowerCase())) customColors.add(value.toLowerCase());
    });
    (section.elements || []).forEach((element) => {
      const style = element.style || {};
      [style.color, style.backgroundColor, style.borderColor].forEach((value) => {
        if (value && /^#[0-9a-f]{6}$/i.test(value) && !tokenColors.has(value.toLowerCase())) customColors.add(value.toLowerCase());
      });
      const textElement = ['heading', 'text', 'button', 'list'].includes(element.type);
      const visibleText = textElement && style.hidden !== true && style.opacity !== 0 && Boolean(element.content?.trim());
      if (visibleText && Number.isFinite(style.fontSize)) {
        fontSizes.add(Number(style.fontSize));
        if (Number(style.fontSize) < 12) tinyText += 1;
      }
      if (visibleText && style.color && !section.backgroundImage && !element.containerId && (style.opacity === undefined || style.opacity === 1)) {
        const background = style.backgroundColor && style.backgroundColor !== 'transparent' ? style.backgroundColor : section.background;
        const ratio = contrastRatio(style.color, background || '');
        const large = Number(style.fontSize) >= 24 || (Number(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700);
        const minimum = large ? 3 : 4.5;
        if (Number.isFinite(ratio) && ratio < minimum) {
          contrastFailures += 1;
          issues.push({ code: `element-contrast-${page.id}-${section.id}-${element.id}`, severity: 'critical',
            title: 'Element text contrast is too low', detail: `${element.content.slice(0, 60)}: ${ratio.toFixed(2)}:1 contrast; target at least ${minimum}:1.` });
        }
      }
      if (Number.isFinite(style.borderRadius)) radii.add(Number(style.borderRadius));
      if (visibleText && Number.isFinite(style.lineHeight) && Number(style.lineHeight) < 1.2) tightLines += 1;
      [style.padding, style.marginTop, style.marginRight, style.marginBottom, style.marginLeft].forEach((value) => {
        if (Number.isFinite(value) && Number(value) % 4 !== 0) offGridSpacing += 1;
      });
    });
  }));

  if (customColors.size > 8) issues.push({ code: 'color-drift', severity: 'warning', title: 'Color tokens are drifting', detail: `${customColors.size} colors sit outside the five global color tokens.` });
  if (fontSizes.size > 8) issues.push({ code: 'type-scale', severity: 'warning', title: 'Typography scale is fragmented', detail: `${fontSizes.size} distinct font sizes are used; keep a focused 5–8 step scale.` });
  if (radii.size > 6) issues.push({ code: 'radius-scale', severity: 'improvement', title: 'Radius scale is inconsistent', detail: `${radii.size} distinct corner-radius values are used.` });
  if (offGridSpacing > 8) issues.push({ code: 'spacing-grid', severity: 'improvement', title: 'Spacing is off the 4px grid', detail: `${offGridSpacing} spacing values do not align to the shared grid.` });
  if (tinyText) issues.push({ code: 'tiny-text', severity: 'critical', title: 'Text is too small', detail: `${tinyText} element${tinyText === 1 ? '' : 's'} use text below 12px.` });
  if (tightLines) issues.push({ code: 'line-height', severity: 'warning', title: 'Line height is too tight', detail: `${tightLines} text element${tightLines === 1 ? '' : 's'} use line height below 1.2.` });

  const deduction = issues.reduce((sum, issue) => sum + (issue.severity === 'critical' ? 14 : issue.severity === 'warning' ? 7 : 3), 0);
  return {
    score: Math.max(0, 100 - deduction),
    issues: issues.slice(0, 20),
    metrics: { contrastFailures, customColors: customColors.size, fontSizes: fontSizes.size, radiusValues: radii.size, offGridSpacing },
  };
}

/** Update only text colors bound to global tokens; keep custom section styling. */
export function repairWebsiteDesignTokens(theme: WebsiteTheme, pages: WebsitePage[]) {
  const nextTheme = repairWebsiteDesignTheme(theme);
  const nextPages = pages.map((page) => ({ ...page, sections: page.sections.map((section) => ({
    ...section,
    elements: section.elements.map((element) => {
      const color = element.style?.color;
      if (!color || !['heading', 'text', 'button', 'list'].includes(element.type)) return element;
      const token = color.toLowerCase() === theme.textColor.toLowerCase() ? nextTheme.textColor
        : color.toLowerCase() === theme.mutedTextColor.toLowerCase() ? nextTheme.mutedTextColor : null;
      if (!token) return element;
      const surface = element.style?.backgroundColor || section.background;
      const nextColor = !section.backgroundImage && !element.containerId && contrastRatio(token, surface) < 4.5 ? accessibleText(surface) : token;
      return nextColor === color ? element : { ...element, style: { ...element.style, color: nextColor } };
    }),
  })) }));
  return { theme: nextTheme, pages: nextPages };
}
