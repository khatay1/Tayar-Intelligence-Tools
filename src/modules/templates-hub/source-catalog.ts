export type SourceFamily =
  | 'excel'
  | 'office-bundle'
  | 'resume'
  | 'ats-resume'
  | 'cover-letter'
  | 'letterhead'
  | 'planner'
  | 'invoice'
  | 'document'
  | 'biodata'
  | 'assets';

export interface TemplateSourceRoot {
  id: string;
  family: SourceFamily;
  label: string;
  pageUrl: string;
  expectedFormats: string[];
  categoryHint: string;
}

export const BILLIONS_SOURCE_ROOTS: TemplateSourceRoot[] = [
  {
    id: 'excel-1000',
    family: 'excel',
    label: '1000+ Excel Templates',
    pageUrl: 'https://24billions.com/excel-templates-bundle/',
    expectedFormats: ['xlsx', 'xls', 'zip'],
    categoryHint: 'spreadsheets',
  },
  {
    id: 'office-11000',
    family: 'office-bundle',
    label: '11,000+ Excel, Word, PowerPoint & Power BI',
    pageUrl: 'https://24billions.com/excel-ppt-word-power-bi-templates/',
    expectedFormats: ['xlsx', 'xls', 'docx', 'doc', 'pptx', 'ppt', 'pbix', 'zip'],
    categoryHint: 'office-bundle',
  },
  {
    id: 'resume-50',
    family: 'resume',
    label: '50+ Modern CV Templates',
    pageUrl: 'https://24billions.com/modern-cv-template-word-free-download/',
    expectedFormats: ['docx', 'pdf'],
    categoryHint: 'career',
  },
  {
    id: 'resume-fresher',
    family: 'resume',
    label: 'Fresher Resume Formats',
    pageUrl: 'https://24billions.com/templates-fresher-resume-free-download/',
    expectedFormats: ['docx', 'pdf'],
    categoryHint: 'career',
  },
  {
    id: 'letterheads',
    family: 'letterhead',
    label: 'Letterhead Templates',
    pageUrl: 'https://24billions.com/letterhead-templates/',
    expectedFormats: ['docx', 'pdf'],
    categoryHint: 'documents',
  },
  {
    id: 'weekly-planners',
    family: 'planner',
    label: 'Weekly Planner Templates',
    pageUrl: 'https://24billions.com/10-best-free-weekly-planner-templates-to-download-pdf-word/',
    expectedFormats: ['docx', 'pdf', 'jpg', 'jpeg'],
    categoryHint: 'planners',
  },
  {
    id: 'invoice-freelancer',
    family: 'invoice',
    label: 'Freelancer Invoice Templates',
    pageUrl: 'https://24billions.com/invoice-templates-for-freelancers/',
    expectedFormats: ['xlsx', 'docx', 'pdf'],
    categoryHint: 'invoices',
  },
  {
    id: 'letters',
    family: 'document',
    label: 'Letter Templates',
    pageUrl: 'https://24billions.com/letter-templates/',
    expectedFormats: ['docx', 'pdf'],
    categoryHint: 'documents',
  },
  {
    id: 'homepage-index',
    family: 'assets',
    label: '24Billions Library Index',
    pageUrl: 'https://24billions.com/',
    expectedFormats: ['docx', 'xlsx', 'pdf', 'pptx', 'pbix', 'zip', 'png', 'jpg', 'jpeg'],
    categoryHint: 'mixed',
  },
];

export function sourceRootById(id: string) {
  return BILLIONS_SOURCE_ROOTS.find((root) => root.id === id) || null;
}
