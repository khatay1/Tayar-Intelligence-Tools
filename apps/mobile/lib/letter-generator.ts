export type LetterType = 'recommendation' | 'authorization' | 'business-inquiry' | 'complaint' | 'resignation' | 'thank-you';
export type LetterTone = 'professional' | 'warm' | 'concise';
export type LetterInput = { type: LetterType; tone: LetterTone; senderName: string; recipientName: string; organization: string; subject: string; details: string; date: string };

export const LETTER_TYPES: Array<{ value: LetterType; label: string; hint: string }> = [
  { value: 'recommendation', label: 'Recommendation', hint: 'Recommend a person for work, study or another opportunity.' },
  { value: 'authorization', label: 'Authorization', hint: 'Authorize a person to act or collect something on your behalf.' },
  { value: 'business-inquiry', label: 'Business Inquiry', hint: 'Ask a company about products, services, pricing or cooperation.' },
  { value: 'complaint', label: 'Complaint', hint: 'Describe an issue clearly and request a reasonable resolution.' },
  { value: 'resignation', label: 'Resignation', hint: 'Submit a professional notice of resignation.' },
  { value: 'thank-you', label: 'Thank-you', hint: 'Send a professional or warm note of appreciation.' },
];

export const LETTER_TONES: Array<{ value: LetterTone; label: string }> = [
  { value: 'professional', label: 'Professional' }, { value: 'warm', label: 'Warm' }, { value: 'concise', label: 'Concise' },
];

const TONE_OPENERS: Record<LetterTone, string> = { professional: 'I am writing regarding', warm: 'I am pleased to write regarding', concise: 'I am writing about' };
const TONE_CLOSINGS: Record<LetterTone, string> = { professional: 'Thank you for your time and consideration.', warm: 'Thank you sincerely for your time and consideration.', concise: 'Thank you for your consideration.' };

function short(value: string) { return value.trim().slice(0, 120); }
function details(value: string) { return value.trim().slice(0, 2500); }
function salutation(recipient: string) { return recipient ? `Dear ${recipient},` : 'Dear Sir or Madam,'; }
function signature(sender: string) { return sender ? `Sincerely,\n${sender}` : 'Sincerely,'; }

export function generateLetter(input: LetterInput) {
  const sender = short(input.senderName); const recipient = short(input.recipientName); const organization = short(input.organization); const subject = short(input.subject); const bodyDetails = details(input.details); const date = short(input.date); const opener = TONE_OPENERS[input.tone]; const closing = TONE_CLOSINGS[input.tone]; const topic = subject || 'this matter'; const orgPhrase = organization ? ` at ${organization}` : '';
  let body = '';
  if (input.type === 'recommendation') body = `${opener} my recommendation of ${recipient || 'the person named above'}${orgPhrase}. ${bodyDetails || 'Based on my experience with them, I have found them to be dependable, capable and committed to their responsibilities.'}\n\nI believe they would bring a thoughtful and responsible approach to the opportunity under consideration. ${closing}`;
  if (input.type === 'authorization') body = `I, ${sender || 'the undersigned'}, authorize ${recipient || 'the person named above'} to act on my behalf regarding ${topic}${orgPhrase}.\n\n${bodyDetails || 'This authorization is limited to the purpose described above and should not be interpreted as permission for unrelated actions.'}\n\nPlease contact me if further confirmation is required. ${closing}`;
  if (input.type === 'business-inquiry') body = `${opener} ${topic}${orgPhrase}.\n\n${bodyDetails || 'I would appreciate more information about your available options, pricing, terms and any relevant next steps.'}\n\nPlease let me know who the appropriate contact person is or how we can continue the discussion. ${closing}`;
  if (input.type === 'complaint') body = `${opener} ${topic}${orgPhrase}.\n\n${bodyDetails || 'I would like this issue to be reviewed and resolved fairly. Please confirm the next steps and any information you need from me.'}\n\nI would appreciate a clear response and a reasonable resolution. ${closing}`;
  if (input.type === 'resignation') body = `Please accept this letter as formal notice of my resignation${organization ? ` from ${organization}` : ''}. ${bodyDetails || 'I will do my best to support an orderly handover of my current responsibilities during the notice period.'}\n\nI appreciate the opportunities and experience I have gained during my time here. ${closing}`;
  if (input.type === 'thank-you') body = `I am writing to express my appreciation regarding ${topic}${orgPhrase}.\n\n${bodyDetails || 'Your time, support and consideration have been genuinely appreciated.'}\n\nThank you again. I value the help and consideration you have provided.`;
  return [date, sender, organization, subject ? `Subject: ${subject}` : '', salutation(recipient), body, signature(sender)].filter(Boolean).join('\n\n');
}

export function safeLetterFileName(subject: string, type: string) {
  const source = subject.trim() || type;
  const base = source.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'letter';
  return `${base}-tayar.txt`;
}
