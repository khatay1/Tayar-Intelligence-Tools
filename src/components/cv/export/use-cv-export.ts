import { useCallback, useRef, useState } from 'react';
import { CVData, ColorTheme, TemplateId } from '@/lib/cv-types';
import { buildATSTextExport, sanitizeCVFilename } from './cv-export';

interface UseCVExportOptions {
  cv: CVData;
  template: TemplateId;
  colorTheme: ColorTheme;
  language: string;
  exportPDF: () => Promise<void>;
  exportDOCX: (cv: CVData, template: TemplateId, theme: ColorTheme, language: string) => void | Promise<void>;
  exportTXT?: (cv: CVData, language: string) => void | Promise<void>;
}

export function useCVExport(options: UseCVExportOptions) {
  const [exporting, setExporting] = useState(false);
  const inFlightRef = useRef(false);
  const { cv, template, colorTheme, language, exportPDF, exportDOCX, exportTXT } = options;

  const exportFormat = useCallback(async (format: 'pdf' | 'docx' | 'txt') => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setExporting(true);
    try {
      if (format === 'pdf') await exportPDF();
      else if (format === 'docx') await exportDOCX(cv, template, colorTheme, language);
      else if (exportTXT) await exportTXT(cv, language);
      else {
        const text = buildATSTextExport(cv);
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        try {
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = `${sanitizeCVFilename(cv.personal.fullName)}.txt`;
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
        } finally {
          URL.revokeObjectURL(url);
        }
      }
    } finally {
      inFlightRef.current = false;
      setExporting(false);
    }
  }, [cv, template, colorTheme, language, exportPDF, exportDOCX, exportTXT]);

  return { exporting, exportFormat };
}
