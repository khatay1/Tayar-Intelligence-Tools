export type MobileTool = {
  id: string;
  name: string;
  description: string;
  category: 'AI' | 'Documents' | 'Images' | 'Business';
  plan: 'Free' | 'Pro' | 'Business';
  icon: string;
  route?:
    | '/tools/email-writer'
    | '/tools/contract-writer'
    | '/tools/analytics-ai'
    | '/tools/translator'
    | '/tools/pdf-tools'
    | '/tools/invoice-generator'
    | '/tools/cv-builder'
    | '/tools/background-remover'
    | '/tools/cover-letter'
    | '/tools/ai-writer'
    | '/tools/document-ai'
    | '/tools/study-assistant'
    | '/tools/csv-cleaner'
    | '/tools/image-to-pdf'
    | '/tools/name-generator'
    | '/tools/letter-generator'
    | '/tools/image-cropper';
  status: 'native' | 'next';
};

export const mobileTools: MobileTool[] = [
  { id: 'email-writer', name: 'AI Email', description: 'Compose, reply and improve emails with Tayar AI.', category: 'AI', plan: 'Free', icon: 'email-outline', route: '/tools/email-writer', status: 'native' },
  { id: 'ai-writer', name: 'AI Writer', description: 'Create articles, marketing copy, social posts and rewrites.', category: 'AI', plan: 'Free', icon: 'pen-plus', route: '/tools/ai-writer', status: 'native' },
  { id: 'cover-letter', name: 'Cover Letter', description: 'Create tailored job application letters from your real experience.', category: 'AI', plan: 'Free', icon: 'email-edit-outline', route: '/tools/cover-letter', status: 'native' },
  { id: 'document-ai', name: 'Document AI', description: 'Summarize, extract, ask questions and rewrite text documents.', category: 'AI', plan: 'Pro', icon: 'file-document-outline', route: '/tools/document-ai', status: 'native' },
  { id: 'study-assistant', name: 'Study Assistant', description: 'Explain, summarize, quiz and create flashcards with AI.', category: 'AI', plan: 'Free', icon: 'school-outline', route: '/tools/study-assistant', status: 'native' },
  { id: 'translator', name: 'Translator', description: 'Translate text with context-aware Tayar AI.', category: 'AI', plan: 'Free', icon: 'translate', route: '/tools/translator', status: 'native' },
  { id: 'analytics-ai', name: 'AI Data Analytics', description: 'Analyze CSV data and surface trends and insights.', category: 'AI', plan: 'Pro', icon: 'chart-box-outline', route: '/tools/analytics-ai', status: 'native' },
  { id: 'background-remover', name: 'Background Remover', description: 'Remove backgrounds with on-device AI. Images never leave your phone.', category: 'Images', plan: 'Free', icon: 'image-filter-center-focus-strong-outline', route: '/tools/background-remover', status: 'native' },
  { id: 'image-cropper', name: 'Image Cropper', description: 'Crop and convert images locally with mobile aspect presets.', category: 'Images', plan: 'Free', icon: 'crop', route: '/tools/image-cropper', status: 'native' },
  { id: 'image-to-pdf', name: 'Image to PDF', description: 'Turn gallery photos into an A4 PDF entirely on-device.', category: 'Images', plan: 'Free', icon: 'image-multiple-outline', route: '/tools/image-to-pdf', status: 'native' },
  { id: 'pdf-tools', name: 'PDF Studio', description: 'Merge and extract PDF pages locally on your phone.', category: 'Documents', plan: 'Free', icon: 'file-pdf-box', route: '/tools/pdf-tools', status: 'native' },
  { id: 'csv-cleaner', name: 'CSV Cleaner', description: 'Trim, normalize and de-duplicate CSV data locally on-device.', category: 'Documents', plan: 'Free', icon: 'file-delimited-outline', route: '/tools/csv-cleaner', status: 'native' },
  { id: 'cv-builder', name: 'CV Builder', description: 'Build and export a polished CV PDF on your phone.', category: 'Documents', plan: 'Free', icon: 'account-box-outline', route: '/tools/cv-builder', status: 'native' },
  { id: 'invoice-generator', name: 'Invoice Generator', description: 'Create and export professional invoices on-device.', category: 'Business', plan: 'Free', icon: 'receipt-text-outline', route: '/tools/invoice-generator', status: 'native' },
  { id: 'name-generator', name: 'Name Generator', description: 'Generate business, product, brand and social-name ideas locally.', category: 'Business', plan: 'Free', icon: 'wand-outline', route: '/tools/name-generator', status: 'native' },
  { id: 'letter-generator', name: 'Letter Generator', description: 'Create editable recommendation, complaint, resignation and business letters locally.', category: 'Business', plan: 'Free', icon: 'file-document-edit-outline', route: '/tools/letter-generator', status: 'native' },
  { id: 'contract-writer', name: 'AI Contract', description: 'Draft and review agreements with AI assistance.', category: 'Business', plan: 'Pro', icon: 'file-sign', route: '/tools/contract-writer', status: 'native' },
];
