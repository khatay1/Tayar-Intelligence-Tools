import { useCallback, useState } from 'react';
import { CVData, ColorTheme, TemplateId } from '@/lib/cv-types';
import { buildATSTextExport, sanitizeCVFilename } from './cv-export';

interface UseCVExportOptions {
  cv: CVData;
  template: TemplateId;
  colorTheme: ColorTheme;
  language: string;
  exportPDF: () => Promise<void>;
  exportDOCX: (cv: CVData, template: TemplateId, theme: ColorTheme, language: string) => void;
  exportTXT?: (cv: CVData, language: string) => void;
}

export function useCVExport(options: UseCVExportOptions) {
  const [exporting, setExporting] = useState(false);

  const exportFormat = useCallback(async (format: 'pdf' | 'docx' | 'txt') => {
    setExporting(true);
    try {
      if (format === 'pdf') await options.exportPDF();
      else if (format === 'docx') options.exportDOCX(options.cv, options.template, options.colorTheme, options.language);
      else if (options.exportTXT) options.exportTXT(options.cv, options.language);
      else {
        const text = buildATSTextExport(options.cv);
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${sanitizeCVFilename(options.cv.personal.fullName)}.txt`;
        anchor.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setExporting(false);
    }
  }, [options]);

  return { exporting, exportFormat };
}
