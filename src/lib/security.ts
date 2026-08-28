// Input validation, XSS sanitization, and rate limiting utilities

const MAX_TEXT_LENGTH = 10_000;
const MAX_NAME_LENGTH = 100;
const MAX_SUBJECT_LENGTH = 200;

// Basic XSS sanitizer: strips <script> tags, event handlers, and javascript: URLs
export function sanitizeText(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/on\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/data:text\/html/gi, '')
    .trim();
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export function validateName(name: string): { valid: boolean; error?: string } {
  const trimmed = name.trim();
  if (!trimmed) return { valid: false, error: 'Name is required' };
  if (trimmed.length > MAX_NAME_LENGTH) return { valid: false, error: 'Name is too long' };
  if (!/^[\p{L}\s'.-]+$/u.test(trimmed)) return { valid: false, error: 'Name contains invalid characters' };
  return { valid: true };
}

export function validateMessage(message: string): { valid: boolean; error?: string } {
  const trimmed = message.trim();
  if (!trimmed) return { valid: false, error: 'Message is required' };
  if (trimmed.length > MAX_TEXT_LENGTH) return { valid: false, error: 'Message is too long (max 10,000 characters)' };
  return { valid: true };
}

export function validateSubject(subject: string): { valid: boolean; error?: string } {
  if (subject.length > MAX_SUBJECT_LENGTH) return { valid: false, error: 'Subject is too long' };
  return { valid: true };
}

// Simple client-side rate limiter using localStorage
const RATE_LIMIT_KEY = 'tayar-rate-limits';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export function checkRateLimit(action: string, maxRequests: number = 5, windowMs: number = 60_000): { allowed: boolean; retryAfterMs: number } {
  try {
    const limits = JSON.parse(localStorage.getItem(RATE_LIMIT_KEY) || '{}') as Record<string, RateLimitEntry>;
    const now = Date.now();
    const entry = limits[action];

    if (!entry || now > entry.resetAt) {
      limits[action] = { count: 1, resetAt: now + windowMs };
      localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(limits));
      return { allowed: true, retryAfterMs: 0 };
    }

    if (entry.count >= maxRequests) {
      return { allowed: false, retryAfterMs: entry.resetAt - now };
    }

    entry.count++;
    limits[action] = entry;
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(limits));
    return { allowed: true, retryAfterMs: 0 };
  } catch {
    return { allowed: true, retryAfterMs: 0 };
  }
}

export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) return { valid: false, error: 'Password must be at least 8 characters' };
  if (password.length > 128) return { valid: false, error: 'Password is too long' };
  if (!/[a-z]/.test(password)) return { valid: false, error: 'Password must contain a lowercase letter' };
  if (!/[A-Z]/.test(password)) return { valid: false, error: 'Password must contain an uppercase letter' };
  if (!/\d/.test(password)) return { valid: false, error: 'Password must contain a number' };
  return { valid: true };
}
