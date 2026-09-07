export type MobileTool = {
  id: string;
  name: string;
  description: string;
  category: 'AI' | 'Documents' | 'Images' | 'Business';
  plan: 'Free' | 'Pro' | 'Business';
  icon: string;
  route?: '/tools/email-writer';
  status: 'native' | 'next';
};

export const mobileTools: MobileTool[] = [
  { id: 'email-writer', name: 'AI Email', description: 'Compose, reply and improve emails with Tayar AI.', category: 'AI', plan: 'Free', icon: 'email-outline', route: '/tools/email-writer', status: 'native' },
  { id: 'background-remover', name: 'Background Remover', description: 'Remove image backgrounds locally on your device.', category: 'Images', plan: 'Free', icon: 'image-filter-center-focus-strong-outline', status: 'next' },
  { id: 'pdf-tools', name: 'PDF Studio', description: 'Merge, split, compress, convert and organize PDF files.', category: 'Documents', plan: 'Free', icon: 'file-pdf-box', status: 'next' },
  { id: 'contract-writer', name: 'AI Contract', description: 'Draft and review agreements with AI assistance.', category: 'Business', plan: 'Pro', icon: 'file-sign', status: 'next' },
  { id: 'analytics-ai', name: 'AI Data Analytics', description: 'Analyze CSV data and surface trends and insights.', category: 'AI', plan: 'Pro', icon: 'chart-box-outline', status: 'next' },
  { id: 'cv-builder', name: 'CV Builder', description: 'Build polished CVs from your phone.', category: 'Documents', plan: 'Free', icon: 'account-box-outline', status: 'next' },
  { id: 'translator', name: 'Translator', description: 'Translate between English, Arabic and Swedish.', category: 'AI', plan: 'Free', icon: 'translate', status: 'next' },
  { id: 'invoice-generator', name: 'Invoice Generator', description: 'Create and export professional invoices.', category: 'Business', plan: 'Free', icon: 'receipt-text-outline', status: 'next' },
];
