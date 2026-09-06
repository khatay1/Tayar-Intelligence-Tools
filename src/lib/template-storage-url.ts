const TEMPLATE_PREFIX = '24billions/';
const PRODUCTION_TEMPLATE_BASE_URL = 'https://templates.tayar.se';

function assertSafeTemplatePath(value: unknown) {
  const path = typeof value === 'string' ? value.trim() : '';
  const unsafeSegment = path.split('/').some(segment => segment === '.' || segment === '..');
  if (
    !path.startsWith(TEMPLATE_PREFIX)
    || path.startsWith('/')
    || unsafeSegment
    || path.includes('\\')
  ) {
    throw new Error('Template storage path is invalid.');
  }
  return path;
}

function configuredBaseUrl() {
  const fallback = import.meta.env.PROD ? PRODUCTION_TEMPLATE_BASE_URL : '';
  const raw = String(import.meta.env.VITE_TEMPLATE_LIBRARY_BASE_URL || fallback).trim();
  if (!raw) return '';

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') return '';
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

export function hasExternalTemplateStorage() {
  return Boolean(configuredBaseUrl());
}

export function externalTemplateUrl(storagePath: string) {
  const baseUrl = configuredBaseUrl();
  if (!baseUrl) return null;

  const safePath = assertSafeTemplatePath(storagePath);
  const encodedPath = safePath
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');

  return `${baseUrl}/${encodedPath}`;
}

export function validateTemplateStoragePath(storagePath: unknown) {
  return assertSafeTemplatePath(storagePath);
}
