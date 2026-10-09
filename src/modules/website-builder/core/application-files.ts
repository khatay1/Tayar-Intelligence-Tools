/** Download-only attachments: no executable HTML/SVG or user-selected paths. */
export const APPLICATION_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'] as const;
export const APPLICATION_FILE_MAX_BYTES = 25 * 1024 * 1024;
export const applicationFileId = (value: string) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)) throw new Error('Invalid attachment identity.');
  return value;
};

export function applicationFileExtension(type: unknown): string {
  const extensions: Record<string, string> = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png',
    'image/webp': '.webp', 'text/plain': '.txt', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx' };
  return typeof type === 'string' ? extensions[type] ?? '' : '';
}
