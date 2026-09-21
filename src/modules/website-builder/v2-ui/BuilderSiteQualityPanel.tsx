import { useMemo, useState } from 'react';
import type { EditorProjectLike } from '../core/editor-model';
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
  const report = useMemo(() => auditEditorSiteQuality(project), [project]);
  const [category, setCategory] = useState<EditorQualityCategory | 'all'>('all');
  const visible = category === 'all' ? report.issues : report.issues.filter(issue => issue.category === category);
  const fixable = visible.filter(issue => issue.fixableWithAI);

  return <div className="tayar-v2-site-quality">
    <div className="tayar-v2-panel-heading">
      <div><strong>Site Quality</strong><div className="tayar-v2-muted">SEO, accessibility, links and performance</div></div>
      <div className="tayar-v2-quality-score" aria-label={`Site quality score ${report.score}`}>{report.score}</div>
    </div>
    <div className="tayar-v2-quality-summary">
      <span>{report.counts.error} errors</span><span>{report.counts.warning} warnings</span><span>{report.counts.info} suggestions</span>
    </div>
    <div className="tayar-v2-quality-tabs" role="tablist">
      <button type="button" onClick={() => setCategory('all')} aria-pressed={category === 'all'}>All ({report.issues.length})</button>
      {(Object.keys(labels) as EditorQualityCategory[]).map(key => <button type="button" key={key} onClick={() => setCategory(key)} aria-pressed={category === key}>{labels[key]} ({report.categoryCounts[key]})</button>)}
    </div>
    {fixable.length > 0 && <button type="button" className="tayar-v2-primary-action" onClick={() => void onFixWithAI?.(fixable)}>Fix {fixable.length} with AI</button>}
    <div className="tayar-v2-quality-list">
      {visible.length === 0 ? <div className="tayar-v2-empty-panel">No issues in this category.</div> : visible.map(item => <button type="button" className={`tayar-v2-quality-issue is-${item.severity}`} key={item.id} onClick={() => onSelectIssue?.(item)}>
        <span className="tayar-v2-quality-severity">{item.severity}</span><span>{item.message}</span>{item.fixableWithAI && <small>AI fix</small>}
      </button>)}
    </div>
  </div>;
}

export default BuilderSiteQualityPanel;
