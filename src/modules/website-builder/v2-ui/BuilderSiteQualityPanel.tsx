import { useMemo, useState } from 'react';
import { usePreferences } from '@/contexts/PreferencesContext';
import type { EditorProjectLike } from '../core/editor-model';
import { localizeSiteQuality } from '../core/editor-site-quality-localization';
import { auditEditorSiteQuality, type EditorQualityCategory, type EditorQualityIssue } from '../core/editor-site-quality';

export interface BuilderSiteQualityPanelProps {
  project: EditorProjectLike;
  onSelectIssue?(issue: EditorQualityIssue): void;
  onFixWithAI?(issues: EditorQualityIssue[]): void | Promise<void>;
}

const labels: Record<EditorQualityCategory, string> = {
  seo: 'SEO', accessibility: 'Accessibility', links: 'Links', performance: 'Performance',
};

export function BuilderSiteQualityPanel({ project, onSelectIssue, onFixWithAI }: BuilderSiteQualityPanelProps) {
  const { language } = usePreferences();
  const t = (value: string) => localizeSiteQuality(value, language);
  const report = useMemo(() => auditEditorSiteQuality(project), [project]);
  const [category, setCategory] = useState<EditorQualityCategory | 'all'>('all');
  const visible = category === 'all' ? report.issues : report.issues.filter(issue => issue.category === category);
  const fixable = visible.filter(issue => issue.fixableWithAI);

  return <div className="tayar-v2-site-quality">
    <div className="tayar-v2-panel-heading">
      <div><strong>{t('Site Quality')}</strong><div className="tayar-v2-muted">{t('SEO, accessibility, links and performance')}</div></div>
      <div className="tayar-v2-quality-score" aria-label={`${t('Site Quality')} ${report.score}`}>{report.score}</div>
    </div>
    <div className="tayar-v2-quality-summary">
      <span>{report.counts.error} {t('errors')}</span><span>{report.counts.warning} {t('warnings')}</span><span>{report.counts.info} {t('suggestions')}</span>
    </div>
    <div className="tayar-v2-quality-tabs" role="tablist">
      <button type="button" onClick={() => setCategory('all')} aria-pressed={category === 'all'}>{t('All')} ({report.issues.length})</button>
      {(Object.keys(labels) as EditorQualityCategory[]).map(key => <button type="button" key={key} onClick={() => setCategory(key)} aria-pressed={category === key}>{t(labels[key])} ({report.categoryCounts[key]})</button>)}
    </div>
    {fixable.length > 0 && <button type="button" className="tayar-v2-primary-action" onClick={() => void onFixWithAI?.(fixable)}>{t('Fix with AI')} ({fixable.length})</button>}
    <div className="tayar-v2-quality-list">
      {visible.length === 0 ? <div className="tayar-v2-empty-panel">{t('No issues in this category.')}</div> : visible.map(item => <button type="button" className={`tayar-v2-quality-issue is-${item.severity}`} key={item.id} onClick={() => onSelectIssue?.(item)}>
        <span className="tayar-v2-quality-severity">{item.severity}</span><span>{t(item.message)}</span>{item.fixableWithAI && <small>{t('AI fix')}</small>}
      </button>)}
    </div>
  </div>;
}

export default BuilderSiteQualityPanel;
