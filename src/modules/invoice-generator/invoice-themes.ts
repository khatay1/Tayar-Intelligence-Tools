import { InvoiceThemeId } from './invoice-types';

export interface InvoiceTheme {
  id: InvoiceThemeId;
  label: string;
  description: string;
  preview: {
    shell: string;
    title: string;
    tableHead: string;
    totalBorder: string;
    accent: string;
  };
  printCss: {
    accent: string;
    headingColor: string;
    tableHeadBg: string;
    tableHeadColor: string;
    totalBorder: string;
    topRule: string;
  };
}

export const INVOICE_THEMES: InvoiceTheme[] = [
  {
    id: 'classic',
    label: 'Classic',
    description: 'Balanced and professional.',
    preview: {
      shell: 'bg-white text-gray-900',
      title: 'text-gray-950',
      tableHead: 'bg-gray-100 text-gray-500',
      totalBorder: 'border-gray-900',
      accent: 'text-gray-500',
    },
    printCss: {
      accent: '#666666',
      headingColor: '#151515',
      tableHeadBg: '#f3f3f5',
      tableHeadColor: '#555555',
      totalBorder: '#151515',
      topRule: 'transparent',
    },
  },
  {
    id: 'modern',
    label: 'Modern',
    description: 'Clean with a violet accent.',
    preview: {
      shell: 'bg-white text-gray-900 border-t-4 border-violet-600',
      title: 'text-violet-700',
      tableHead: 'bg-violet-50 text-violet-700',
      totalBorder: 'border-violet-700',
      accent: 'text-violet-600',
    },
    printCss: {
      accent: '#6d28d9',
      headingColor: '#5b21b6',
      tableHeadBg: '#f5f3ff',
      tableHeadColor: '#5b21b6',
      totalBorder: '#5b21b6',
      topRule: '#7c3aed',
    },
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Quiet typography and light rules.',
    preview: {
      shell: 'bg-white text-gray-800',
      title: 'text-gray-800 font-medium',
      tableHead: 'bg-white text-gray-400 border-y border-gray-200',
      totalBorder: 'border-gray-300',
      accent: 'text-gray-400',
    },
    printCss: {
      accent: '#8a8a8a',
      headingColor: '#333333',
      tableHeadBg: '#ffffff',
      tableHeadColor: '#777777',
      totalBorder: '#cfcfcf',
      topRule: 'transparent',
    },
  },
  {
    id: 'bold',
    label: 'Bold',
    description: 'High-contrast business style.',
    preview: {
      shell: 'bg-white text-gray-950 border-t-8 border-gray-950',
      title: 'text-gray-950',
      tableHead: 'bg-gray-950 text-white',
      totalBorder: 'border-gray-950',
      accent: 'text-gray-700',
    },
    printCss: {
      accent: '#333333',
      headingColor: '#111111',
      tableHeadBg: '#111111',
      tableHeadColor: '#ffffff',
      totalBorder: '#111111',
      topRule: '#111111',
    },
  },
];

export function getInvoiceTheme(id: InvoiceThemeId) {
  return INVOICE_THEMES.find((theme) => theme.id === id) || INVOICE_THEMES[0];
}
