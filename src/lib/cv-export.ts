import { CVData, TemplateId, ColorTheme } from './cv-types';
import { COLOR_THEMES } from './cv-types';

function getTheme(themeId: ColorTheme) {
  return COLOR_THEMES.find(t => t.id === themeId) || COLOR_THEMES[0];
}

export function exportToPDF() {
  window.print();
}

export function exportToTXT(data: CVData): void {
  const lines: string[] = [];
  const p = data.personal;
  lines.push(p.fullName || 'Your Name');
  if (p.jobTitle) lines.push(p.jobTitle);
  lines.push('');
  const contacts: string[] = [];
  if (p.email) contacts.push(p.email);
  if (p.phone) contacts.push(p.phone);
  if (p.address) contacts.push(p.address);
  if (p.linkedin) contacts.push(p.linkedin);
  if (p.portfolio) contacts.push(p.portfolio);
  lines.push(contacts.join(' | '));
  lines.push('');
  lines.push('='.repeat(60));
  lines.push('');

  if (data.summary) {
    lines.push('SUMMARY');
    lines.push('-'.repeat(8));
    lines.push(data.summary);
    lines.push('');
  }

  if (data.experience.length > 0) {
    lines.push('EXPERIENCE');
    lines.push('-'.repeat(10));
    data.experience.forEach(exp => {
      lines.push(`${exp.jobTitle} | ${exp.company}`);
      lines.push(`${exp.startDate} - ${exp.current ? 'Present' : exp.endDate}`);
      if (exp.location) lines.push(`Location: ${exp.location}`);
      if (exp.description) lines.push(exp.description);
      lines.push('');
    });
  }

  if (data.education.length > 0) {
    lines.push('EDUCATION');
    lines.push('-'.repeat(9));
    data.education.forEach(edu => {
      lines.push(`${edu.degree} | ${edu.institution}`);
      lines.push(`${edu.startDate} - ${edu.endDate}`);
      if (edu.description) lines.push(edu.description);
      lines.push('');
    });
  }

  if (data.skills.length > 0) {
    lines.push('SKILLS');
    lines.push('-'.repeat(6));
    lines.push(data.skills.map(s => `${s.name}${s.level ? ` (${s.level})` : ''}`).join(', '));
    lines.push('');
  }

  if (data.languages.length > 0) {
    lines.push('LANGUAGES');
    lines.push('-'.repeat(9));
    lines.push(data.languages.map(l => `${l.name} (${l.proficiency})`).join(', '));
    lines.push('');
  }

  if (data.certificates.length > 0) {
    lines.push('CERTIFICATES');
    lines.push('-'.repeat(12));
    data.certificates.forEach(c => {
      lines.push(`${c.name} - ${c.issuer}${c.date ? ` (${c.date})` : ''}`);
    });
    lines.push('');
  }

  if (data.projects.length > 0) {
    lines.push('PROJECTS');
    lines.push('-'.repeat(8));
    data.projects.forEach(p => {
      lines.push(`${p.name}${p.link ? ` (${p.link})` : ''}`);
      if (p.description) lines.push(p.description);
      lines.push('');
    });
  }

  if (data.awards.length > 0) {
    lines.push('AWARDS');
    lines.push('-'.repeat(6));
    data.awards.forEach(a => {
      lines.push(`${a.title} - ${a.issuer}${a.date ? ` (${a.date})` : ''}`);
      if (a.description) lines.push(a.description);
    });
    lines.push('');
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  downloadBlob(blob, `${(data.personal.fullName || 'resume').replace(/\s+/g, '_')}.txt`);
}

export function exportToDOCX(data: CVData, template: TemplateId, colorTheme: ColorTheme): void {
  const theme = getTheme(colorTheme);

  const sections: string[] = [];

  // Header
  sections.push(`
    <div style="text-align:center; margin-bottom:20px; padding-bottom:10px; border-bottom:2px solid ${theme.primary};">
      <h1 style="font-size:24px; font-weight:bold; margin:0; color:${theme.primaryDark};">${escapeXml(data.personal.fullName || 'Your Name')}</h1>
      <p style="font-size:14px; color:#666; margin:4px 0;">${escapeXml(data.personal.jobTitle || '')}</p>
      <p style="font-size:11px; color:#999; margin:4px 0;">
        ${[data.personal.email, data.personal.phone, data.personal.address, data.personal.linkedin, data.personal.portfolio].filter(Boolean).map(escapeXml).join(' | ')}
      </p>
    </div>
  `);

  if (data.summary) {
    sections.push(`
      <div style="margin-bottom:16px;">
        <h2 style="font-size:13px; font-weight:bold; text-transform:uppercase; color:${theme.primary}; border-bottom:1px solid ${theme.primaryLight}; padding-bottom:3px; margin-bottom:6px;">Summary</h2>
        <p style="font-size:11px; line-height:1.5; color:#444;">${escapeXml(data.summary)}</p>
      </div>
    `);
  }

  if (data.experience.length > 0) {
    sections.push(`
      <div style="margin-bottom:16px;">
        <h2 style="font-size:13px; font-weight:bold; text-transform:uppercase; color:${theme.primary}; border-bottom:1px solid ${theme.primaryLight}; padding-bottom:3px; margin-bottom:6px;">Experience</h2>
        ${data.experience.map(exp => `
          <div style="margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between;">
              <span style="font-size:12px; font-weight:bold; color:${theme.primaryDark};">${escapeXml(exp.jobTitle)}</span>
              <span style="font-size:10px; color:#999;">${escapeXml(exp.startDate)} - ${exp.current ? 'Present' : escapeXml(exp.endDate)}</span>
            </div>
            <div style="font-size:11px; color:#666; font-style:italic; margin-bottom:3px;">${escapeXml(exp.company)}${exp.location ? ` · ${escapeXml(exp.location)}` : ''}</div>
            <p style="font-size:11px; line-height:1.5; color:#444; margin:0; white-space:pre-line;">${escapeXml(exp.description)}</p>
          </div>
        `).join('')}
      </div>
    `);
  }

  if (data.education.length > 0) {
    sections.push(`
      <div style="margin-bottom:16px;">
        <h2 style="font-size:13px; font-weight:bold; text-transform:uppercase; color:${theme.primary}; border-bottom:1px solid ${theme.primaryLight}; padding-bottom:3px; margin-bottom:6px;">Education</h2>
        ${data.education.map(edu => `
          <div style="margin-bottom:6px;">
            <div style="display:flex; justify-content:space-between;">
              <span style="font-size:12px; font-weight:bold;">${escapeXml(edu.degree)}</span>
              <span style="font-size:10px; color:#999;">${escapeXml(edu.startDate)} - ${escapeXml(edu.endDate)}</span>
            </div>
            <div style="font-size:11px; color:#666;">${escapeXml(edu.institution)}${edu.location ? ` · ${escapeXml(edu.location)}` : ''}</div>
            ${edu.description ? `<div style="font-size:11px; color:#444;">${escapeXml(edu.description)}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `);
  }

  if (data.skills.length > 0) {
    sections.push(`
      <div style="margin-bottom:16px;">
        <h2 style="font-size:13px; font-weight:bold; text-transform:uppercase; color:${theme.primary}; border-bottom:1px solid ${theme.primaryLight}; padding-bottom:3px; margin-bottom:6px;">Skills</h2>
        <p style="font-size:11px; color:#444;">${data.skills.map(s => escapeXml(s.name)).join(' · ')}</p>
      </div>
    `);
  }

  if (data.languages.length > 0) {
    sections.push(`
      <div style="margin-bottom:16px;">
        <h2 style="font-size:13px; font-weight:bold; text-transform:uppercase; color:${theme.primary}; border-bottom:1px solid ${theme.primaryLight}; padding-bottom:3px; margin-bottom:6px;">Languages</h2>
        <p style="font-size:11px; color:#444;">${data.languages.map(l => `${escapeXml(l.name)} (${escapeXml(l.proficiency)})`).join(' · ')}</p>
      </div>
    `);
  }

  if (data.certificates.length > 0) {
    sections.push(`
      <div style="margin-bottom:16px;">
        <h2 style="font-size:13px; font-weight:bold; text-transform:uppercase; color:${theme.primary}; border-bottom:1px solid ${theme.primaryLight}; padding-bottom:3px; margin-bottom:6px;">Certifications</h2>
        ${data.certificates.map(c => `<div style="font-size:11px; color:#444; margin-bottom:3px;"><b>${escapeXml(c.name)}</b> - ${escapeXml(c.issuer)}${c.date ? ` (${escapeXml(c.date)})` : ''}</div>`).join('')}
      </div>
    `);
  }

  if (data.projects.length > 0) {
    sections.push(`
      <div style="margin-bottom:16px;">
        <h2 style="font-size:13px; font-weight:bold; text-transform:uppercase; color:${theme.primary}; border-bottom:1px solid ${theme.primaryLight}; padding-bottom:3px; margin-bottom:6px;">Projects</h2>
        ${data.projects.map(p => `<div style="margin-bottom:6px;"><b style="font-size:12px;">${escapeXml(p.name)}</b><p style="font-size:11px; color:#444; margin:2px 0;">${escapeXml(p.description)}</p>${p.link ? `<span style="font-size:10px; color:${theme.primary};">${escapeXml(p.link)}</span>` : ''}</div>`).join('')}
      </div>
    `);
  }

  if (data.awards.length > 0) {
    sections.push(`
      <div style="margin-bottom:16px;">
        <h2 style="font-size:13px; font-weight:bold; text-transform:uppercase; color:${theme.primary}; border-bottom:1px solid ${theme.primaryLight}; padding-bottom:3px; margin-bottom:6px;">Awards</h2>
        ${data.awards.map(a => `<div style="font-size:11px; color:#444; margin-bottom:3px;"><b>${escapeXml(a.title)}</b> - ${escapeXml(a.issuer)}${a.date ? ` (${escapeXml(a.date)})` : ''}${a.description ? `<br/>${escapeXml(a.description)}` : ''}</div>`).join('')}
      </div>
    `);
  }

  const html = `
    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <?mso-application progid="Word.Document"?>
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8"/>
      <style>
        body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 11pt; margin: 1in; color: #333; }
        @page { size: A4; margin: 0.5in; }
      </style>
    </head>
    <body>
      ${sections.join('')}
    </body>
    </html>
  `;

  const blob = new Blob([html], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  downloadBlob(blob, `${(data.personal.fullName || 'resume').replace(/\s+/g, '_')}.doc`);
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
