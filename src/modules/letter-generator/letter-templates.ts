import { LetterTone, LetterType } from './letter-types';

export const LETTER_TYPES: Array<{ value: LetterType; label: string; hint: string }> = [
  { value: 'recommendation', label: 'Recommendation Letter', hint: 'Recommend a person for work, study or another opportunity.' },
  { value: 'authorization', label: 'Authorization Letter', hint: 'Authorize a person to act or collect something on your behalf.' },
  { value: 'business-inquiry', label: 'Business Inquiry', hint: 'Ask a company about products, services, pricing or cooperation.' },
  { value: 'complaint', label: 'Complaint Letter', hint: 'Describe an issue clearly and request a reasonable resolution.' },
  { value: 'resignation', label: 'Resignation Letter', hint: 'Submit a professional notice of resignation.' },
  { value: 'thank-you', label: 'Thank-you Letter', hint: 'Send a professional or warm note of appreciation.' },
];

export const TONES: Array<{ value: LetterTone; label: string }> = [
  { value: 'professional', label: 'Professional' },
  { value: 'warm', label: 'Warm' },
  { value: 'concise', label: 'Concise' },
];

export const TONE_OPENERS: Record<LetterTone, string> = {
  professional: 'I am writing regarding',
  warm: 'I am pleased to write regarding',
  concise: 'I am writing about',
};

export const TONE_CLOSINGS: Record<LetterTone, string> = {
  professional: 'Thank you for your time and consideration.',
  warm: 'Thank you sincerely for your time and consideration.',
  concise: 'Thank you for your consideration.',
};
