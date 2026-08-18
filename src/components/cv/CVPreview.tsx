import { CVData, TemplateId, ColorTheme, SectionConfig, FONT_OPTIONS } from '@/lib/cv-types';
import { COLOR_THEMES } from '@/lib/cv-types';
import { Mail, Phone, MapPin, Linkedin, Globe, Award } from 'lucide-react';

interface CVPreviewProps {
  data: CVData;
  template: TemplateId;
  colorTheme?: ColorTheme;
  sections?: SectionConfig[];
  fontId?: string;
}

export default function CVPreview({ data, template, colorTheme = 'violet', sections = [], fontId = 'inter' }: CVPreviewProps) {
  const theme = COLOR_THEMES.find(t => t.id === colorTheme) || COLOR_THEMES[0];
  const font = FONT_OPTIONS.find(f => f.id === fontId) || FONT_OPTIONS[0];
  const fontFamily = font.family;

  const orderedSections = sections.length > 0
    ? sections.filter(s => s.visible)
    : [
        { id: 'summary' as const, label: 'Summary', visible: true },
        { id: 'experience' as const, label: 'Experience', visible: true },
        { id: 'education' as const, label: 'Education', visible: true },
        { id: 'skills' as const, label: 'Skills', visible: true },
        { id: 'languages' as const, label: 'Languages', visible: true },
        { id: 'projects' as const, label: 'Projects', visible: true },
        { id: 'certificates' as const, label: 'Certifications', visible: true },
        { id: 'awards' as const, label: 'Awards', visible: true },
      ];

  const sectionMap: Record<string, React.ReactNode> = {
    summary: data.summary ? <p className="text-xs leading-relaxed text-gray-600">{data.summary}</p> : null,
    experience: data.experience.length > 0 ? (
      <div className="space-y-3">
        {data.experience.map(exp => (
          <div key={exp.id}>
            <div className="flex justify-between items-baseline">
              <h4 className="text-sm font-bold">{exp.jobTitle}</h4>
              <span className="text-[10px] text-gray-500">{exp.startDate} — {exp.current ? 'Present' : exp.endDate}</span>
            </div>
            <div className="text-xs mb-1" style={{ color: theme.primary }}>{exp.company}{exp.location && ` · ${exp.location}`}</div>
            <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">{exp.description}</p>
          </div>
        ))}
      </div>
    ) : null,
    education: data.education.length > 0 ? (
      <div className="space-y-2">
        {data.education.map(edu => (
          <div key={edu.id}>
            <div className="flex justify-between items-baseline">
              <h4 className="text-sm font-bold">{edu.degree}</h4>
              <span className="text-[10px] text-gray-500">{edu.startDate} — {edu.endDate}</span>
            </div>
            <div className="text-xs" style={{ color: theme.primary }}>{edu.institution}{edu.location && ` · ${edu.location}`}</div>
            {edu.description && <p className="text-xs text-gray-600 mt-0.5">{edu.description}</p>}
          </div>
        ))}
      </div>
    ) : null,
    skills: data.skills.length > 0 ? (
      <div className="flex flex-wrap gap-1.5">
        {data.skills.map(s => (
          <span key={s.id} className="text-xs text-gray-700 border border-gray-200 rounded px-2 py-0.5">{s.name}</span>
        ))}
      </div>
    ) : null,
    languages: data.languages.length > 0 ? (
      <div className="space-y-0.5 text-xs text-gray-600">
        {data.languages.map(l => <div key={l.id}>{l.name} — {l.proficiency}</div>)}
      </div>
    ) : null,
    projects: data.projects.length > 0 ? (
      <div className="space-y-2">
        {data.projects.map(p => (
          <div key={p.id}>
            <h4 className="text-sm font-bold">{p.name}</h4>
            <p className="text-xs text-gray-600">{p.description}</p>
            {p.link && <a className="text-xs" style={{ color: theme.primary }}>{p.link}</a>}
          </div>
        ))}
      </div>
    ) : null,
    certificates: data.certificates.length > 0 ? (
      <div className="space-y-1 text-xs text-gray-600">
        {data.certificates.map(c => <div key={c.id}>{c.name} — {c.issuer}{c.date && ` · ${c.date}`}</div>)}
      </div>
    ) : null,
    awards: data.awards.length > 0 ? (
      <div className="space-y-2">
        {data.awards.map(a => (
          <div key={a.id}>
            <div className="flex items-center gap-1.5">
              <Award className="w-3 h-3" style={{ color: theme.primary }} />
              <h4 className="text-sm font-bold">{a.title}</h4>
            </div>
            <div className="text-xs text-gray-500">{a.issuer}{a.date && ` · ${a.date}`}</div>
            {a.description && <p className="text-xs text-gray-600 mt-0.5">{a.description}</p>}
          </div>
        ))}
      </div>
    ) : null,
  };

  function renderSection(secId: string, label: string, titleClass: string) {
    const content = sectionMap[secId];
    if (!content) return null;
    return (
      <div key={secId} className="mb-5">
        <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 ${titleClass}`}>{label}</h3>
        {content}
      </div>
    );
  }

  switch (template) {
    case 'modern':
      return <ModernTemplate data={data} theme={theme} fontFamily={fontFamily} orderedSections={orderedSections} sectionMap={sectionMap} renderSection={renderSection} />;
    case 'minimal':
      return <MinimalTemplate data={data} theme={theme} fontFamily={fontFamily} orderedSections={orderedSections} sectionMap={sectionMap} renderSection={renderSection} />;
    case 'executive':
      return <ExecutiveTemplate data={data} theme={theme} fontFamily={fontFamily} orderedSections={orderedSections} sectionMap={sectionMap} renderSection={renderSection} />;
    case 'creative':
      return <CreativeTemplate data={data} theme={theme} fontFamily={fontFamily} orderedSections={orderedSections} sectionMap={sectionMap} renderSection={renderSection} />;
    case 'professional':
      return <ProfessionalTemplate data={data} theme={theme} fontFamily={fontFamily} orderedSections={orderedSections} sectionMap={sectionMap} renderSection={renderSection} />;
    case 'ats':
      return <ATSTemplate data={data} theme={theme} fontFamily={fontFamily} orderedSections={orderedSections} sectionMap={sectionMap} renderSection={renderSection} />;
    case 'corporate':
      return <CorporateTemplate data={data} theme={theme} fontFamily={fontFamily} orderedSections={orderedSections} sectionMap={sectionMap} renderSection={renderSection} />;
    case 'tech':
      return <TechTemplate data={data} theme={theme} fontFamily={fontFamily} orderedSections={orderedSections} sectionMap={sectionMap} renderSection={renderSection} />;
    case 'finance':
      return <FinanceTemplate data={data} theme={theme} fontFamily={fontFamily} orderedSections={orderedSections} sectionMap={sectionMap} renderSection={renderSection} />;
    case 'healthcare':
      return <HealthcareTemplate data={data} theme={theme} fontFamily={fontFamily} orderedSections={orderedSections} sectionMap={sectionMap} renderSection={renderSection} />;
    case 'academic':
      return <AcademicTemplate data={data} theme={theme} fontFamily={fontFamily} orderedSections={orderedSections} sectionMap={sectionMap} renderSection={renderSection} />;
    default:
      return <ModernTemplate data={data} theme={theme} fontFamily={fontFamily} orderedSections={orderedSections} sectionMap={sectionMap} renderSection={renderSection} />;
  }
}

interface TemplateProps {
  data: CVData;
  theme: typeof COLOR_THEMES[0];
  fontFamily: string;
  orderedSections: { id: string; label: string; visible: boolean }[];
  sectionMap: Record<string, React.ReactNode>;
  renderSection: (secId: string, label: string, titleClass: string) => React.ReactNode;
}

function ContactRow({ data, className = '', theme }: { data: CVData; className?: string; theme: typeof COLOR_THEMES[0] }) {
  return (
    <div className={`flex flex-wrap gap-x-4 gap-y-1 text-xs ${className}`}>
      {data.personal.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {data.personal.email}</span>}
      {data.personal.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {data.personal.phone}</span>}
      {data.personal.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {data.personal.address}</span>}
      {data.personal.linkedin && <span className="flex items-center gap-1"><Linkedin className="w-3 h-3" /> {data.personal.linkedin}</span>}
      {data.personal.portfolio && <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> {data.personal.portfolio}</span>}
    </div>
  );
}

/* ===== MODERN ===== */
function ModernTemplate({ data, theme, fontFamily, orderedSections, sectionMap, renderSection }: TemplateProps) {
  const sidebarSections = orderedSections.filter(s => ['skills', 'languages', 'certificates', 'awards'].includes(s.id));
  const mainSections = orderedSections.filter(s => !['skills', 'languages', 'certificates', 'awards'].includes(s.id));

  return (
    <div className="bg-white text-gray-800 min-h-full flex" style={{ fontFamily }}>
      <div className="w-1/3 p-5" style={{ background: theme.primaryDark, color: 'white' }}>
        <div className="mb-6">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mb-3" style={{ background: theme.primary }}>
            {data.personal.fullName.charAt(0) || '?'}
          </div>
          <h2 className="text-lg font-bold leading-tight">{data.personal.fullName || 'Your Name'}</h2>
          <p className="text-xs mt-0.5" style={{ color: theme.primaryLight }}>{data.personal.jobTitle || 'Job Title'}</p>
        </div>
        <div className="space-y-1.5 text-xs mb-6">
          {data.personal.email && <div className="flex items-center gap-1.5"><Mail className="w-3 h-3 flex-shrink-0" /> {data.personal.email}</div>}
          {data.personal.phone && <div className="flex items-center gap-1.5"><Phone className="w-3 h-3 flex-shrink-0" /> {data.personal.phone}</div>}
          {data.personal.address && <div className="flex items-center gap-1.5"><MapPin className="w-3 h-3 flex-shrink-0" /> {data.personal.address}</div>}
          {data.personal.linkedin && <div className="flex items-center gap-1.5"><Linkedin className="w-3 h-3 flex-shrink-0" /> {data.personal.linkedin}</div>}
          {data.personal.portfolio && <div className="flex items-center gap-1.5"><Globe className="w-3 h-3 flex-shrink-0" /> {data.personal.portfolio}</div>}
        </div>
        {sidebarSections.map(s => {
          const content = sectionMap[s.id];
          if (!content) return null;
          return (
            <div key={s.id} className="mb-5">
              <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: theme.primaryLight }}>{s.label}</h3>
              {content}
            </div>
          );
        })}
      </div>
      <div className="w-2/3 p-6">
        {mainSections.map(s => renderSection(s.id, s.label, '') )}
      </div>
    </div>
  );
}

/* ===== MINIMAL ===== */
function MinimalTemplate({ data, theme, fontFamily, orderedSections, sectionMap, renderSection }: TemplateProps) {
  return (
    <div className="bg-white text-gray-800 min-h-full p-8" style={{ fontFamily }}>
      <div className="text-center mb-6 pb-4 border-b border-gray-200">
        <h1 className="text-2xl font-light tracking-tight">{data.personal.fullName || 'Your Name'}</h1>
        <p className="text-sm text-gray-500 mt-1">{data.personal.jobTitle || 'Job Title'}</p>
        <ContactRow data={data} className="justify-center mt-2 text-gray-500" theme={theme} />
      </div>
      {orderedSections.map(s => renderSection(s.id, s.label, 'text-gray-400 text-center'))}
    </div>
  );
}

/* ===== EXECUTIVE ===== */
function ExecutiveTemplate({ data, theme, fontFamily, orderedSections, sectionMap, renderSection }: TemplateProps) {
  return (
    <div className="bg-white text-gray-800 min-h-full" style={{ fontFamily }}>
      <div className="text-white p-6 text-center" style={{ background: theme.primaryDark }}>
        <h1 className="text-2xl font-bold tracking-wide">{data.personal.fullName || 'Your Name'}</h1>
        <p className="text-sm mt-1" style={{ color: theme.primaryLight }}>{data.personal.jobTitle || 'Job Title'}</p>
        <ContactRow data={data} className="justify-center mt-3" theme={theme} />
      </div>
      <div className="p-6">
        {orderedSections.map(s => renderSection(s.id, s.label, 'text-gray-900'))}
      </div>
    </div>
  );
}

/* ===== CREATIVE ===== */
function CreativeTemplate({ data, theme, fontFamily, orderedSections, sectionMap, renderSection }: TemplateProps) {
  return (
    <div className="bg-white text-gray-800 min-h-full" style={{ fontFamily }}>
      <div className="text-white p-6 rounded-b-3xl" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` }}>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-2xl font-bold flex-shrink-0">
            {data.personal.fullName.charAt(0) || '?'}
          </div>
          <div>
            <h1 className="text-2xl font-extrabold">{data.personal.fullName || 'Your Name'}</h1>
            <p className="text-sm" style={{ color: theme.primaryLight }}>{data.personal.jobTitle || 'Job Title'}</p>
          </div>
        </div>
        <ContactRow data={data} className="mt-4" theme={theme} />
      </div>
      <div className="p-6">
        {orderedSections.map(s => renderSection(s.id, s.label, '') )}
      </div>
    </div>
  );
}

/* ===== PROFESSIONAL ===== */
function ProfessionalTemplate({ data, theme, fontFamily, orderedSections, sectionMap, renderSection }: TemplateProps) {
  return (
    <div className="bg-white text-gray-800 min-h-full p-8" style={{ fontFamily }}>
      <div className="mb-5 pb-4 border-b-2" style={{ borderColor: theme.primary }}>
        <h1 className="text-2xl font-bold">{data.personal.fullName || 'Your Name'}</h1>
        <p className="text-sm text-gray-600 mt-0.5">{data.personal.jobTitle || 'Job Title'}</p>
        <ContactRow data={data} className="mt-2 text-gray-600" theme={theme} />
      </div>
      {orderedSections.map(s => renderSection(s.id, s.label, 'text-gray-800'))}
    </div>
  );
}

/* ===== ATS ===== */
function ATSTemplate({ data, theme, fontFamily, orderedSections, sectionMap, renderSection }: TemplateProps) {
  return (
    <div className="bg-white text-black min-h-full p-8" style={{ fontFamily }}>
      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold">{data.personal.fullName || 'Your Name'}</h1>
        {data.personal.jobTitle && <p className="text-sm">{data.personal.jobTitle}</p>}
        <div className="text-xs mt-1">
          {data.personal.email && <span>{data.personal.email}</span>}
          {data.personal.phone && <span> | {data.personal.phone}</span>}
          {data.personal.address && <span> | {data.personal.address}</span>}
          {data.personal.linkedin && <span> | {data.personal.linkedin}</span>}
          {data.personal.portfolio && <span> | {data.personal.portfolio}</span>}
        </div>
      </div>
      {orderedSections.map(s => {
        const content = sectionMap[s.id];
        if (!content) return null;
        const upperLabel = s.label.toUpperCase();
        return (
          <div key={s.id} className="mb-4">
            <h3 className="text-sm font-bold border-b border-black mb-1">{upperLabel}</h3>
            {content}
          </div>
        );
      })}
    </div>
  );
}

/* ===== TECH ===== */
function TechTemplate({ data, theme, fontFamily, orderedSections, sectionMap, renderSection }: TemplateProps) {
  const sidebarSections = orderedSections.filter(s => ['skills', 'languages', 'certificates', 'awards'].includes(s.id));
  const mainSections = orderedSections.filter(s => !['skills', 'languages', 'certificates', 'awards'].includes(s.id));
  return (
    <div className="bg-white text-gray-800 min-h-full" style={{ fontFamily }}>
      <div className="p-5 border-b-2" style={{ borderColor: theme.primary, background: `${theme.primary}08` }}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-lg flex items-center justify-center text-xl font-bold flex-shrink-0" style={{ background: theme.primary, color: 'white' }}>
            {data.personal.fullName.charAt(0) || '?'}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold" style={{ color: theme.primaryDark }}>{data.personal.fullName || 'Your Name'}</h1>
            <p className="text-sm text-gray-600">{data.personal.jobTitle || 'Job Title'}</p>
          </div>
          <div className="text-right text-xs text-gray-500 space-y-0.5">
            {data.personal.email && <div>{data.personal.email}</div>}
            {data.personal.phone && <div>{data.personal.phone}</div>}
            {data.personal.linkedin && <div>{data.personal.linkedin}</div>}
            {data.personal.portfolio && <div>{data.personal.portfolio}</div>}
          </div>
        </div>
      </div>
      <div className="flex">
        <div className="w-1/4 p-4 bg-gray-50" style={{ borderRight: '1px solid #e5e7eb' }}>
          {sidebarSections.map(s => {
            const content = sectionMap[s.id];
            if (!content) return null;
            return (
              <div key={s.id} className="mb-5">
                <h3 className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: theme.primary }}>{s.label}</h3>
                {content}
              </div>
            );
          })}
        </div>
        <div className="w-3/4 p-5">
          {mainSections.map(s => renderSection(s.id, s.label, ''))}
        </div>
      </div>
    </div>
  );
}

/* ===== FINANCE ===== */
function FinanceTemplate({ data, theme, fontFamily, orderedSections, sectionMap, renderSection }: TemplateProps) {
  return (
    <div className="bg-white text-gray-800 min-h-full p-8" style={{ fontFamily }}>
      <div className="mb-5 pb-3 border-b-2 border-double" style={{ borderColor: theme.primaryDark }}>
        <h1 className="text-2xl font-bold tracking-wide" style={{ color: theme.primaryDark }}>{data.personal.fullName || 'Your Name'}</h1>
        <p className="text-sm text-gray-600 mt-0.5">{data.personal.jobTitle || 'Job Title'}</p>
        <ContactRow data={data} className="mt-2 text-gray-600" theme={theme} />
      </div>
      {orderedSections.map(s => {
        const content = sectionMap[s.id];
        if (!content) return null;
        return (
          <div key={s.id} className="mb-5">
            <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: theme.primaryDark, borderBottom: `1px solid ${theme.primaryLight}`, paddingBottom: '2px' }}>{s.label}</h3>
            {content}
          </div>
        );
      })}
    </div>
  );
}

/* ===== HEALTHCARE ===== */
function HealthcareTemplate({ data, theme, fontFamily, orderedSections, sectionMap, renderSection }: TemplateProps) {
  const sidebarSections = orderedSections.filter(s => ['skills', 'languages', 'certificates', 'awards'].includes(s.id));
  const mainSections = orderedSections.filter(s => !['skills', 'languages', 'certificates', 'awards'].includes(s.id));
  return (
    <div className="bg-white text-gray-800 min-h-full" style={{ fontFamily }}>
      <div className="p-5 text-center" style={{ background: theme.primaryDark, color: 'white' }}>
        <h1 className="text-xl font-bold">{data.personal.fullName || 'Your Name'}</h1>
        <p className="text-sm mt-0.5" style={{ color: theme.primaryLight }}>{data.personal.jobTitle || 'Job Title'}</p>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs mt-2">
          {data.personal.email && <span>{data.personal.email}</span>}
          {data.personal.phone && <span>{data.personal.phone}</span>}
          {data.personal.address && <span>{data.personal.address}</span>}
          {data.personal.linkedin && <span>{data.personal.linkedin}</span>}
        </div>
      </div>
      <div className="flex">
        <div className="w-2/3 p-5">
          {mainSections.map(s => renderSection(s.id, s.label, 'text-gray-800'))}
        </div>
        <div className="w-1/3 p-5 bg-gray-50" style={{ borderLeft: '1px solid #e5e7eb' }}>
          {sidebarSections.map(s => {
            const content = sectionMap[s.id];
            if (!content) return null;
            return (
              <div key={s.id} className="mb-5">
                <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: theme.primary }}>{s.label}</h3>
                {content}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ===== ACADEMIC ===== */
function AcademicTemplate({ data, theme, fontFamily, orderedSections, sectionMap, renderSection }: TemplateProps) {
  return (
    <div className="bg-white text-gray-800 min-h-full p-8" style={{ fontFamily }}>
      <div className="text-center mb-5 pb-3 border-b border-gray-300">
        <h1 className="text-2xl font-bold">{data.personal.fullName || 'Your Name'}</h1>
        <p className="text-sm text-gray-600 mt-0.5">{data.personal.jobTitle || 'Job Title'}</p>
        <ContactRow data={data} className="justify-center mt-2 text-gray-600" theme={theme} />
      </div>
      {orderedSections.map(s => {
        const content = sectionMap[s.id];
        if (!content) return null;
        return (
          <div key={s.id} className="mb-5">
            <h3 className="text-sm font-bold border-b border-gray-400 mb-2" style={{ color: theme.primaryDark }}>{s.label}</h3>
            {content}
          </div>
        );
      })}
    </div>
  );
}

/* ===== CORPORATE ===== */
function CorporateTemplate({ data, theme, fontFamily, orderedSections, sectionMap, renderSection }: TemplateProps) {
  const sidebarSections = orderedSections.filter(s => ['skills', 'languages', 'certificates', 'awards'].includes(s.id));
  const mainSections = orderedSections.filter(s => !['skills', 'languages', 'certificates', 'awards'].includes(s.id));

  return (
    <div className="bg-white text-gray-800 min-h-full" style={{ fontFamily }}>
      <div className="p-6 border-b-2" style={{ borderColor: theme.primary, background: `${theme.primary}08` }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: theme.primaryDark }}>{data.personal.fullName || 'Your Name'}</h1>
            <p className="text-sm text-gray-600 mt-0.5">{data.personal.jobTitle || 'Job Title'}</p>
          </div>
          <div className="text-right text-xs text-gray-500 space-y-0.5">
            {data.personal.email && <div>{data.personal.email}</div>}
            {data.personal.phone && <div>{data.personal.phone}</div>}
            {data.personal.address && <div>{data.personal.address}</div>}
            {data.personal.linkedin && <div>{data.personal.linkedin}</div>}
          </div>
        </div>
      </div>
      <div className="flex">
        <div className="w-2/3 p-6">
          {mainSections.map(s => renderSection(s.id, s.label, '') )}
        </div>
        <div className="w-1/3 p-6 bg-gray-50" style={{ borderLeft: '1px solid #e5e7eb' }}>
          {sidebarSections.map(s => {
            const content = sectionMap[s.id];
            if (!content) return null;
            return (
              <div key={s.id} className="mb-5">
                <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: theme.primary }}>{s.label}</h3>
                {content}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
