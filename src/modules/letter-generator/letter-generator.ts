import { TONE_CLOSINGS, TONE_OPENERS } from './letter-templates';
import { LetterInput } from './letter-types';

export const MAX_SHORT_FIELD = 120;
export const MAX_DETAILS = 2500;

function short(value: string) {
  return value.trim().slice(0, MAX_SHORT_FIELD);
}

function details(value: string) {
  return value.trim().slice(0, MAX_DETAILS);
}

function salutation(recipientName: string) {
  return recipientName ? `Dear ${recipientName},` : 'Dear Sir or Madam,';
}

function signature(senderName: string) {
  return senderName ? `Sincerely,\n${senderName}` : 'Sincerely,';
}

export function generateLetter(input: LetterInput) {
  const sender = short(input.senderName);
  const recipient = short(input.recipientName);
  const organization = short(input.organization);
  const subject = short(input.subject);
  const bodyDetails = details(input.details);
  const date = short(input.date);
  const opener = TONE_OPENERS[input.tone];
  const closing = TONE_CLOSINGS[input.tone];
  const topic = subject || 'this matter';
  const orgPhrase = organization ? ` at ${organization}` : '';

  let body = '';

  if (input.type === 'recommendation') {
    body = `${opener} my recommendation of ${recipient || 'the person named above'}${orgPhrase}. ${bodyDetails || 'Based on my experience with them, I have found them to be dependable, capable and committed to their responsibilities.'}\n\nI believe they would bring a thoughtful and responsible approach to the opportunity under consideration. ${closing}`;
  }

  if (input.type === 'authorization') {
    body = `I, ${sender || 'the undersigned'}, authorize ${recipient || 'the person named above'} to act on my behalf regarding ${topic}${orgPhrase}.\n\n${bodyDetails || 'This authorization is limited to the purpose described above and should not be interpreted as permission for unrelated actions.'}\n\nPlease contact me if further confirmation is required. ${closing}`;
  }

  if (input.type === 'business-inquiry') {
    body = `${opener} ${topic}${orgPhrase}.\n\n${bodyDetails || 'I would appreciate more information about your available options, pricing, terms and any relevant next steps.'}\n\nPlease let me know who the appropriate contact person is or how we can continue the discussion. ${closing}`;
  }

  if (input.type === 'complaint') {
    body = `${opener} ${topic}${orgPhrase}.\n\n${bodyDetails || 'I would like this issue to be reviewed and resolved fairly. Please confirm the next steps and any information you need from me.'}\n\nI would appreciate a clear response and a reasonable resolution. ${closing}`;
  }

  if (input.type === 'resignation') {
    body = `Please accept this letter as formal notice of my resignation${organization ? ` from ${organization}` : ''}. ${bodyDetails || 'I will do my best to support an orderly handover of my current responsibilities during the notice period.'}\n\nI appreciate the opportunities and experience I have gained during my time here. ${closing}`;
  }

  if (input.type === 'thank-you') {
    body = `I am writing to express my appreciation regarding ${topic}${orgPhrase}.\n\n${bodyDetails || 'Your time, support and consideration have been genuinely appreciated.'}\n\nThank you again. I value the help and consideration you have provided.`;
  }

  return [
    date,
    sender,
    organization,
    subject ? `Subject: ${subject}` : '',
    salutation(recipient),
    body,
    signature(sender),
  ].filter(Boolean).join('\n\n');
}

export function safeLetterFileName(subject: string, type: string) {
  const source = subject.trim() || type;
  const base = source.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'letter';
  return `${base}-tayar.txt`;
}
