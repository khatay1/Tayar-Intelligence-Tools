export type MobileTool = {
  id: string;
  name: string;
  description: string;
  category: 'AI' | 'Documents' | 'Images' | 'Business';
  plan: 'Free' | 'Pro' | 'Business';
  icon: string;
  route?: '/tools/email-writer' | '/tools/contract-writer' | '/tools/analytics-ai' | '/tools/translator' | '/tools/pdf-tools';
  status: 'native' | 'next';
};

export const mobileTools: MobileTool[] = [
  { id: 'email-writer', name: 'AI Email', description: 'Compose, reply and improve emails with Tayar AI.', category: 'AI', plan: 'Free', icon: 'email-outline', route: '/tools/email-writer', status: 'native' },
  { id: 'background-remover', name: 'Background Remover', description: 'Remove image backgrounds locally on your device.', category: 'Images', plan: 'Free', icon: 'image-filter-center-focus-strong-outline', status: 'next' },
  { id: 'pdf-tools', name: 'PDF Studio', description: 'Merge and extract PDF pages locally on your phone.', category: 'Documents', plan: 'Free', icon: 'file-pdf-box', route: '/tools/pdf-tools', status: 'native' },
  { id: 'contract-writer', name: 'AI Contract', description: 'Draft and review agreements with AI assistance.', category: 'Business', plan: 'Pro', icon: 'file-sign', route: '/tools/contract-writer', status: 'native' },
  { id: 'analytics-ai', name: 'AI Data Analytics', description: 'Analyze CSV data and surface trends and insights.', category: 'AI', plan: 'Pro', icon: 'chart-box-outline', route: '/tools/analytics-ai', status: 'native' },
  { id: 'cv-builder', name: 'CV Builder', description: 'Build polished CVs from your phone.', category: 'Documents', plan: 'Free', icon: 'account-box-outline', status: 'next' },
  { id: 'translator', name: 'Translator', description: 'Translate text with context-aware Tayar AI.', category: 'AI', plan: 'Free', icon: 'translate', route: '/tools/translator', status: 'native' },
  { id: 'invoice-generator', name: 'Invoice Generator', description: 'Create and export professional invoices.', category: 'Business', plan: 'Free', icon: 'receipt-text-outline', status: 'next' },
];
