import { useLocalizer } from '@/lib/ui-localization';
import { type ChangeEvent, useEffect, useMemo, useState } from 'react';
import {
  Boxes, Check, Code2, Copy, ExternalLink, FileDiff, FolderCog, Heart, LayoutTemplate, Loader2, Package,
  ArrowRightLeft, Eye, Layers3, PackageCheck, RotateCcw, Save, Search, ShieldCheck, Sparkles, Upload, Zap,
} from 'lucide-react';
import { AIService } from '@/lib/ai/service';
import { componentRegistry } from './component-registry';
import { getRegistrySource, REGISTRY_SOURCES } from './source-catalog';
import { loadUpstreamComponentCode, loadUpstreamComponents } from './upstream-registry';
import { checkProjectDependencies, CodeProjectContext, CodeProjectOption, listCodeProjects, loadCodeProjectContext, summarizeProjectForAI } from './project-context';
import { buildPatchPreviews, CodePatchPlan, validatePatchPlan } from './patch-plan';
import { applyCodePatch, rollbackCodePatch } from './project-apply';
import { buildDependencyInstallCommand } from './dependency-spec';
import { resolveRegistryDependencies } from './registry-dependencies';
import { AIVariantOption, validateVariantOptions } from './variant-plan';
import { importPrivateComponentFiles, isAnimatedComponent } from './private-import';
import { summarizeStyleProfile } from './project-style';
import { buildIsolatedLivePreview } from './live-preview';
import { replacementCandidates, replacementTargets, validateExactReplacementPlan } from './replacement';
import { FEATURE_PRESETS, FeatureKind, featureCandidateMetadata, featureRegistryCandidates, getFeaturePreset, validateFeaturePatchPlan } from './feature-generator';
import { buildFeaturePreviewModel, buildFeaturePrimaryLivePreview } from './feature-preview';
import { buildControlledPackageEdit } from './package-editor';
import { auditFixableFindings, runProjectUIAudit, UIAuditReport, validateAuditFixPlan } from './ui-audit';
import { PAGE_PRESETS, PAGE_THEME_PRESETS, PageKind, PageThemeId, composePageAnchors, getPagePreset, getPageTheme, pageAnchorMetadata, validatePageComposerPlan } from './page-composer';
import { COMPONENT_KIT_PRESETS, ComponentKitPresetId, MAX_KIT_ITEMS, analyzeComponentKit, kitMetadata, presetKitItems, validateComponentKitPlan } from './component-kit';
import { UIComponentCategory, UIComponentRecord } from './types';

const AI_CONSTRAINTS = [
  { id: 'reuse-tokens', label: 'Reuse tokens', instruction: 'Reuse existing project design tokens and primitives instead of introducing a parallel design system.' },
  { id: 'accessibility', label: 'Accessible', instruction: 'Preserve or improve keyboard access, semantic markup, labels, focus visibility and contrast.' },
  { id: 'reduced-motion', label: 'Reduced motion', instruction: 'Respect prefers-reduced-motion and avoid motion that is required to understand or operate the UI.' },
  { id: 'no-animation-lib', label: 'No animation lib', instruction: 'Do not add motion, framer-motion, GSAP or another animation dependency; prefer CSS or no animation.' },
  { id: 'server-compatible', label: 'Server compatible', instruction: 'Prefer server-component-compatible structure where the project framework supports it; isolate client-only behavior to the smallest boundary.' },
] as const;

type AIConstraintId = typeof AI_CONSTRAINTS[number]['id'];

const PRIVATE_DIRECTORY_INPUT_PROPS = { webkitdirectory: '', directory: '' } as const;

const CATEGORIES: Array<{ id: UIComponentCategory | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'hero', label: 'Heroes' },
  { id: 'navigation', label: 'Navigation' },
  { id: 'dashboard', label: 'Dashboards' },
  { id: 'forms', label: 'Forms' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'authentication', label: 'Auth' },
  { id: 'ai', label: 'AI' },
  { id: 'cards', label: 'Cards' },
  { id: 'cta', label: 'CTA' },
  { id: 'data', label: 'Data' },
];

function Preview({ item }: { item: UIComponentRecord }) {
  const common = 'rounded-2xl border border-white/10 bg-[#090917] text-white overflow-hidden';
  if (item.preview === 'hero') return <div className={common}><div className="p-7 text-center bg-[radial-gradient(circle_at_top,rgba(139,92,246,.28),transparent_60%)]"><div className="mx-auto h-5 w-24 rounded-full bg-violet-500/20" /><div className="mx-auto mt-4 h-5 w-3/4 rounded bg-white/80" /><div className="mx-auto mt-2 h-3 w-1/2 rounded bg-white/20" /><div className="mx-auto mt-5 flex w-fit gap-2"><span className="h-8 w-20 rounded-lg bg-white" /><span className="h-8 w-20 rounded-lg border border-white/20" /></div></div></div>;
  if (item.preview === 'nav') return <div className={common}><div className="flex items-center justify-between p-4"><div className="h-5 w-16 rounded bg-white/80" /><div className="flex gap-2"><span className="h-3 w-10 rounded bg-white/20" /><span className="h-3 w-10 rounded bg-white/20" /><span className="h-7 w-16 rounded-lg bg-violet-500" /></div></div></div>;
  if (item.preview === 'pricing') return <div className={common}><div className="grid grid-cols-3 gap-2 p-4">{[0, 1, 2].map((i) => <div key={i} className={`h-24 rounded-xl border ${i === 1 ? 'border-violet-400 bg-violet-500/15' : 'border-white/10 bg-white/5'}`} />)}</div></div>;
  if (item.preview === 'auth') return <div className={common}><div className="mx-auto max-w-[190px] space-y-2 p-5"><div className="h-4 w-24 rounded bg-white/80" /><div className="h-8 rounded-lg bg-white/5 border border-white/10" /><div className="h-8 rounded-lg bg-white/5 border border-white/10" /><div className="h-8 rounded-lg bg-violet-500" /></div></div>;
  if (item.preview === 'stats') return <div className={common}><div className="grid grid-cols-3 gap-2 p-4">{[42, 68, 87].map((n) => <div key={n} className="rounded-xl bg-white/5 p-3"><div className="h-2 w-10 rounded bg-white/20" /><div className="mt-3 text-lg font-bold">{n}</div></div>)}</div></div>;
  if (item.preview === 'dashboard') return <div className={common}><div className="grid grid-cols-4 gap-2 p-4"><div className="col-span-1 h-28 rounded-xl bg-white/5" /><div className="col-span-3 space-y-2"><div className="grid grid-cols-3 gap-2">{[1, 2, 3].map((i) => <div key={i} className="h-9 rounded-lg bg-white/5" />)}</div><div className="h-[68px] rounded-xl bg-violet-500/10" /></div></div></div>;
  if (item.preview === 'chat') return <div className={common}><div className="space-y-2 p-4"><div className="h-8 w-2/3 rounded-xl bg-white/5" /><div className="ml-auto h-8 w-1/2 rounded-xl bg-violet-500" /><div className="mt-4 h-9 rounded-xl border border-white/10 bg-white/5" /></div></div>;
  return <div className={common}><div className="grid grid-cols-2 gap-3 p-5"><div className="h-20 rounded-xl border border-white/10 bg-white/5" /><div className="h-20 rounded-xl border border-violet-400/20 bg-violet-500/10" /><div className="col-span-2 h-8 rounded-lg bg-white/5" /></div></div>;
}

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

function registryStylesForAI(item: UIComponentRecord): unknown {
  if (!item.registryStyles) return null;
  const serialized = JSON.stringify(item.registryStyles);
  if (serialized.length <= 8_000) return item.registryStyles;
  return {
    truncated: true,
    preview: serialized.slice(0, 8_000),
  };
}

function filterRecords(
  records: UIComponentRecord[],
  query: string,
  category: UIComponentCategory | 'all',
  kind: 'all' | 'component' | 'block',
  sourceId: string,
  favoritesOnly: boolean,
  favoriteIds: Set<string>,
) {
  const q = query.trim().toLowerCase();
  const filtered = records.filter((record) => {
    if (category !== 'all' && record.category !== category) return false;
    if (kind !== 'all' && (record.kind || 'component') !== kind) return false;
    if (sourceId !== 'all' && record.sourceId !== sourceId) return false;
    if (favoritesOnly && !favoriteIds.has(record.id)) return false;
    if (!q) return true;
    return [record.name, record.description, record.category, ...record.tags]
      .some((value) => value.toLowerCase().includes(q));
  });

  if (!q) return filtered;
  const score = (record: UIComponentRecord) => {
    const name = record.name.toLowerCase();
    const description = record.description.toLowerCase();
    const tags = record.tags.map((tag) => tag.toLowerCase());
    let total = 0;
    if (name === q) total += 120;
    else if (name.startsWith(q)) total += 80;
    else if (name.includes(q)) total += 50;
    if (tags.includes(q)) total += 40;
    total += tags.filter((tag) => tag.includes(q)).length * 15;
    if (record.category.includes(q)) total += 20;
    if (description.includes(q)) total += 10;
    return total;
  };

  return [...filtered].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
}

function similarRecords(records: UIComponentRecord[], selected: UIComponentRecord | undefined) {
  if (!selected) return [];
  const selectedTags = new Set(selected.tags.map((tag) => tag.toLowerCase()));
  const score = (record: UIComponentRecord) => {
    let total = 0;
    if (record.category === selected.category) total += 12;
    if ((record.kind || 'component') === (selected.kind || 'component')) total += 3;
    if (record.sourceId === selected.sourceId) total += 2;
    for (const tag of record.tags) if (selectedTags.has(tag.toLowerCase())) total += 4;
    return total;
  };
  return records
    .filter((record) => record.id !== selected.id)
    .map((record) => ({ record, score: score(record) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.record.name.localeCompare(b.record.name))
    .slice(0, 6)
    .map((entry) => entry.record);
}

export default function CodeAssistantTool({ darkMode, projectId }: { darkMode: boolean; projectId?: string | null }) {
  const l = useLocalizer();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<UIComponentCategory | 'all'>('all');
  const [kindFilter, setKindFilter] = useState<'all' | 'component' | 'block'>('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [animatedOnly, setAnimatedOnly] = useState(false);
  const [privateItems, setPrivateItems] = useState<UIComponentRecord[]>([]);
  const [privateImportConfirmed, setPrivateImportConfirmed] = useState(false);
  const [privateImportMessage, setPrivateImportMessage] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(80);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState(componentRegistry.all()[0]?.id || '');
  const [tab, setTab] = useState<'preview' | 'code' | 'ai' | 'info'>('preview');
  const [copied, setCopied] = useState<'code' | 'prompt' | null>(null);
  const [showSources, setShowSources] = useState(false);
  const [upstreamItems, setUpstreamItems] = useState<UIComponentRecord[]>([]);
  const [upstreamLoading, setUpstreamLoading] = useState(true);
  const [upstreamErrors, setUpstreamErrors] = useState<string[]>([]);
  const [loadedCode, setLoadedCode] = useState<Record<string, string>>({});
  const [codeLoadingId, setCodeLoadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [livePreviewDoc, setLivePreviewDoc] = useState<string | null>(null);
  const [livePreviewReason, setLivePreviewReason] = useState<string | null>(null);
  const [livePreviewLoading, setLivePreviewLoading] = useState(false);
  const [aiInstruction, setAiInstruction] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMeta, setAiMeta] = useState<{ model: string; tokensIn: number; tokensOut: number } | null>(null);
  const [constraintIds, setConstraintIds] = useState<Set<AIConstraintId>>(new Set(['reuse-tokens', 'accessibility', 'reduced-motion']));
  const [variants, setVariants] = useState<AIVariantOption[]>([]);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [projectContext, setProjectContext] = useState<CodeProjectContext | null>(null);
  const [projectOptions, setProjectOptions] = useState<CodeProjectOption[]>([]);
  const [targetProjectId, setTargetProjectId] = useState(projectId || '');
  const [projectOptionsLoading, setProjectOptionsLoading] = useState(true);
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [patchPlan, setPatchPlan] = useState<CodePatchPlan | null>(null);
  const [patchLoading, setPatchLoading] = useState(false);
  const [applyConfirmed, setApplyConfirmed] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);
  const [replaceTargetPath, setReplaceTargetPath] = useState('');
  const [replaceLoading, setReplaceLoading] = useState(false);
  const [featureKind, setFeatureKind] = useState<FeatureKind>('dashboard');
  const [featureInstruction, setFeatureInstruction] = useState('');
  const [featureLoading, setFeatureLoading] = useState(false);
  const [patchOwnerId, setPatchOwnerId] = useState('');
  const [packageEditConfirmed, setPackageEditConfirmed] = useState(false);
  const [featurePreviewDoc, setFeaturePreviewDoc] = useState<string | null>(null);
  const [featurePreviewReason, setFeaturePreviewReason] = useState<string | null>(null);
  const [auditReport, setAuditReport] = useState<UIAuditReport | null>(null);
  const [auditFixLoading, setAuditFixLoading] = useState(false);
  const [pageKind, setPageKind] = useState<PageKind>('landing');
  const [pageThemeId, setPageThemeId] = useState<PageThemeId>('project-native');
  const [pageInstruction, setPageInstruction] = useState('');
  const [pageLoading, setPageLoading] = useState(false);
  const [kitIds, setKitIds] = useState<string[]>([]);
  const [kitPresetId, setKitPresetId] = useState<ComponentKitPresetId>('landing-starter');
  const [kitInstruction, setKitInstruction] = useState('');
  const [kitLoading, setKitLoading] = useState(false);
  const aiService = useMemo(() => new AIService('code-assistant', { temperature: 0.2, maxTokens: 4096 }), []);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem('tayar-code-assistant-favorites-v1') || '[]');
      if (Array.isArray(saved)) setFavoriteIds(new Set(saved.filter((value): value is string => typeof value === 'string')));
    } catch {
      // Ignore invalid local preference data.
    }
  }, []);

  useEffect(() => {
    if (projectId) setTargetProjectId(projectId);
  }, [projectId]);

  useEffect(() => {
    let active = true;
    setProjectOptionsLoading(true);
    listCodeProjects()
      .then((projects) => {
        if (active) setProjectOptions(projects);
      })
      .catch((error) => {
        if (active) setProjectError(error instanceof Error ? l(error.message) : l('Unable to load project choices.'));
      })
      .finally(() => {
        if (active) setProjectOptionsLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (!targetProjectId) {
      setProjectContext(null);
      setProjectError(null);
      setProjectLoading(false);
      return () => { active = false; };
    }

    setProjectLoading(true);
    setProjectError(null);
    loadCodeProjectContext(targetProjectId)
      .then((context) => {
        if (active) setProjectContext(context);
      })
      .catch((error) => {
        if (!active) return;
        setProjectContext(null);
        setProjectError(error instanceof Error ? l(error.message) : l('Unable to load project context.'));
      })
      .finally(() => {
        if (active) setProjectLoading(false);
      });

    return () => { active = false; };
  }, [targetProjectId]);

  useEffect(() => {
    let active = true;
    setUpstreamLoading(true);
    loadUpstreamComponents()
      .then((result) => {
        if (!active) return;
        setUpstreamItems(result.items);
        setUpstreamErrors(result.errors);
      })
      .catch((error) => {
        if (!active) return;
        setUpstreamErrors([error instanceof Error ? l(error.message) : l('Unable to load upstream registries.')]);
      })
      .finally(() => {
        if (active) setUpstreamLoading(false);
      });
    return () => { active = false; };
  }, []);

  const allItems = useMemo(() => [...componentRegistry.all(), ...upstreamItems, ...privateItems], [upstreamItems, privateItems]);
  const activeConstraintInstructions = useMemo(
    () => AI_CONSTRAINTS.filter((constraint) => constraintIds.has(constraint.id)).map((constraint) => constraint.instruction),
    [constraintIds],
  );
  const searchableItems = useMemo(() => {
    let items = allItems;
    if (constraintIds.has('no-animation-lib')) {
      items = items.filter((item) => !item.dependencies.some((dependency) => dependency === 'motion' || dependency === 'framer-motion' || dependency === 'gsap'));
    }
    if (animatedOnly) items = items.filter(isAnimatedComponent);
    return items;
  }, [allItems, constraintIds, animatedOnly]);
  const matches = useMemo(
    () => filterRecords(searchableItems, query, category, kindFilter, sourceFilter, favoritesOnly, favoriteIds),
    [searchableItems, query, category, kindFilter, sourceFilter, favoritesOnly, favoriteIds],
  );
  const visibleMatches = useMemo(() => matches.slice(0, visibleCount), [matches, visibleCount]);
  const selected = visibleMatches.find((item) => item.id === selectedId) || visibleMatches[0] || matches[0];
  const source = selected ? getRegistrySource(selected.sourceId) : undefined;
  const similarItems = useMemo(() => similarRecords(searchableItems, selected), [searchableItems, selected]);
  const selectedCode = selected ? (loadedCode[selected.id] ?? selected.code) : '';
  const selectedRegistryResolution = useMemo(
    () => selected ? resolveRegistryDependencies(allItems, selected) : { resolved: [], unresolved: [], npmDependencies: [], npmDependencyRequirements: [] },
    [allItems, selected],
  );
  const dependencyChecks = useMemo(
    () => checkProjectDependencies(projectContext, selectedRegistryResolution.npmDependencies),
    [projectContext, selectedRegistryResolution],
  );
  const missingDependencies = dependencyChecks.filter((entry) => !entry.installed);
  const projectStyleSummary = useMemo(
    () => projectContext ? summarizeStyleProfile(projectContext.styleProfile) : [],
    [projectContext],
  );
  const replaceTargets = useMemo(
    () => replacementTargets(projectContext?.files || []),
    [projectContext],
  );
  const replaceTarget = replaceTargets.find((entry) => entry.path === replaceTargetPath) || null;
  const suggestedReplacements = useMemo(
    () => replacementCandidates(searchableItems, replaceTarget, 8),
    [searchableItems, replaceTarget],
  );
  const featurePreset = useMemo(() => getFeaturePreset(featureKind), [featureKind]);
  const featureCandidates = useMemo(
    () => featureRegistryCandidates(searchableItems, featureKind, 6),
    [searchableItems, featureKind],
  );
  const featurePreview = useMemo(
    () => buildFeaturePreviewModel(patchPlan, patchOwnerId),
    [patchPlan, patchOwnerId],
  );
  const auditFixable = useMemo(
    () => auditReport ? auditFixableFindings(auditReport) : [],
    [auditReport],
  );
  const pagePreset = useMemo(() => getPagePreset(pageKind), [pageKind]);
  const pageTheme = useMemo(() => getPageTheme(pageThemeId), [pageThemeId]);
  const pageAnchors = useMemo(
    () => composePageAnchors(searchableItems, pageKind),
    [searchableItems, pageKind],
  );
  const kitItems = useMemo(
    () => kitIds.map((id) => allItems.find((item) => item.id === id)).filter((item): item is UIComponentRecord => Boolean(item)),
    [kitIds, allItems],
  );
  const kitCompatibility = useMemo(
    () => analyzeComponentKit(allItems, kitItems, projectContext),
    [allItems, kitItems, projectContext],
  );
  const installCommand = projectContext
    ? buildDependencyInstallCommand(
        projectContext.packageManager,
        selectedRegistryResolution.npmDependencyRequirements,
        missingDependencies.map((entry) => entry.name),
      )
    : '';
  const patchPreviews = useMemo(
    () => patchPlan ? buildPatchPreviews(projectContext, patchPlan) : [],
    [patchPlan, projectContext],
  );
  const patchDependencyChecks = useMemo(
    () => patchPlan ? checkProjectDependencies(projectContext, patchPlan.dependenciesToInstall) : [],
    [projectContext, patchPlan],
  );
  const unresolvedPatchDependencies = patchDependencyChecks.filter((entry) => !entry.installed);
  const controlledPackageEdit = useMemo(
    () => buildControlledPackageEdit(projectContext, patchPlan?.dependenciesToInstall || []),
    [projectContext, patchPlan],
  );
  const controlledPackageNames = new Set(
    packageEditConfirmed && controlledPackageEdit?.operation
      ? controlledPackageEdit.additions.map((entry) => entry.name)
      : [],
  );
  const unresolvedAfterPackageEdit = unresolvedPatchDependencies.filter((entry) => !controlledPackageNames.has(entry.name));
  const patchInstallCommand = projectContext && patchPlan
    ? buildDependencyInstallCommand(projectContext.packageManager, patchPlan.dependenciesToInstall, unresolvedPatchDependencies.map((entry) => entry.name))
    : '';
  const patchRegistryResolution = useMemo(
    () => selected ? resolveRegistryDependencies(allItems, selected) : { resolved: [], unresolved: [], npmDependencies: [], npmDependencyRequirements: [] },
    [allItems, selected],
  );
  const unresolvedPatchRegistryDependencies = patchPlan
    ? patchPlan.registryDependencies.filter((reference) => {
        const normalized = reference.replace(/\.json$/i, '').split('/').filter(Boolean).pop() || reference;
        return !patchRegistryResolution.resolved.some((item) => item.id.endsWith(`:${normalized}`))
          && !allItems.some((item) => item.id.endsWith(`:${normalized}`));
      })
    : [];
  const blindReplacePaths = patchPlan
    ? patchPlan.operations.filter((operation) => {
        if (operation.type !== 'replace') return false;
        const snapshot = projectContext?.files.find((file) => file.path === operation.path);
        return !snapshot || snapshot.truncated;
      }).map((operation) => operation.path)
    : [];
  const applyBlockers = [
    ...(!targetProjectId || !projectContext ? ['Choose a project before applying a patch.'] : []),
    ...(projectContext && !projectContext.canApply ? ['This project does not expose a supported content.files store.'] : []),
    ...(unresolvedAfterPackageEdit.length ? [`Missing npm dependencies: ${unresolvedAfterPackageEdit.map((entry) => entry.name).join(', ')}`] : []),
    ...(controlledPackageEdit?.operation && unresolvedPatchDependencies.length && !packageEditConfirmed ? ['Review and confirm the controlled package.json dependency edit, or use the install command instead.'] : []),
    ...(unresolvedPatchRegistryDependencies.length ? [`Resolve registry dependencies first: ${unresolvedPatchRegistryDependencies.join(', ')}`] : []),
    ...(blindReplacePaths.length ? [`Patch tries to replace files that were missing or truncated in the AI project snapshot: ${blindReplacePaths.join(', ')}`] : []),
  ];

  useEffect(() => {
    setVisibleCount(80);
  }, [query, category, kindFilter, sourceFilter, favoritesOnly, animatedOnly, constraintIds]);

  useEffect(() => {
    if (replaceTargetPath && !replaceTargets.some((entry) => entry.path === replaceTargetPath)) setReplaceTargetPath('');
  }, [replaceTargets, replaceTargetPath]);

  useEffect(() => {
    if (auditReport && projectContext?.fileStoreFingerprint !== auditReport.fingerprint) setAuditReport(null);
  }, [projectContext?.fileStoreFingerprint, auditReport]);

  useEffect(() => {
    setPackageEditConfirmed(false);
    setFeaturePreviewDoc(null);
    setFeaturePreviewReason(null);
  }, [patchPlan]);

  useEffect(() => {
    setVariants([]);
    setLivePreviewDoc(null);
    setLivePreviewReason(null);
  }, [selected?.id]);

  const toggleKitItem = (item: UIComponentRecord) => {
    setKitIds((current) => {
      if (current.includes(item.id)) return current.filter((id) => id !== item.id);
      if (current.length >= MAX_KIT_ITEMS) {
        setActionError(l('A component kit can contain up to {count} items.').replace('{count}', String(MAX_KIT_ITEMS)));
        return current;
      }
      setActionError(null);
      return [...current, item.id];
    });
  };

  const loadKitPreset = (presetId: ComponentKitPresetId) => {
    setKitPresetId(presetId);
    const items = presetKitItems(searchableItems, presetId);
    setKitIds(items.map((item) => item.id));
    setActionError(null);
    setPatchPlan(null);
    setApplyConfirmed(false);
  };

  const toggleConstraint = (id: AIConstraintId) => {
    setConstraintIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onPrivateImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    event.target.value = '';
    if (!files?.length || !privateImportConfirmed) return;

    setActionError(null);
    setPrivateImportMessage(null);
    try {
      const result = await importPrivateComponentFiles(files);
      setPrivateItems(result.items);
      if (result.items[0]) {
        setSelectedId(result.items[0].id);
        setSourceFilter('private-session');
        setTab('preview');
      }
      const skippedImportNotice = result.skipped.length
        ? l('; skipped {count} unsafe/unsupported files').replace('{count}', String(result.skipped.length))
        : '';
      setPrivateImportMessage(
        l('Loaded {count} private components for this browser session{skipped}.')
          .replace('{count}', String(result.items.length))
          .replace('{skipped}', skippedImportNotice),
      );
    } catch (error) {
      setActionError(error instanceof Error ? error.message : l('Unable to import private component files.'));
    }
  };

  const clearPrivateImport = () => {
    setPrivateItems([]);
    setPrivateImportMessage(null);
    setPrivateImportConfirmed(false);
    if (sourceFilter === 'private-session') setSourceFilter('all');
    if (selected?.sourceId === 'private-session') setSelectedId(componentRegistry.all()[0]?.id || '');
  };

  const toggleFavorite = (id: string) => {
    setFavoriteIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        window.localStorage.setItem('tayar-code-assistant-favorites-v1', JSON.stringify(Array.from(next)));
      } catch {
        // Favorites still work for this session if storage is unavailable.
      }
      return next;
    });
  };

  const ensureCode = async (item: UIComponentRecord): Promise<string> => {
    const existing = loadedCode[item.id] ?? item.code;
    if (existing) return existing;
    if (!item.remote) return '';

    setCodeLoadingId(item.id);
    setActionError(null);
    try {
      const code = await loadUpstreamComponentCode(item);
      setLoadedCode((current) => ({ ...current, [item.id]: code }));
      return code;
    } catch (error) {
      const message = error instanceof Error ? l(error.message) : l('Unable to load component code.');
      setActionError(message);
      throw error;
    } finally {
      setCodeLoadingId((current) => current === item.id ? null : current);
    }
  };

  const buildSourceBundle = async (item: UIComponentRecord) => {
    const resolution = resolveRegistryDependencies(allItems, item);
    const records = [item, ...resolution.resolved];
    const chunks: string[] = [];
    for (const record of records) {
      const code = await ensureCode(record);
      if (code) chunks.push(`// Registry item: ${record.id}\n${code}`);
    }
    return {
      code: chunks.join('\n\n'),
      resolution,
    };
  };

  const onRunLivePreview = async (item: UIComponentRecord) => {
    if (livePreviewLoading) return;
    setLivePreviewLoading(true);
    setLivePreviewReason(null);
    try {
      const code = await ensureCode(item);
      const result = buildIsolatedLivePreview(item, code);
      if (!result.supported || !result.srcDoc) {
        setLivePreviewDoc(null);
        setLivePreviewReason(result.reason || 'Live preview is not available for this component.');
        return;
      }
      setLivePreviewDoc(result.srcDoc);
    } catch (error) {
      setLivePreviewDoc(null);
      setLivePreviewReason(error instanceof Error ? l(error.message) : l('Unable to prepare live preview.'));
    } finally {
      setLivePreviewLoading(false);
    }
  };

  const onCopyCode = async (item: UIComponentRecord) => {
    try {
      const code = await ensureCode(item);
      if (!code) return;
      await copyText(code);
      setCopied('code');
      window.setTimeout(() => setCopied(null), 1400);
    } catch {
      // Error is rendered in the panel.
    }
  };

  const onUseAI = async (item: UIComponentRecord) => {
    if (aiLoading) return;
    setAiLoading(true);
    setActionError(null);
    setAiResult('');
    setAiMeta(null);
    setTab('ai');
    try {
      const bundle = await buildSourceBundle(item);
      const code = bundle.code;
      const maxSourceChars = 10_000;
      const sourceCode = code.slice(0, maxSourceChars);
      const response = await aiService.complete(
        {
          action: 'adapt-component',
          instruction: aiInstruction.trim() || item.aiPrompt,
          component: {
            id: item.id,
            name: item.name,
            category: item.category,
            kind: item.kind || 'component',
            source: getRegistrySource(item.sourceId)?.name || item.sourceId,
            license: item.license,
            registryStyles: registryStylesForAI(item),
            npmDependencies: bundle.resolution.npmDependencies,
            npmDependencyRequirements: bundle.resolution.npmDependencyRequirements,
            registryDependencies: item.remote?.registryDependencies || [],
            resolvedRegistryDependencies: bundle.resolution.resolved.map((entry) => entry.id),
            unresolvedRegistryDependencies: bundle.resolution.unresolved,
          },
          project: summarizeProjectForAI(projectContext),
          constraints: activeConstraintInstructions,
          dependencyAnalysis: checkProjectDependencies(projectContext, bundle.resolution.npmDependencies),
          sourceCode,
          sourceTruncated: code.length > maxSourceChars,
        },
        [],
        { temperature: 0.2, maxTokens: 4096 },
      );
      setAiResult(response.content);
      setAiMeta({ model: response.model, tokensIn: response.tokensIn, tokensOut: response.tokensOut });
    } catch (error) {
      setActionError(error instanceof Error ? l(error.message) : l('AI adaptation failed.'));
    } finally {
      setAiLoading(false);
    }
  };

  const onGenerateVariants = async (item: UIComponentRecord) => {
    if (variantsLoading || aiLoading || patchLoading) return;
    setVariantsLoading(true);
    setActionError(null);
    setVariants([]);
    setTab('ai');
    try {
      const bundle = await buildSourceBundle(item);
      const maxSourceChars = 6_000;
      const response = await aiService.completeJSON<unknown>(
        {
          action: 'suggest-component-variants',
          instruction: aiInstruction.trim() || item.aiPrompt,
          constraints: activeConstraintInstructions,
          component: {
            id: item.id,
            name: item.name,
            category: item.category,
            kind: item.kind || 'component',
            source: getRegistrySource(item.sourceId)?.name || item.sourceId,
            npmDependencies: bundle.resolution.npmDependencies,
          },
          project: summarizeProjectForAI(projectContext),
          sourceCode: bundle.code.slice(0, maxSourceChars),
          sourceTruncated: bundle.code.length > maxSourceChars,
        },
        [],
        { temperature: 0.5, maxTokens: 1800 },
      );
      if (!response.json) throw new Error('AI did not return structured variant options.');
      setVariants(validateVariantOptions(response.json));
      setAiMeta({ model: response.model, tokensIn: response.tokensIn, tokensOut: response.tokensOut });
    } catch (error) {
      setActionError(error instanceof Error ? l(error.message) : l('Unable to generate component options.'));
    } finally {
      setVariantsLoading(false);
    }
  };

  const onPlanPatch = async (item: UIComponentRecord) => {
    if (patchLoading || aiLoading) return;
    setPatchLoading(true);
    setActionError(null);
    setPatchPlan(null);
    setTab('ai');
    try {
      const bundle = await buildSourceBundle(item);
      const code = bundle.code;
      const maxSourceChars = 10_000;
      const response = await aiService.completeJSON<unknown>(
        {
          action: 'plan-component-patch',
          instruction: aiInstruction.trim() || item.aiPrompt,
          component: {
            id: item.id,
            name: item.name,
            category: item.category,
            kind: item.kind || 'component',
            source: getRegistrySource(item.sourceId)?.name || item.sourceId,
            license: item.license,
            registryStyles: registryStylesForAI(item),
            npmDependencies: bundle.resolution.npmDependencies,
            npmDependencyRequirements: bundle.resolution.npmDependencyRequirements,
            registryDependencies: item.remote?.registryDependencies || [],
            resolvedRegistryDependencies: bundle.resolution.resolved.map((entry) => entry.id),
            unresolvedRegistryDependencies: bundle.resolution.unresolved,
          },
          project: summarizeProjectForAI(projectContext),
          constraints: activeConstraintInstructions,
          dependencyAnalysis: checkProjectDependencies(projectContext, bundle.resolution.npmDependencies),
          sourceCode: code.slice(0, maxSourceChars),
          sourceTruncated: code.length > maxSourceChars,
        },
        [],
        { temperature: 0.1, maxTokens: 6144 },
      );
      if (!response.json) throw new Error('AI did not return a structured patch plan.');
      setPatchPlan(validatePatchPlan(response.json));
      setPatchOwnerId(item.id);
      setAiMeta({ model: response.model, tokensIn: response.tokensIn, tokensOut: response.tokensOut });
    } catch (error) {
      setActionError(error instanceof Error ? l(error.message) : l('Unable to generate a safe patch plan.'));
    } finally {
      setPatchLoading(false);
    }
  };

  const onPlanReplacement = async (item: UIComponentRecord) => {
    if (!replaceTarget || replaceLoading || patchLoading || aiLoading) return;
    setReplaceLoading(true);
    setActionError(null);
    setPatchPlan(null);
    setApplyConfirmed(false);
    setTab('ai');
    try {
      const bundle = await buildSourceBundle(item);
      const maxSourceChars = 8_000;
      const response = await aiService.completeJSON<unknown>(
        {
          action: 'replace-project-component',
          instruction: aiInstruction.trim() || `Replace ${replaceTarget.path} with ${item.name} while matching the project style.`,
          constraints: activeConstraintInstructions,
          targetFile: {
            path: replaceTarget.path,
            content: replaceTarget.content,
          },
          replacement: {
            id: item.id,
            name: item.name,
            category: item.category,
            kind: item.kind || 'component',
            source: getRegistrySource(item.sourceId)?.name || item.sourceId,
            license: item.license,
            registryStyles: registryStylesForAI(item),
            npmDependencies: bundle.resolution.npmDependencies,
            registryDependencies: item.remote?.registryDependencies || [],
          },
          project: summarizeProjectForAI(projectContext),
          dependencyAnalysis: checkProjectDependencies(projectContext, bundle.resolution.npmDependencies),
          replacementSource: bundle.code.slice(0, maxSourceChars),
          replacementSourceTruncated: bundle.code.length > maxSourceChars,
        },
        [],
        { temperature: 0.1, maxTokens: 6144 },
      );
      if (!response.json) throw new Error('AI did not return a structured replacement patch.');
      const plan = validatePatchPlan(response.json);
      validateExactReplacementPlan(replaceTarget.path, plan);
      setPatchPlan(plan);
      setPatchOwnerId(`replace:${replaceTarget.path}:${item.id}`);
      setSelectedId(item.id);
      setAiMeta({ model: response.model, tokensIn: response.tokensIn, tokensOut: response.tokensOut });
    } catch (error) {
      setActionError(error instanceof Error ? l(error.message) : l('Unable to generate a safe replacement patch.'));
    } finally {
      setReplaceLoading(false);
    }
  };

  const onPlanFullFeature = async () => {
    if (!projectContext || featureLoading || patchLoading || aiLoading) return;
    setFeatureLoading(true);
    setActionError(null);
    setPatchPlan(null);
    setApplyConfirmed(false);
    setTab('ai');
    try {
      const snippets: string[] = [];
      for (const item of featureCandidates.slice(0, 4)) {
        try {
          const code = await ensureCode(item);
          if (code) snippets.push(`// Inspiration: ${item.id}\n${code.slice(0, 2_000)}`);
        } catch {
          // Candidate metadata remains useful even when an upstream source file is temporarily unavailable.
        }
      }
      const registrySource = snippets.join('\n\n').slice(0, 8_000);
      const response = await aiService.completeJSON<unknown>(
        {
          action: 'plan-full-feature',
          feature: featurePreset,
          instruction: featureInstruction.trim() || featurePreset.defaultGoal,
          constraints: activeConstraintInstructions,
          project: summarizeProjectForAI(projectContext),
          registryCandidates: featureCandidateMetadata(featureCandidates),
          registrySource,
          registrySourceTruncated: snippets.join('\n\n').length > registrySource.length,
        },
        [],
        { temperature: 0.15, maxTokens: 8192 },
      );
      if (!response.json) throw new Error('AI did not return a structured feature patch plan.');
      const plan = validatePatchPlan(response.json);
      validateFeaturePatchPlan(projectContext, plan);
      setPatchPlan(plan);
      setPatchOwnerId(`feature:${featureKind}`);
      setAiMeta({ model: response.model, tokensIn: response.tokensIn, tokensOut: response.tokensOut });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : l('Unable to generate a safe feature pack.'));
    } finally {
      setFeatureLoading(false);
    }
  };

  const onPlanComponentKit = async () => {
    if (!projectContext || kitLoading || patchLoading || aiLoading || !kitItems.length) return;
    if (kitCompatibility.unresolvedRegistryDependencies.length) {
      setActionError(l('Resolve registry dependencies first: {dependencies}').replace('{dependencies}', kitCompatibility.unresolvedRegistryDependencies.join(', ')));
      return;
    }
    if (kitCompatibility.frameworkWarnings.length) {
      setActionError(kitCompatibility.frameworkWarnings.join(' '));
      return;
    }
    setKitLoading(true);
    setActionError(null);
    setPatchPlan(null);
    setApplyConfirmed(false);
    setPackageEditConfirmed(false);
    setTab('ai');
    try {
      const snippets: string[] = [];
      for (const item of kitItems) {
        try {
          const bundle = await buildSourceBundle(item);
          if (bundle.resolution.unresolved.length) {
            throw new Error(`Unresolved registry dependency for ${item.name}: ${bundle.resolution.unresolved.join(', ')}`);
          }
          if (bundle.code) snippets.push(`// Kit item: ${item.id}\n${bundle.code.slice(0, 1_600)}`);
        } catch (error) {
          throw new Error(error instanceof Error ? l(error.message) : l('Unable to load {name} for kit composition.').replace('{name}', item.name));
        }
      }
      const combined = snippets.join('\n\n');
      const source = combined.slice(0, 10_000);
      const response = await aiService.completeJSON<unknown>(
        {
          action: 'compose-component-kit',
          instruction: kitInstruction.trim() || 'Compose the selected UI components into one coherent project-ready integration pack.',
          constraints: activeConstraintInstructions,
          project: summarizeProjectForAI(projectContext),
          kit: kitMetadata(kitItems),
          compatibility: kitCompatibility,
          source,
          sourceTruncated: combined.length > source.length,
        },
        [],
        { temperature: 0.1, maxTokens: 8192 },
      );
      if (!response.json) throw new Error('AI did not return a structured component kit patch.');
      const plan = validatePatchPlan(response.json);
      validateComponentKitPlan(projectContext, kitCompatibility, plan);
      setPatchPlan(plan);
      setPatchOwnerId(`kit:${kitIds.join('|')}`);
      setAiMeta({ model: response.model, tokensIn: response.tokensIn, tokensOut: response.tokensOut });
    } catch (error) {
      setActionError(error instanceof Error ? l(error.message) : l('Unable to generate a safe component kit patch.'));
    } finally {
      setKitLoading(false);
    }
  };

  const onPlanPageComposition = async () => {
    if (!projectContext || pageLoading || patchLoading || aiLoading) return;
    setPageLoading(true);
    setActionError(null);
    setPatchPlan(null);
    setApplyConfirmed(false);
    setPackageEditConfirmed(false);
    setTab('ai');
    try {
      const snippets: string[] = [];
      for (const anchor of pageAnchors.slice(0, 5)) {
        try {
          const code = await ensureCode(anchor.item);
          if (code) snippets.push(`// Section: ${anchor.section.label} · ${anchor.item.id}\n${code.slice(0, 1_500)}`);
        } catch {
          // Metadata remains usable when an upstream source is temporarily unavailable.
        }
      }
      const combined = snippets.join('\n\n');
      const source = combined.slice(0, 8_000);
      const response = await aiService.completeJSON<unknown>(
        {
          action: 'plan-page-composition',
          page: {
            id: pagePreset.id,
            label: pagePreset.label,
            description: pagePreset.description,
            sections: pagePreset.sections.map((section) => ({ id: section.id, label: section.label })),
          },
          theme: pageTheme,
          instruction: pageInstruction.trim() || pagePreset.defaultGoal,
          constraints: activeConstraintInstructions,
          project: summarizeProjectForAI(projectContext),
          anchors: pageAnchorMetadata(pageAnchors),
          anchorSource: source,
          anchorSourceTruncated: combined.length > source.length,
        },
        [],
        { temperature: 0.12, maxTokens: 8192 },
      );
      if (!response.json) throw new Error('AI did not return a structured page composition patch.');
      const plan = validatePatchPlan(response.json);
      validatePageComposerPlan(projectContext, plan);
      setPatchPlan(plan);
      setPatchOwnerId(`page:${pageKind}:${pageThemeId}`);
      setAiMeta({ model: response.model, tokensIn: response.tokensIn, tokensOut: response.tokensOut });
    } catch (error) {
      setActionError(error instanceof Error ? l(error.message) : l('Unable to generate a safe page composition.'));
    } finally {
      setPageLoading(false);
    }
  };

  const onRunProjectAudit = () => {
    if (!projectContext) return;
    setActionError(null);
    setAuditReport(runProjectUIAudit(projectContext));
  };

  const onPlanAuditFixes = async () => {
    if (!projectContext || !auditReport || !auditFixable.length || auditFixLoading || patchLoading || aiLoading) return;
    setAuditFixLoading(true);
    setActionError(null);
    setPatchPlan(null);
    setApplyConfirmed(false);
    setPackageEditConfirmed(false);
    setTab('ai');
    try {
      const response = await aiService.completeJSON<unknown>(
        {
          action: 'plan-ui-audit-fixes',
          constraints: activeConstraintInstructions,
          audit: {
            score: auditReport.score,
            counts: auditReport.counts,
            scannedFiles: auditReport.scannedFiles,
            totalFiles: auditReport.totalFiles,
            findings: auditFixable.map((finding) => ({
              id: finding.id,
              category: finding.category,
              severity: finding.severity,
              path: finding.path,
              message: finding.message,
              evidence: finding.evidence,
              suggestion: finding.suggestion,
            })),
          },
          project: summarizeProjectForAI(projectContext),
        },
        [],
        { temperature: 0.05, maxTokens: 8192 },
      );
      if (!response.json) throw new Error('AI did not return a structured UI audit fix plan.');
      const plan = validatePatchPlan(response.json);
      validateAuditFixPlan(projectContext, auditReport, plan);
      setPatchPlan(plan);
      setPatchOwnerId(`audit:${auditReport.fingerprint}`);
      setAiMeta({ model: response.model, tokensIn: response.tokensIn, tokensOut: response.tokensOut });
    } catch (error) {
      setActionError(error instanceof Error ? l(error.message) : l('Unable to generate a safe UI audit fix plan.'));
    } finally {
      setAuditFixLoading(false);
    }
  };

  const onRunFeaturePreview = () => {
    if (!patchPlan || (!patchOwnerId.startsWith('feature:') && !patchOwnerId.startsWith('page:') && !patchOwnerId.startsWith('kit:'))) return;
    const result = buildFeaturePrimaryLivePreview(patchPlan, patchOwnerId);
    if (!result.supported || !result.srcDoc) {
      setFeaturePreviewDoc(null);
      setFeaturePreviewReason(result.reason || 'Primary feature preview is not available for this pack.');
      return;
    }
    setFeaturePreviewDoc(result.srcDoc);
    setFeaturePreviewReason(null);
  };

  const refreshProjectContext = async () => {
    if (!targetProjectId) return null;
    const refreshed = await loadCodeProjectContext(targetProjectId);
    setProjectContext(refreshed);
    return refreshed;
  };

  const onApplyPatch = async (item: UIComponentRecord) => {
    if (!targetProjectId || !projectContext || !patchPlan || !applyConfirmed || applyBlockers.length || applyLoading) return;
    setApplyLoading(true);
    setActionError(null);
    setApplyMessage(null);
    try {
      await applyCodePatch(
        targetProjectId,
        projectContext.fileStoreFingerprint,
        patchPlan,
        patchOwnerId || item.id,
        packageEditConfirmed ? controlledPackageEdit?.operation || null : null,
      );
      await refreshProjectContext();
      setApplyConfirmed(false);
      setPackageEditConfirmed(false);
      setApplyMessage(l("Patch applied. A rollback checkpoint is available until the project files change again."));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : l('Unable to apply the patch.'));
    } finally {
      setApplyLoading(false);
    }
  };

  const onRollbackPatch = async () => {
    if (!targetProjectId || !projectContext?.lastApply || applyLoading) return;
    setApplyLoading(true);
    setActionError(null);
    setApplyMessage(null);
    try {
      await rollbackCodePatch(targetProjectId, projectContext.lastApply.id);
      await refreshProjectContext();
      setPatchPlan(null);
      setPatchOwnerId('');
      setPackageEditConfirmed(false);
      setApplyConfirmed(false);
      setApplyMessage(l("Last Coding Assistance patch was rolled back."));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : l('Unable to rollback the patch.'));
    } finally {
      setApplyLoading(false);
    }
  };

  const shell = darkMode ? 'bg-[#080814] text-white' : 'bg-white text-gray-900';
  const panel = darkMode ? 'border-white/10 bg-white/[0.035]' : 'border-gray-200 bg-gray-50';

  return (
    <div className={`min-h-[calc(100vh-8rem)] rounded-3xl border p-4 sm:p-6 ${shell} ${darkMode ? 'border-violet-400/10' : 'border-gray-200'}`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-violet-400 text-xs font-semibold uppercase tracking-[0.18em]"><Code2 className="h-4 w-4" />{l('Tayar Coding Assistance')}</div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold">{l('UI Registry')}</h1>
          <p className={`mt-2 max-w-2xl text-sm leading-6 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Browse reusable UI, inspect code and dependencies, then hand source-aware adaptation instructions to AI. Only approved redistributable sources are loaded.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-violet-500/10 px-2.5 py-1 text-violet-300">{allItems.length} components</span>
            {projectLoading && <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 opacity-60"><Loader2 className="h-3 w-3 animate-spin" />{l('Reading active project')}</span>}
            {!projectLoading && projectContext && <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 px-2.5 py-1 text-cyan-300"><FolderCog className="h-3 w-3" /> {projectContext.title} · {projectContext.framework}</span>}
            {!projectLoading && targetProjectId && !projectContext && <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-300">{l('Project context unavailable')}</span>}
            {upstreamLoading && <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 opacity-60"><Loader2 className="h-3 w-3 animate-spin" />{l('Loading open-source registries')}</span>}
            {!upstreamLoading && upstreamItems.length > 0 && <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-400">{upstreamItems.length} upstream items loaded</span>}
            {privateItems.length > 0 && <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-300">{privateItems.length} private session items</span>}
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[260px]">
          <label className="text-[10px] font-semibold uppercase tracking-wider opacity-45">{l('Target project')}</label>
          <select value={targetProjectId} disabled={projectOptionsLoading} onChange={(event) => { setTargetProjectId(event.target.value); setPatchPlan(null); setApplyConfirmed(false); setApplyMessage(null); }} className={`w-full rounded-xl border px-3 py-2.5 text-xs outline-none ${darkMode ? 'border-white/10 bg-[#10101d]' : 'border-gray-200 bg-white'}`}>
            <option value="">{projectOptionsLoading ? 'Loading projects...' : 'Review only — no project selected'}</option>
            {projectOptions.map((project) => <option key={project.id} value={project.id}>{project.title} · {project.type}</option>)}
          </select>
          <button onClick={() => setShowSources((value) => !value)} className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${panel}`}><ShieldCheck className="h-4 w-4 text-emerald-400" />{l('Source policy')}</button>
          <div className={`rounded-xl border p-3 ${panel}`}>
            <label className="flex items-start gap-2 text-[11px] leading-4"><input type="checkbox" checked={privateImportConfirmed} onChange={(event) => setPrivateImportConfirmed(event.target.checked)} className="mt-0.5" /><span>I confirm I have the right/license to use the private files I select.</span></label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${privateImportConfirmed ? 'border-amber-400/30 bg-amber-500/10 text-amber-300' : 'pointer-events-none opacity-40'}`}><Upload className="h-3.5 w-3.5" />{l('Files')}<input type="file" multiple accept=".ts,.tsx,.js,.jsx,.mts,.cts,.mjs,.cjs,.css,.scss,.sass,.less" onChange={(event) => void onPrivateImport(event)} className="hidden" /></label>
              <label className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${privateImportConfirmed ? 'border-amber-400/30 bg-amber-500/10 text-amber-300' : 'pointer-events-none opacity-40'}`}><FolderCog className="h-3.5 w-3.5" />{l('Folder')}<input {...PRIVATE_DIRECTORY_INPUT_PROPS} type="file" multiple onChange={(event) => void onPrivateImport(event)} className="hidden" /></label>
            </div>
            <p className="mt-2 text-[10px] leading-4 opacity-45">Session only: selected source is read locally in your browser and is not uploaded to the Tayar public registry. Large packs are capped and helper/type files are ignored as standalone components.</p>
            {privateItems.length > 0 && <button onClick={clearPrivateImport} className="mt-2 text-[10px] text-amber-300 underline underline-offset-2">{l('Clear private session files')}</button>}
          </div>
        </div>
      </div>

      {privateImportMessage && (
        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">
          {privateImportMessage}
        </div>
      )}

      {applyMessage && (
        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-300">
          {applyMessage}
        </div>
      )}

      {projectError && (
        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">
          {projectError}
        </div>
      )}

      {upstreamErrors.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">
          Some registries could not be loaded: {upstreamErrors.join(' · ')}
        </div>
      )}

      {showSources && (
        <div className={`mt-5 rounded-2xl border p-4 ${panel}`}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {REGISTRY_SOURCES.filter((entry) => entry.id !== 'tayar-native' && entry.id !== 'private-session').map((entry) => {
              const sourceUrl = entry.repository ? `https://github.com/${entry.repository}` : entry.homepageUrl;
              return (
                <div key={entry.id} className="rounded-xl border border-white/10 p-3">
                  <div className="flex items-start justify-between gap-2"><strong className="text-sm">{entry.name}</strong><span className={`rounded-full px-2 py-0.5 text-[10px] ${entry.redistributionAllowed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{entry.redistributionAllowed ? entry.license : 'Blocked'}</span></div>
                  <p className={`mt-2 text-xs leading-5 ${darkMode ? 'text-gray-500' : 'text-gray-600'}`}>{entry.note}</p>
                  {sourceUrl && <a href={sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300">{entry.repository ? 'Repository' : 'Website'} <ExternalLink className="h-3 w-3" /></a>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <section className={`mt-5 rounded-2xl border p-4 sm:p-5 ${panel}`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div><div className="flex items-center gap-2 text-sm font-semibold"><Layers3 className="h-4 w-4 text-violet-400" />{l('Full Feature Generator')}</div><p className="mt-2 max-w-2xl text-xs leading-5 opacity-55">{l("Generate a reviewable multi-file frontend feature pack using the active project's style, framework and existing file boundaries. No DB migration, API/server file or package.json write is allowed.")}</p></div>
          <button disabled={!projectContext || featureLoading || patchLoading || aiLoading} onClick={() => void onPlanFullFeature()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-xs font-semibold text-white hover:bg-violet-400 disabled:opacity-40">{featureLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers3 className="h-4 w-4" />} {l('Plan full feature')}</button>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-5">{FEATURE_PRESETS.map((preset) => <button key={preset.id} onClick={() => { setFeatureKind(preset.id); setPatchPlan(null); setApplyConfirmed(false); }} className={`rounded-xl border p-3 text-left transition ${featureKind === preset.id ? 'border-violet-400/30 bg-violet-500/10' : darkMode ? 'border-white/10 bg-black/10 hover:border-white/20' : 'border-gray-200 bg-white hover:border-violet-200'}`}><div className="text-xs font-semibold">{l(preset.label)}</div><div className="mt-1 text-[10px] leading-4 opacity-45">{l(preset.description)}</div></button>)}</div>
        <textarea value={featureInstruction} onChange={(event) => setFeatureInstruction(event.target.value)} placeholder={l(featurePreset.defaultGoal)} className={`mt-3 min-h-20 w-full resize-y rounded-xl border p-3 text-xs outline-none ${darkMode ? 'border-white/10 bg-black/20 placeholder:text-gray-600' : 'border-gray-200 bg-white'}`} />
        <div className="mt-3 flex flex-wrap items-center gap-2"><span className="text-[10px] uppercase tracking-wider opacity-40">{l('Registry anchors')}</span>{featureCandidates.map((item) => <button key={item.id} onClick={() => { setSelectedId(item.id); setTab('preview'); }} className="rounded-full border border-white/10 px-2 py-1 text-[10px] opacity-65 hover:opacity-100">{item.name}</button>)}{!projectContext && <span className="text-[10px] text-amber-300">{l('Choose a target project to generate a feature pack.')}</span>}</div>
      </section>

      <section className={`mt-5 rounded-2xl border p-4 sm:p-5 ${panel}`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div><div className="flex items-center gap-2 text-sm font-semibold"><Boxes className="h-4 w-4 text-emerald-400" />{l('Component Kit Composer')}</div><p className="mt-2 max-w-2xl text-xs leading-5 opacity-55">{l('Combine up to {count} compatible components into one coherent integration pack. Use a starter preset or build a custom kit by selecting a component and pressing Add to kit.').replace('{count}', String(MAX_KIT_ITEMS))}</p></div>
          <button disabled={!projectContext || !kitItems.length || kitLoading || patchLoading || aiLoading || kitCompatibility.unresolvedRegistryDependencies.length > 0 || kitCompatibility.frameworkWarnings.length > 0} onClick={() => void onPlanComponentKit()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-40">{kitLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Boxes className="h-4 w-4" />} {l('Compose kit')}</button>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">{COMPONENT_KIT_PRESETS.map((preset) => <button key={preset.id} onClick={() => loadKitPreset(preset.id)} className={`rounded-xl border p-3 text-left transition ${kitPresetId === preset.id ? 'border-emerald-400/30 bg-emerald-500/10' : darkMode ? 'border-white/10 bg-black/10 hover:border-white/20' : 'border-gray-200 bg-white hover:border-emerald-200'}`}><div className="text-xs font-semibold">{l(preset.label)}</div><div className="mt-1 text-[10px] leading-4 opacity-45">{l(preset.description)}</div></button>)}</div>
        <textarea value={kitInstruction} onChange={(event) => setKitInstruction(event.target.value)} placeholder={l("Example: Build these into a compact onboarding flow, reuse existing project buttons and keep mobile layout simple.")} className={`mt-3 min-h-20 w-full resize-y rounded-xl border p-3 text-xs outline-none ${darkMode ? 'border-white/10 bg-black/20 placeholder:text-gray-600' : 'border-gray-200 bg-white'}`} />
        <div className="mt-3 flex flex-wrap gap-2">{kitItems.map((item) => <button key={item.id} onClick={() => toggleKitItem(item)} className="rounded-full border border-emerald-400/20 bg-emerald-500/5 px-2.5 py-1.5 text-[10px] text-emerald-200">{item.name} ×</button>)}{!kitItems.length && <span className="text-[10px] opacity-45">{l('Kit is empty. Load a preset or add selected components.')}</span>}{kitItems.length > 0 && <button onClick={() => { setKitIds([]); setPatchPlan(null); setApplyConfirmed(false); }} className="rounded-full border border-white/10 px-2.5 py-1.5 text-[10px] opacity-55">{l('Clear kit')}</button>}</div>
        <div className="mt-3 grid gap-2 sm:grid-cols-4"><div className="rounded-xl border border-white/10 p-3"><div className="text-[9px] uppercase tracking-wider opacity-40">{l('Items')}</div><div className="mt-1 text-sm font-semibold">{kitItems.length}/{MAX_KIT_ITEMS}</div></div><div className="rounded-xl border border-white/10 p-3"><div className="text-[9px] uppercase tracking-wider opacity-40">NPM</div><div className="mt-1 text-[10px] leading-4">{kitCompatibility.npmNames.length ? kitCompatibility.npmNames.join(', ') : l('None')}</div></div><div className="rounded-xl border border-white/10 p-3"><div className="text-[9px] uppercase tracking-wider opacity-40">{l('Registry deps')}</div><div className={`mt-1 text-[10px] leading-4 ${kitCompatibility.unresolvedRegistryDependencies.length ? 'text-amber-300' : 'text-emerald-300'}`}>{kitCompatibility.unresolvedRegistryDependencies.length ? `Unresolved: ${kitCompatibility.unresolvedRegistryDependencies.join(', ')}` : `${kitCompatibility.resolvedRegistryIds.length} resolved / none blocked`}</div></div><div className="rounded-xl border border-white/10 p-3"><div className="text-[9px] uppercase tracking-wider opacity-40">{l('Compatibility')}</div><div className={`mt-1 text-[10px] leading-4 ${kitCompatibility.frameworkWarnings.length ? 'text-amber-300' : 'text-emerald-300'}`}>{kitCompatibility.frameworkWarnings.length ? kitCompatibility.frameworkWarnings.join(' ') : projectContext ? `Ready for ${projectContext.framework}` : 'Choose project'}</div></div></div>
      </section>

      <section className={`mt-5 rounded-2xl border p-4 sm:p-5 ${panel}`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div><div className="flex items-center gap-2 text-sm font-semibold"><LayoutTemplate className="h-4 w-4 text-fuchsia-400" />{l('Page Composer + Themes')}</div><p className="mt-2 max-w-2xl text-xs leading-5 opacity-55">{l('Compose a complete page from ranked registry anchors instead of choosing components one by one. The generated pack reuses project style, supports a controlled theme direction and still goes through Preview, Dependency Review, Diff, Safe Apply and Rollback.')}</p></div>
          <button disabled={!projectContext || pageLoading || patchLoading || aiLoading} onClick={() => void onPlanPageComposition()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-fuchsia-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-fuchsia-500 disabled:opacity-40">{pageLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LayoutTemplate className="h-4 w-4" />} {l('Compose page')}</button>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-4">{PAGE_PRESETS.map((preset) => <button key={preset.id} onClick={() => { setPageKind(preset.id); setPatchPlan(null); setApplyConfirmed(false); }} className={`rounded-xl border p-3 text-left transition ${pageKind === preset.id ? 'border-fuchsia-400/30 bg-fuchsia-500/10' : darkMode ? 'border-white/10 bg-black/10 hover:border-white/20' : 'border-gray-200 bg-white hover:border-fuchsia-200'}`}><div className="text-xs font-semibold">{l(preset.label)}</div><div className="mt-1 text-[10px] leading-4 opacity-45">{l(preset.description)}</div></button>)}</div>
        <div className="mt-3 flex flex-wrap gap-2">{PAGE_THEME_PRESETS.map((theme) => <button key={theme.id} onClick={() => { setPageThemeId(theme.id); setPatchPlan(null); setApplyConfirmed(false); }} className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold ${pageThemeId === theme.id ? 'border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-200' : 'border-white/10 opacity-60'}`}>{l(theme.label)}</button>)}</div>
        <textarea value={pageInstruction} onChange={(event) => setPageInstruction(event.target.value)} placeholder={l(pagePreset.defaultGoal)} className={`mt-3 min-h-20 w-full resize-y rounded-xl border p-3 text-xs outline-none ${darkMode ? 'border-white/10 bg-black/20 placeholder:text-gray-600' : 'border-gray-200 bg-white'}`} />
        <div className="mt-3"><div className="text-[10px] uppercase tracking-wider opacity-40">{l('Section anchors')}</div><div className="mt-2 flex flex-wrap gap-2">{pageAnchors.map(({ section, item }) => <button key={section.id} onClick={() => { setSelectedId(item.id); setTab('preview'); }} className="rounded-full border border-white/10 px-2.5 py-1.5 text-[10px] opacity-70 hover:opacity-100"><span className="opacity-45">{l(section.label)}:</span> {item.name}</button>)}{!pageAnchors.length && <span className="text-[10px] opacity-45">{l('No strong registry anchors found for this page preset.')}</span>}</div></div>
        <div className="mt-3 rounded-xl border border-white/10 p-3 text-[10px] leading-4 opacity-55"><strong className="opacity-90">{l(pageTheme.label)}:</strong> {l(pageTheme.instruction)}</div>
      </section>

      <section className={`mt-5 rounded-2xl border p-4 sm:p-5 ${panel}`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div><div className="flex items-center gap-2 text-sm font-semibold"><Search className="h-4 w-4 text-cyan-400" />{l('Project UI Audit')}</div><p className="mt-2 max-w-2xl text-xs leading-5 opacity-55">{l('Run a bounded project-wide static scan for accessibility, responsive layout, style consistency, motion handling, dependency noise and repeated UI patterns. Findings are produced locally before AI is involved.')}</p></div>
          <div className="flex flex-wrap gap-2"><button disabled={!projectContext} onClick={onRunProjectAudit} className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-500/5 px-4 py-2.5 text-xs font-semibold text-cyan-200 disabled:opacity-40"><Search className="h-4 w-4" /> {auditReport ? l('Run audit again') : l('Run project audit')}</button>{auditReport && <button disabled={!auditFixable.length || auditFixLoading || patchLoading || aiLoading} onClick={() => void onPlanAuditFixes()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-40">{auditFixLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDiff className="h-4 w-4" />} {l('Generate fix plan')}</button>}</div>
        </div>
        {!projectContext && <div className="mt-3 text-[11px] text-amber-300">{l('Choose a target project to run the UI audit.')}</div>}
        {auditReport && <div className="mt-4 space-y-3">
          <div className="grid gap-2 sm:grid-cols-5"><div className="rounded-xl border border-white/10 p-3"><div className="text-[9px] uppercase tracking-wider opacity-40">{l('Score')}</div><div className={`mt-1 text-xl font-bold ${auditReport.score >= 85 ? 'text-emerald-300' : auditReport.score >= 65 ? 'text-amber-300' : 'text-red-300'}`}>{auditReport.score}/100</div></div><div className="rounded-xl border border-white/10 p-3"><div className="text-[9px] uppercase tracking-wider opacity-40">{l('High')}</div><div className="mt-1 text-xl font-bold text-red-300">{auditReport.counts.high}</div></div><div className="rounded-xl border border-white/10 p-3"><div className="text-[9px] uppercase tracking-wider opacity-40">{l('Medium')}</div><div className="mt-1 text-xl font-bold text-amber-300">{auditReport.counts.medium}</div></div><div className="rounded-xl border border-white/10 p-3"><div className="text-[9px] uppercase tracking-wider opacity-40">{l('Low')}</div><div className="mt-1 text-xl font-bold opacity-70">{auditReport.counts.low}</div></div><div className="rounded-xl border border-white/10 p-3"><div className="text-[9px] uppercase tracking-wider opacity-40">{l('Coverage')}</div><div className="mt-1 text-sm font-bold">{auditReport.scannedFiles}/{auditReport.totalFiles}</div><div className="mt-1 text-[9px] opacity-40">{auditReport.truncated ? l('bounded scan') : l('all UI files scanned')}</div></div></div>
          <div className="flex flex-wrap gap-1.5">{(['accessibility','responsive','consistency','motion','dependencies','duplication'] as const).map((categoryName) => { const count = auditReport.findings.filter((finding) => finding.category === categoryName).length; return <span key={categoryName} className="rounded-full border border-white/10 px-2 py-1 text-[10px] capitalize opacity-70">{categoryName}: {count}</span>; })}<span className="rounded-full border border-emerald-400/20 bg-emerald-500/5 px-2 py-1 text-[10px] text-emerald-300">{l('Fixable in safe context')}: {auditFixable.length}</span></div>
          {auditReport.findings.length ? <div className="grid gap-2 lg:grid-cols-2">{auditReport.findings.slice(0, 16).map((finding) => <div key={finding.id} className="rounded-xl border border-white/10 p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="flex flex-wrap items-center gap-1"><span className={`rounded-full px-2 py-0.5 text-[9px] ${finding.severity === 'high' ? 'bg-red-500/10 text-red-300' : finding.severity === 'medium' ? 'bg-amber-500/10 text-amber-300' : 'bg-white/5 opacity-60'}`}>{finding.severity}</span><span className="rounded-full bg-cyan-500/5 px-2 py-0.5 text-[9px] text-cyan-300">{finding.category}</span>{finding.fixable && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] text-emerald-300">safe fix context</span>}</div><div className="mt-2 text-xs font-semibold leading-5">{finding.message}</div>{finding.path && <div className="mt-1 truncate text-[10px] opacity-45">{finding.path}</div>}</div></div><div className="mt-2 text-[10px] leading-4 opacity-50">{finding.suggestion}</div></div>)}</div> : <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs text-emerald-300">{l('No issues matched the current deterministic audit rules.')}</div>}
          {auditReport.findings.length > 16 && <div className="text-[10px] opacity-45">{l('Showing the first 16 of {count} findings. The full finding set is retained for scoring; only safe-context findings are eligible for AI fix planning.').replace('{count}', String(auditReport.findings.length))}</div>}
        </div>}
      </section>

      <div className="mt-6 grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className={`rounded-2xl border p-3 ${panel}`}>
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={l("Search components...")} className={`w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm outline-none focus:border-violet-400/50 ${darkMode ? 'border-white/10 bg-black/20 placeholder:text-gray-600' : 'border-gray-200 bg-white'}`} />
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {CATEGORIES.map((entry) => <button key={entry.id} onClick={() => setCategory(entry.id)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs ${category === entry.id ? 'bg-violet-500 text-white' : darkMode ? 'bg-white/5 text-gray-400 hover:text-white' : 'bg-gray-100 text-gray-600'}`}>{l(entry.label)}</button>)}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} className={`min-w-0 rounded-xl border px-2.5 py-2 text-xs outline-none ${darkMode ? 'border-white/10 bg-[#10101d]' : 'border-gray-200 bg-white'}`}>
              <option value="all">{l('All sources')}</option>
              {REGISTRY_SOURCES.filter((entry) => entry.redistributionAllowed).map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
              {privateItems.length > 0 && <option value="private-session">{l('Private Session')}</option>}
            </select>
            <div className="flex rounded-xl border border-white/10 p-1">
              {(['all', 'component', 'block'] as const).map((kind) => <button key={kind} onClick={() => setKindFilter(kind)} className={`flex-1 rounded-lg px-1.5 py-1 text-[10px] capitalize ${kindFilter === kind ? 'bg-violet-500 text-white' : 'opacity-50 hover:opacity-100'}`}>{kind}</button>)}
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button onClick={() => setFavoritesOnly((value) => !value)} className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs ${favoritesOnly ? 'border-rose-400/30 bg-rose-500/10 text-rose-300' : darkMode ? 'border-white/10 text-gray-400' : 'border-gray-200 text-gray-600'}`}><Heart className={`h-3.5 w-3.5 ${favoritesOnly ? 'fill-current' : ''}`} /> {l('Favorites')} ({favoriteIds.size})</button>
            <button onClick={() => setAnimatedOnly((value) => !value)} className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs ${animatedOnly ? 'border-amber-400/30 bg-amber-500/10 text-amber-300' : darkMode ? 'border-white/10 text-gray-400' : 'border-gray-200 text-gray-600'}`}><Zap className={`h-3.5 w-3.5 ${animatedOnly ? 'fill-current' : ''}`} />{l('Animated only')}</button>
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] opacity-45"><span>{matches.length} {l('matches')}</span><span>{l('Showing')} {Math.min(visibleCount, matches.length)}</span></div>
          <div className="mt-2 max-h-[620px] space-y-2 overflow-y-auto pr-1">
            {visibleMatches.map((item) => (
              <button key={item.id} onClick={() => { setSelectedId(item.id); setTab('preview'); setActionError(null); }} className={`w-full rounded-xl border p-3 text-left transition ${selected?.id === item.id ? 'border-violet-400/40 bg-violet-500/10' : darkMode ? 'border-white/5 bg-black/10 hover:border-white/15' : 'border-gray-200 bg-white hover:border-violet-200'}`}>
                <div className="flex items-start gap-3"><div className="rounded-lg bg-violet-500/10 p-2 text-violet-400"><LayoutTemplate className="h-4 w-4" /></div><div className="min-w-0"><div className="flex items-center gap-2"><div className="truncate text-sm font-semibold">{item.name}</div>{item.remote && <span className="rounded-full bg-cyan-500/10 px-1.5 py-0.5 text-[9px] text-cyan-400">OSS</span>}<span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[9px] opacity-50">{item.kind || 'component'}</span></div><div className={`mt-1 line-clamp-2 text-xs leading-5 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{l(item.description)}</div><div className="mt-2 flex flex-wrap gap-1">{item.tags.slice(0, 3).map((tag) => <span key={tag} className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] opacity-60">{tag}</span>)}</div></div></div>
              </button>
            ))}
            {matches.length === 0 && !upstreamLoading && <div className="py-10 text-center text-sm opacity-50">{l('No matching components.')}</div>}
            {visibleMatches.length < matches.length && <button onClick={() => setVisibleCount((current) => Math.min(matches.length, current + 80))} className={`w-full rounded-xl border px-3 py-2.5 text-xs font-semibold ${darkMode ? 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>{l('Show 80 more')}</button>}
          </div>
        </section>

        {selected && (
          <section className={`min-w-0 rounded-2xl border ${panel}`}>
            <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div><div className="flex items-center gap-2"><h2 className="font-semibold">{selected.name}</h2>{selected.remote && <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-400">{l('Open source')}</span>}{selected.sourceId === 'private-session' && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">{l('Private session')}</span>}</div><p className={`mt-1 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{l(selected.description)}</p></div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => toggleFavorite(selected.id)} aria-label={favoriteIds.has(selected.id) ? l('Remove from favorites') : l('Add to favorites')} className={`inline-flex items-center justify-center rounded-xl border px-3 py-2 ${favoriteIds.has(selected.id) ? 'border-rose-400/30 bg-rose-500/10 text-rose-300' : darkMode ? 'border-white/10' : 'border-gray-200'}`}><Heart className={`h-4 w-4 ${favoriteIds.has(selected.id) ? 'fill-current' : ''}`} /></button>
                <button onClick={() => toggleKitItem(selected)} disabled={!kitIds.includes(selected.id) && kitIds.length >= MAX_KIT_ITEMS} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-40 ${kitIds.includes(selected.id) ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300' : darkMode ? 'border-white/10' : 'border-gray-200'}`}><Boxes className="h-4 w-4" /> {kitIds.includes(selected.id) ? l('Remove from kit') : l('Add to kit')}</button>
                <button disabled={codeLoadingId === selected.id || aiLoading} onClick={() => void onUseAI(selected)} className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-400 disabled:opacity-50">{codeLoadingId === selected.id || aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {l('AI Adapt')}</button>
                <button disabled={codeLoadingId === selected.id} onClick={() => void onCopyCode(selected)} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${darkMode ? 'border-white/10 hover:bg-white/5' : 'border-gray-200 hover:bg-gray-100'}`}>{codeLoadingId === selected.id ? <Loader2 className="h-4 w-4 animate-spin" /> : copied === 'code' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />} {l('Copy code')}</button>
              </div>
            </div>

            <div className="flex gap-1 border-b border-white/10 px-4 pt-3">
              {(['preview', 'code', 'ai', 'info'] as const).map((entry) => <button key={entry} onClick={() => setTab(entry)} className={`rounded-t-lg px-3 py-2 text-xs font-semibold capitalize ${tab === entry ? 'bg-violet-500/15 text-violet-300' : 'opacity-50 hover:opacity-100'}`}>{l(entry)}</button>)}
            </div>

            {actionError && <div className="mx-4 mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-300">{actionError}</div>}

            <div className="p-4 sm:p-5">
              {tab === 'preview' && <div>{livePreviewDoc ? <div className="overflow-hidden rounded-2xl border border-emerald-400/20 bg-black"><div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2 text-[10px]"><span className="text-emerald-300">{l('Isolated live preview')}</span><button onClick={() => { setLivePreviewDoc(null); setLivePreviewReason(null); }} className="opacity-60 hover:opacity-100">{l('Stop preview')}</button></div><iframe title={l('Live preview: {name}').replace('{name}', selected.name)} sandbox="allow-scripts" srcDoc={livePreviewDoc} className="h-[360px] w-full border-0 bg-[#090917]" /></div> : <Preview item={selected} />}<div className="mt-2 flex flex-wrap items-center gap-2"><p className="text-[11px] opacity-45">{livePreviewDoc ? l('Sandboxed iframe: no same-origin access, component network/storage APIs blocked by preflight/CSP.') : l('Safe schematic preview. Live execution never starts automatically.')}</p>{!livePreviewDoc && <button disabled={livePreviewLoading} onClick={() => void onRunLivePreview(selected)} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/20 bg-emerald-500/5 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-300 disabled:opacity-40">{livePreviewLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />} {l('Run isolated live preview')}</button>}</div>{livePreviewReason && <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 text-[10px] leading-4 text-amber-300">{livePreviewReason}</div>}<div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-white/10 p-3"><Boxes className="h-4 w-4 text-violet-400" /><div className="mt-2 text-xs font-semibold">{l('Category')}</div><div className="mt-1 text-xs opacity-50 capitalize">{selected.category}</div></div><div className="rounded-xl border border-white/10 p-3"><Package className="h-4 w-4 text-cyan-400" /><div className="mt-2 text-xs font-semibold">{l('Dependencies')}</div><div className="mt-1 text-xs opacity-50">{selectedRegistryResolution.npmDependencies.length ? selectedRegistryResolution.npmDependencies.join(', ') : l('None')}</div>{projectContext && selectedRegistryResolution.npmDependencies.length > 0 && <div className="mt-2 space-y-2"><div className={`text-[10px] ${missingDependencies.length ? 'text-amber-300' : 'text-emerald-400'}`}>{missingDependencies.length ? l('{count} missing in active project').replace('{count}', String(missingDependencies.length)) : l('All npm dependencies found')}</div>{installCommand && <button onClick={() => void copyText(installCommand)} className="inline-flex items-center gap-1 rounded-lg border border-amber-400/20 px-2 py-1 text-[10px] text-amber-300"><Copy className="h-3 w-3" /> Copy {projectContext.packageManager} install command</button>}</div>}</div><div className="rounded-xl border border-white/10 p-3"><Sparkles className="h-4 w-4 text-amber-400" /><div className="mt-2 text-xs font-semibold">{l('AI ready')}</div><div className="mt-1 text-xs opacity-50">{projectContext ? l('Project-aware adaptation context') : l('Source-aware adaptation payload')}</div></div></div>{similarItems.length > 0 && <div className="mt-3 rounded-xl border border-white/10 p-4"><div className="text-sm font-semibold">{l('Similar components')}</div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{similarItems.map((item) => <button key={item.id} onClick={() => { setSelectedId(item.id); setTab('preview'); setActionError(null); }} className={`rounded-lg border p-3 text-left transition ${darkMode ? 'border-white/10 bg-black/10 hover:border-violet-400/30' : 'border-gray-200 bg-white hover:border-violet-300'}`}><div className="truncate text-xs font-semibold">{item.name}</div><div className="mt-1 text-[10px] opacity-45">{getRegistrySource(item.sourceId)?.name || item.sourceId} · {item.kind || 'component'}</div></button>)}</div></div>}{projectContext && <div className="mt-3 rounded-xl border border-violet-400/15 bg-violet-500/5 p-4"><div className="flex items-center gap-2 text-sm font-semibold"><ArrowRightLeft className="h-4 w-4 text-violet-300" />{l('Find similar / Replace project component')}</div><p className="mt-2 text-[11px] leading-5 opacity-55">{l('Choose a complete project component file. Tayar suggests registry matches and can generate a one-file replacement patch only for that exact path.')}</p><select value={replaceTargetPath} onChange={(event) => { setReplaceTargetPath(event.target.value); setPatchPlan(null); setApplyConfirmed(false); }} className={`mt-3 w-full rounded-lg border px-3 py-2 text-xs outline-none ${darkMode ? 'border-white/10 bg-[#10101d]' : 'border-gray-200 bg-white'}`}><option value="">{l('Choose project component file…')}</option>{replaceTargets.map((target) => <option key={target.path} value={target.path}>{target.path}</option>)}</select>{replaceTarget && <div className="mt-3"><div className="text-[10px] uppercase tracking-wider opacity-40">{l('Suggested replacements')}</div>{suggestedReplacements.length ? <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{suggestedReplacements.map((item) => <button key={item.id} disabled={replaceLoading} onClick={() => void onPlanReplacement(item)} className={`rounded-lg border p-3 text-left transition disabled:opacity-40 ${darkMode ? 'border-white/10 bg-black/10 hover:border-violet-400/30' : 'border-gray-200 bg-white hover:border-violet-300'}`}><div className="truncate text-xs font-semibold">{item.name}</div><div className="mt-1 text-[10px] opacity-45">{item.category} · {getRegistrySource(item.sourceId)?.name || item.sourceId}</div><div className="mt-2 text-[10px] font-semibold text-violet-300">{replaceLoading ? l('Planning…') : l('Plan replacement')}</div></button>)}</div> : <div className="mt-2 text-[11px] opacity-45">{l('No strong registry match yet. Pick a registry component manually, then use the button below.')}</div>}<button disabled={replaceLoading} onClick={() => void onPlanReplacement(selected)} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-200 disabled:opacity-40">{replaceLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRightLeft className="h-3.5 w-3.5" />} {l('Replace with currently selected')}: {selected.name}</button></div>}</div>}{projectContext && <div className="mt-3 rounded-xl border border-cyan-500/15 bg-cyan-500/5 p-4"><div className="flex items-center gap-2 text-sm font-semibold"><FolderCog className="h-4 w-4 text-cyan-400" />{l('Active project compatibility')}</div><div className="mt-3 grid gap-2 sm:grid-cols-3"><div><div className="text-[10px] uppercase tracking-wider opacity-40">{l('Framework')}</div><div className="mt-1 text-xs">{projectContext.framework} · {projectContext.packageManager}</div></div><div className="sm:col-span-3"><div className="text-[10px] uppercase tracking-wider opacity-40">{l('Detected project style')}</div><div className="mt-2 flex flex-wrap gap-1.5">{projectStyleSummary.length ? projectStyleSummary.map((entry) => <span key={entry} className="rounded-full border border-cyan-400/15 bg-cyan-500/5 px-2 py-1 text-[10px] text-cyan-200/80">{entry}</span>) : <span className="text-[10px] opacity-45">{l('No strong style tokens detected yet.')}</span>}</div></div><div><div className="text-[10px] uppercase tracking-wider opacity-40">{l('Context files')}</div><div className="mt-1 text-xs">{projectContext.files.length}/{projectContext.totalCandidateFiles}{projectContext.truncated ? ` ${l('bounded')}` : ''}</div></div><div><div className="text-[10px] uppercase tracking-wider opacity-40">{l('Missing npm deps')}</div><div className={`mt-1 text-xs ${missingDependencies.length ? 'text-amber-300' : 'text-emerald-400'}`}>{missingDependencies.length ? missingDependencies.map((entry) => entry.name).join(', ') : l('None')}</div></div></div></div>}</div>}
              {tab === 'code' && (selectedCode
                ? <pre className="max-h-[520px] overflow-auto rounded-xl bg-black/40 p-4 text-xs leading-6 text-gray-300"><code>{selectedCode}</code></pre>
                : <div className="rounded-xl border border-white/10 p-6 text-center"><Code2 className="mx-auto h-8 w-8 text-violet-400" /><div className="mt-3 text-sm font-semibold">{l('Source code loads on demand')}</div><p className="mx-auto mt-2 max-w-md text-xs leading-5 opacity-50">{l('The component files and upstream MIT license are fetched only when needed. The license notice is prepended to copied source.')}</p><button disabled={codeLoadingId === selected.id} onClick={() => void ensureCode(selected)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{codeLoadingId === selected.id && <Loader2 className="h-4 w-4 animate-spin" />} {l('Load source code')}</button></div>
              )}
              {tab === 'ai' && <div className="space-y-4">
                <div className="rounded-xl border border-white/10 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-violet-400" />{l('AI adaptation')}</div>
                  <p className="mt-2 text-xs leading-5 opacity-55">{l('Describe the change you want. Tayar sends a bounded source excerpt plus dependency/license metadata and a bounded snapshot of the active project to the existing authenticated AI engine. The result is review-only and is never executed or applied automatically.')}</p>
                  <div className="mt-3">
                    <div className="flex items-center justify-between gap-3"><div className="text-[10px] font-semibold uppercase tracking-wider opacity-45">{l('Constraints')}</div>{projectContext && <span className="text-[10px] text-cyan-300">{l('Project style matching active')}</span>}</div>
                    <div className="mt-2 flex flex-wrap gap-2">{AI_CONSTRAINTS.map((constraint) => <button key={constraint.id} onClick={() => toggleConstraint(constraint.id)} className={`rounded-full border px-2.5 py-1.5 text-[10px] transition ${constraintIds.has(constraint.id) ? 'border-violet-400/30 bg-violet-500/10 text-violet-300' : darkMode ? 'border-white/10 text-gray-500 hover:text-gray-300' : 'border-gray-200 text-gray-500 hover:text-gray-700'}`}>{l(constraint.label)}</button>)}</div>
                  </div>
                  <textarea value={aiInstruction} onChange={(event) => setAiInstruction(event.target.value)} rows={4} maxLength={2000} placeholder={l("Example: Make this fit a dark SaaS dashboard, use our existing buttons, reduce motion on mobile, and keep it accessible.")} className={`mt-3 w-full resize-y rounded-xl border p-3 text-sm outline-none focus:border-violet-400/50 ${darkMode ? 'border-white/10 bg-black/20 placeholder:text-gray-600' : 'border-gray-200 bg-white'}`} />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button disabled={aiLoading || patchLoading || variantsLoading} onClick={() => void onGenerateVariants(selected)} className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold disabled:opacity-50 ${darkMode ? 'border-white/10 bg-white/[0.03]' : 'border-gray-200 bg-gray-50'}`}>{variantsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LayoutTemplate className="h-4 w-4" />} {l('Generate 3 options')}</button>
                    <button disabled={aiLoading || patchLoading || variantsLoading} onClick={() => void onUseAI(selected)} className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {l('Generate adaptation')}</button>
                    <button disabled={aiLoading || patchLoading || variantsLoading} onClick={() => void onPlanPatch(selected)} className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold disabled:opacity-50 ${darkMode ? 'border-violet-400/20 bg-violet-500/5' : 'border-violet-200 bg-violet-50'}`}>{patchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDiff className="h-4 w-4" />} {l('Plan file patch')}</button>
                    {aiResult && <button onClick={() => void copyText(aiResult).then(() => { setCopied('prompt'); window.setTimeout(() => setCopied(null), 1400); })} className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold ${darkMode ? 'border-white/10' : 'border-gray-200'}`}><Copy className="h-4 w-4" /> {copied === 'prompt' ? l('Copied') : l('Copy result')}</button>}
                  </div>
                </div>
                {aiMeta && <div className="flex flex-wrap gap-2 text-[10px] opacity-50"><span>{l('Model')}: {aiMeta.model}</span><span>{l('Input tokens')}: {aiMeta.tokensIn}</span><span>{l('Output tokens')}: {aiMeta.tokensOut}</span></div>}
                {variants.length > 0 && <div className="grid gap-3 lg:grid-cols-3">{variants.map((variant) => <div key={variant.id} className="rounded-xl border border-white/10 p-4"><div className="text-sm font-semibold">{variant.title}</div><p className="mt-2 text-xs leading-5 opacity-60">{variant.direction}</p>{variant.tradeoffs.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-4 text-[10px] leading-4 opacity-45">{variant.tradeoffs.map((tradeoff) => <li key={tradeoff}>{tradeoff}</li>)}</ul>}<button onClick={() => { setAiInstruction(variant.instruction); setPatchPlan(null); setAiResult(''); }} className="mt-3 rounded-lg bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-300 hover:bg-violet-500/20">{l('Use this direction')}</button></div>)}</div>}
                {patchPlan && <div className="space-y-3 rounded-xl border border-violet-400/15 bg-violet-500/5 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold"><FileDiff className="h-4 w-4 text-violet-400" />{l('Reviewable patch plan')}</div>
                  <p className="text-xs leading-5 opacity-65">{patchPlan.summary}</p>
                  {(patchPlan.dependenciesToInstall.length > 0 || patchPlan.registryDependencies.length > 0) && <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-white/10 p-3"><div className="text-[10px] uppercase tracking-wider opacity-40">{l('NPM to install')}</div><div className="mt-1 text-xs">{patchPlan.dependenciesToInstall.join(', ') || l('None')}</div></div>
                    <div className="rounded-lg border border-white/10 p-3"><div className="text-[10px] uppercase tracking-wider opacity-40">{l('Registry dependencies')}</div><div className="mt-1 text-xs">{patchPlan.registryDependencies.join(', ') || l('None')}</div></div>
                  </div>}
                  {featurePreview && <div className="rounded-xl border border-cyan-400/15 bg-cyan-500/5 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2 text-sm font-semibold"><Layers3 className="h-4 w-4 text-cyan-300" />{l('Feature Pack Preview')}</div><button onClick={onRunFeaturePreview} className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/20 px-2.5 py-1.5 text-[10px] font-semibold text-cyan-200"><Eye className="h-3 w-3" />{l('Preview primary file')}</button></div><div className="mt-3 grid gap-2 sm:grid-cols-4"><div className="rounded-lg border border-white/10 p-2"><div className="text-[9px] uppercase opacity-40">{l('Files')}</div><div className="mt-1 text-sm font-semibold">{featurePreview.files.length}</div></div><div className="rounded-lg border border-white/10 p-2"><div className="text-[9px] uppercase opacity-40">{l('Create')}</div><div className="mt-1 text-sm font-semibold">{featurePreview.creates}</div></div><div className="rounded-lg border border-white/10 p-2"><div className="text-[9px] uppercase opacity-40">{l('Replace')}</div><div className="mt-1 text-sm font-semibold">{featurePreview.replaces}</div></div><div className="rounded-lg border border-white/10 p-2"><div className="text-[9px] uppercase opacity-40">{l('Primary')}</div><div className="mt-1 truncate text-[10px] font-semibold">{featurePreview.primaryPath || l('Not detected')}</div></div></div>{featurePreview.routeHints.length > 0 && <div className="mt-3 flex flex-wrap gap-1">{featurePreview.routeHints.map((route) => <span key={route} className="rounded-full bg-white/5 px-2 py-1 text-[10px]">{route}</span>)}</div>}<div className="mt-3 grid gap-1.5 sm:grid-cols-2">{featurePreview.files.map((file) => <div key={file.path} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 px-2.5 py-2 text-[10px]"><span className="truncate">{file.path}</span><span className="shrink-0 opacity-45">{file.mode} · {file.role}</span></div>)}</div>{featurePreviewDoc && <iframe title={l("Feature primary isolated preview")} sandbox="allow-scripts" srcDoc={featurePreviewDoc} className="mt-3 h-[360px] w-full rounded-xl border border-white/10 bg-[#090917]" />}{featurePreviewReason && <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 text-[10px] leading-4 text-amber-300">{featurePreviewReason}</div>}</div>}
                  {controlledPackageEdit && patchPlan.dependenciesToInstall.length > 0 && <div className="rounded-xl border border-amber-400/15 bg-amber-500/5 p-4"><div className="flex items-center gap-2 text-sm font-semibold"><PackageCheck className="h-4 w-4 text-amber-300" />{l('Controlled Dependency Editor')}</div><p className="mt-2 text-[11px] leading-5 opacity-55">{l('AI cannot write package.json. Tayar proposes dependency additions deterministically and revalidates them against the current package.json during Apply.')}</p>{controlledPackageEdit.additions.length > 0 && <pre className="mt-3 overflow-auto rounded-lg bg-black/30 p-3 text-[11px] leading-5 text-emerald-300"><code>{controlledPackageEdit.preview}</code></pre>}{controlledPackageEdit.unresolved.length > 0 && <div className="mt-3 rounded-lg border border-amber-500/20 p-2 text-[10px] text-amber-300">{l('No explicit safe version/spec available for: {items}. These remain Apply blockers.').replace('{items}', controlledPackageEdit.unresolved.join(', '))}</div>}{controlledPackageEdit.warnings.length > 0 && <div className="mt-3 text-[10px] leading-4 text-amber-200/70">{controlledPackageEdit.warnings.join(' · ')}</div>}{patchInstallCommand && <button onClick={() => void copyText(patchInstallCommand)} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-400/20 px-2.5 py-1.5 text-[10px] text-amber-200"><Copy className="h-3 w-3" /> {l('Copy {manager} install command').replace('{manager}', projectContext?.packageManager || '')}</button>}{controlledPackageEdit.operation && <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs"><input type="checkbox" checked={packageEditConfirmed} onChange={(event) => setPackageEditConfirmed(event.target.checked)} className="mt-0.5" /><span>{l('Include this reviewed package.json dependency-only edit with the patch. No install command or lockfile write will run automatically.')}</span></label>}</div>}
                  {patchPlan.warnings.length > 0 && <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">{patchPlan.warnings.join(' · ')}</div>}
                  <div className="space-y-3">{patchPreviews.map(({ operation, existingContent, preview }) => <div key={operation.path} className="rounded-lg border border-white/10 overflow-hidden"><div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2"><div className="min-w-0"><div className="truncate text-xs font-semibold">{operation.path}</div><div className="mt-0.5 text-[10px] opacity-45">{operation.type} · {existingContent === null ? l('new file') : l('existing file')}{operation.reason ? ` · ${operation.reason}` : ''}</div></div><button onClick={() => void copyText(operation.content)} className="rounded-lg border border-white/10 p-2 opacity-60 hover:opacity-100" aria-label={l('Copy {path}').replace('{path}', operation.path)}><Copy className="h-3.5 w-3.5" /></button></div><pre className="max-h-72 overflow-auto whitespace-pre-wrap bg-black/30 p-3 text-[11px] leading-5 text-gray-300"><code>{preview}</code></pre></div>)}</div>
                  <p className="text-[10px] leading-4 opacity-45">{l('Safety gate: AI cannot delete files, edit environment/credential files, modify lockfiles, or write package.json. A separately reviewed deterministic dependency-only package.json edit may be included.')}</p>
                  {projectContext?.lastApply && projectContext.lastApply.fingerprintAfter === projectContext.fileStoreFingerprint && <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3"><div className="text-xs font-semibold text-amber-300">{l('Rollback checkpoint available')}</div><div className="mt-1 text-[10px] opacity-55">{projectContext.lastApply.summary}{projectContext.lastApply.appliedAt ? ` · ${new Date(projectContext.lastApply.appliedAt).toLocaleString()}` : ''}</div><button disabled={applyLoading} onClick={() => void onRollbackPatch()} className="mt-2 inline-flex items-center gap-2 rounded-lg border border-amber-400/20 px-3 py-1.5 text-xs text-amber-300 disabled:opacity-50">{applyLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} {l('Rollback last patch')}</button></div>}
                  <div className="rounded-lg border border-white/10 p-3">
                    {applyBlockers.length > 0 ? <div><div className="text-xs font-semibold text-amber-300">{l('Safe Apply blocked')}</div><ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] leading-5 opacity-65">{applyBlockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul></div> : <div>
                      <label className="flex cursor-pointer items-start gap-2 text-xs"><input type="checkbox" checked={applyConfirmed} onChange={(event) => setApplyConfirmed(event.target.checked)} className="mt-0.5" /><span>{l('I reviewed the file changes above and want to apply this patch to the active project.')}</span></label>
                      <button disabled={!applyConfirmed || applyLoading} onClick={() => void onApplyPatch(selected)} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-40">{applyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {l('Apply reviewed patch')}</button>
                    </div>}
                  </div>
                </div>}
                {aiResult ? <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-xl bg-black/40 p-4 text-xs leading-6 text-gray-300"><code>{aiResult}</code></pre> : !aiLoading && !patchLoading && !variantsLoading && !patchPlan && variants.length === 0 && <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-xs opacity-45">{l('No AI adaptation or patch plan generated yet.')}</div>}
              </div>}
              {tab === 'info' && <div className="space-y-4">{projectContext && <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/5 p-4"><div className="text-xs uppercase tracking-wider text-cyan-300/70">{l('Active project')}</div><div className="mt-2 font-semibold">{projectContext.title}</div><div className="mt-1 text-xs opacity-60">{projectContext.framework} · {Object.keys(projectContext.dependencies).length} dependencies · {projectContext.totalCandidateFiles} candidate files</div><p className="mt-2 text-[11px] leading-5 opacity-45">{l('Project context is read-only and bounded before it is used by AI. No project file is changed by this screen.')}</p></div>}<div className="rounded-xl border border-white/10 p-4"><div className="text-xs uppercase tracking-wider opacity-50">{l('Source')}</div><div className="mt-2 font-semibold">{source?.name || selected.sourceId}</div><div className="mt-1 text-xs opacity-60">{source?.repository || source?.homepageUrl || selected.sourceId}{selected.remote?.revision ? ` @ ${selected.remote.revision.slice(0, 8)}` : ''}{selected.sourcePath ? ` · ${selected.sourcePath}` : ''}</div></div><div className="rounded-xl border border-white/10 p-4"><div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-emerald-400" />{l('License gate')}</div><p className="mt-2 text-xs leading-5 opacity-60">{selected.sourceId === 'private-session' ? l('Private user-provided source. Tayar does not redistribute or persist it; use is limited to the current session and the rights you confirmed.') : source?.redistributionAllowed ? l('Approved: {license}. Upstream license notice is preserved when code is loaded or copied.').replace('{license}', source.license) : l('This source is blocked from redistribution.')}</p></div>{selected.registryStyles && <div className="rounded-xl border border-white/10 p-4"><div className="text-sm font-semibold">{l('Registry styles')}</div><p className="mt-2 text-xs leading-5 opacity-60">{l('This component includes upstream CSS/CSS variables. Tayar carries the style metadata into AI adaptation and patch planning instead of silently dropping it.')}</p></div>}{selected.remote?.registryDependencies.length ? <div className="rounded-xl border border-white/10 p-4"><div className="text-sm font-semibold">{l('Registry dependencies')}</div><p className="mt-2 text-xs leading-5 opacity-60">{selected.remote.registryDependencies.join(', ')}</p><div className="mt-2 flex flex-wrap gap-1">{selectedRegistryResolution.resolved.map((entry) => <span key={entry.id} className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">{entry.name}</span>)}{selectedRegistryResolution.unresolved.map((entry) => <span key={entry} className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">{l('Unresolved')}: {entry}</span>)}</div></div> : null}<div className="rounded-xl border border-white/10 p-4"><div className="text-sm font-semibold">{l('AI adaptation instruction')}</div><p className="mt-2 text-xs leading-5 opacity-60">{selected.aiPrompt}</p></div></div>}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
