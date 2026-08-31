export type LetterType =
  | 'recommendation'
  | 'authorization'
  | 'business-inquiry'
  | 'complaint'
  | 'resignation'
  | 'thank-you';

export type LetterTone = 'professional' | 'warm' | 'concise';

export interface LetterInput {
  type: LetterType;
  tone: LetterTone;
  senderName: string;
  recipientName: string;
  organization: string;
  subject: string;
  details: string;
  date: string;
}
