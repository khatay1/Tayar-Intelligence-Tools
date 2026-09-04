import { useRef, useState } from 'react';
import { Code2, FolderUp, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { usePreferences } from '@/context/PreferencesContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';

const DIRECTORY_INPUT_PROPS = { webkitdirectory: '', directory: '' } as const;
const MAX_FILES = 600;
const MAX_FILE_CHARS = 400_000;
const MAX_TOTAL_CHARS = 4_000_000;
const SAFE_EXTENSION = /\.(?:[cm]?[jt]sx?|css|scss|sass|less|html?|json|mdx?|yaml|yml|toml|txt)$/i;
const BLOCKED_SEGMENT = new Set(['.git', 'node_modules', '.next', 'dist', 'build', 'coverage', '.vercel', '.supabase']);
const BLOCKED_NAME = /(?:^|\/)(?:\.env(?:\.|$)|.*secret.*|.*credential.*)/i;

const copy = {
  en: {
    codeProject: 'Code Project',
    heading: 'Import a real project for Safe Apply',
    description: 'Choose your source folder. Tayar keeps supported source files in My Files so Coding Assistance can review diffs, apply AI patches safely, and rollback changes.',
    safety: 'Secrets, .env files, node_modules, build output, and unsupported binaries are skipped automatically.',
    importing: 'Importing…',
    importFolder: 'Import Code Folder',
    folderLimit: 'Select a source folder with {{max}} files or fewer.',
    noSupported: 'No supported source files were found in this folder.',
    createFailed: 'Could not create the code project.',
    filesImported: 'source files imported',
    skipped: 'skipped',
    imported: 'Code project imported. Opening Coding Assistance…',
    importFailed: 'Could not import this code folder.',
  },
  ar: {
    codeProject: 'مشروع كود',
    heading: 'استورد مشروعًا حقيقيًا لاستخدام Safe Apply',
    description: 'اختر مجلد المشروع. يحتفظ Tayar بملفات المصدر المدعومة داخل ملفاتي حتى يتمكن Coding Assistance من مراجعة الفروقات وتطبيق تعديلات AI بأمان والتراجع عنها.',
    safety: 'يتم تجاهل الأسرار وملفات .env وnode_modules وملفات البناء والملفات الثنائية غير المدعومة تلقائيًا.',
    importing: 'جارٍ الاستيراد…',
    importFolder: 'استيراد مجلد الكود',
    folderLimit: 'اختر مجلد مصدر يحتوي على {{max}} ملف أو أقل.',
    noSupported: 'لم يتم العثور على ملفات مصدر مدعومة داخل هذا المجلد.',
    createFailed: 'تعذر إنشاء مشروع الكود.',
    filesImported: 'ملف مصدر تم استيراده',
    skipped: 'تم تجاهله',
    imported: 'تم استيراد مشروع الكود. جارٍ فتح Coding Assistance…',
    importFailed: 'تعذر استيراد مجلد الكود.',
  },
  sv: {
    codeProject: 'Kodprojekt',
    heading: 'Importera ett riktigt projekt för Safe Apply',
    description: 'Välj din projektmapp. Tayar sparar de stödda källfilerna i Mina filer så att Coding Assistance kan granska diffar, tillämpa AI-ändringar säkert och återställa dem.',
    safety: 'Hemligheter, .env-filer, node_modules, byggfiler och binära filer som inte stöds hoppas över automatiskt.',
    importing: 'Importerar…',
    importFolder: 'Importera kodmapp',
    folderLimit: 'Välj en källmapp med högst {{max}} filer.',
    noSupported: 'Inga källfiler som stöds hittades i den här mappen.',
    createFailed: 'Det gick inte att skapa kodprojektet.',
    filesImported: 'källfiler importerade',
    skipped: 'överhoppade',
    imported: 'Kodprojektet importerades. Coding Assistance öppnas…',
    importFailed: 'Det gick inte att importera kodmappen.',
  },
} as const;

type CopyKey = keyof typeof copy.en;

interface CodeProjectImportCardProps {
  onImported: (projectId: string) => void;
}

function rawFilePath(file: File): string {
  return (file.webkitRelativePath || file.name || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function stripCommonRoot(paths: string[]): { rootName: string; stripRoot: boolean } {
  const firstSegments = paths
    .filter(Boolean)
    .map((path) => path.split('/')[0])
    .filter(Boolean);
  const first = firstSegments[0] || 'Code Project';
  return {
    rootName: first,
    stripRoot: firstSegments.length > 0 && firstSegments.every((segment) => segment === first) && paths.some((path) => path.includes('/')),
  };
}

function normalizeProjectPath(raw: string, rootName: string, stripRoot: boolean): string | null {
  const normalized = raw.replace(/\\/g, '/').replace(/^\.\//, '');
  const path = stripRoot && normalized.startsWith(`${rootName}/`)
    ? normalized.slice(rootName.length + 1)
    : normalized;
  if (!path || path.length > 260 || path.startsWith('/')) return null;
  const parts = path.split('/');
  if (!parts.every((part) => part && part !== '.' && part !== '..' && !BLOCKED_SEGMENT.has(part))) return null;
  if (BLOCKED_NAME.test(path)) return null;
  if (path !== 'package.json' && !SAFE_EXTENSION.test(path)) return null;
  return path;
}

export default function CodeProjectImportCard({ onImported }: CodeProjectImportCardProps) {
  const { prefs } = usePreferences();
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);
  const [detail, setDetail] = useState('');
  const language = prefs.language in copy ? prefs.language : 'en';
  const t = (key: CopyKey) => copy[language][key];

  async function importFolder(files: FileList | null) {
    if (!user || !files?.length || importing) return;
    const selected = Array.from(files);
    if (selected.length > MAX_FILES) {
      showError(t('folderLimit').replace('{{max}}', String(MAX_FILES)));
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    setImporting(true);
    setDetail('');

    try {
      const rawPaths = selected.map(rawFilePath);
      const { rootName, stripRoot } = stripCommonRoot(rawPaths);
      const fileStore: Record<string, string> = {};
      let totalChars = 0;
      let skipped = 0;

      for (let index = 0; index < selected.length; index += 1) {
        const file = selected[index];
        const path = normalizeProjectPath(rawPaths[index], rootName, stripRoot);
        if (!path || file.size > MAX_FILE_CHARS) {
          skipped += 1;
          continue;
        }

        const text = await file.text();
        if (text.length > MAX_FILE_CHARS || totalChars + text.length > MAX_TOTAL_CHARS) {
          skipped += 1;
          continue;
        }

        totalChars += text.length;
        fileStore[path] = text;
      }

      const importedCount = Object.keys(fileStore).length;
      if (!importedCount) {
        throw new Error(t('noSupported'));
      }

      const now = new Date().toISOString();
      const title = (rootName || t('codeProject')).slice(0, 120);
      const { data, error } = await supabase
        .from('projects')
        .insert({
          user_id: user.id,
          title,
          type: 'code-assistant',
          status: 'draft',
          content: {
            version: 1,
            files: fileStore,
            _tayarCodeImport: {
              source: 'folder',
              importedAt: now,
              importedCount,
              skippedCount: skipped,
            },
          },
        })
        .select('id')
        .single();

      if (error || !data?.id) {
        throw new Error(error?.message || t('createFailed'));
      }

      setDetail(`${importedCount} ${t('filesImported')}${skipped ? ` · ${skipped} ${t('skipped')}` : ''}`);
      success(t('imported'));
      onImported(String(data.id));
    } catch (error) {
      showError(error instanceof Error ? error.message : t('importFailed'));
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.06] p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-violet-300">
            <Code2 className="h-4 w-4" />
            {t('codeProject')}
          </div>
          <h2 className="mt-1 text-lg font-bold text-white">{t('heading')}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-400">
            {t('description')}
          </p>
          <p className="mt-2 text-xs text-gray-500">
            {t('safety')}
          </p>
          {detail && <p className="mt-2 text-xs font-medium text-emerald-400">{detail}</p>}
        </div>

        <div className="shrink-0">
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            {...DIRECTORY_INPUT_PROPS}
            onChange={(event) => void importFolder(event.target.files)}
          />
          <button
            type="button"
            disabled={!user || importing}
            onClick={() => inputRef.current?.click()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderUp className="h-4 w-4" />}
            {importing ? t('importing') : t('importFolder')}
          </button>
        </div>
      </div>
    </div>
  );
}
