$ErrorActionPreference = 'Stop'

$builder = 'src/modules/website-builder/WebsiteBuilderTool.tsx'
$prompts = 'src/lib/ai/prompts.ts'
$types = 'src/lib/ai/types.ts'

function Read-Utf8($path) { return [System.IO.File]::ReadAllText((Join-Path (Get-Location) $path), [System.Text.Encoding]::UTF8) }
function Write-Utf8($path, $text) { [System.IO.File]::WriteAllText((Join-Path (Get-Location) $path), $text, (New-Object System.Text.UTF8Encoding($false))) }

# 1) Add the website-builder AI tool to the shared AI prompt registry.
$p = Read-Utf8 $prompts
$p = $p.Replace("  | 'document-ai' | 'study-assistant' | 'translator' | 'ai-chat';", "  | 'document-ai' | 'study-assistant' | 'translator' | 'ai-chat' | 'website-builder';")
if ($p -notmatch "'website-builder':") {
  $needle = "  'ai-chat': {"
  $block = @'
  'website-builder': {
    system: `You are an expert website designer and conversion-focused web copywriter for Tayar Intelligence Tools.
Generate a complete website specification from the user's description.
Return ONLY valid JSON. Do not use markdown fences or commentary.
The JSON must have this exact shape:
{
  "siteName": "string",
  "sections": [
    {
      "type": "hero|features|about|services|pricing|testimonials|contact|footer",
      "title": "string",
      "description": "string",
      "buttonText": "string",
      "buttonUrl": "string",
      "background": "#RRGGBB",
      "accent": "#RRGGBB"
    }
  ]
}
Use 5-8 sections, keep the content specific to the user's business, and use valid 6-digit hex colors.
A typical strong site includes hero, features/services, about, social proof, contact, and footer.
For pricing, use sensible generic plan copy and prices only when pricing makes sense for the request.`,
    user: (input) => `Create the website specification for this request:\n${input.prompt || ''}\n\nReturn ONLY the JSON object.`,
  },

'@
  $p = $p.Replace($needle, $block + "  'ai-chat': {")
}
Write-Utf8 $prompts $p

# 2) Register a default model for the new tool.
$t = Read-Utf8 $types
$t = $t.Replace("  'ai-chat': 'gemini-3.6-flash',", "  'ai-chat': 'gemini-3.6-flash',`r`n  'website-builder': 'gemini-3.6-flash',")
Write-Utf8 $types $t

# 3) Upgrade the Website Builder UI and connect it to the existing AI engine.
$b = Read-Utf8 $builder

if ($b -notmatch "createAIService") {
  $b = $b.Replace("import { useEffect, useMemo, useState } from 'react';", "import { useEffect, useMemo, useState } from 'react';`r`nimport { createAIService } from '@/lib/ai/service';")
}

if ($b -notmatch "interface AIWebsiteGeneration") {
  $needle = "type Device = 'desktop' | 'mobile';"
  $insert = @'
type Device = 'desktop' | 'mobile';

type AIWebsiteGeneration = {
  siteName: string;
  sections: Array<{
    type: SectionType;
    title: string;
    description: string;
    buttonText?: string;
    buttonUrl?: string;
    background?: string;
    accent?: string;
  }>;
};
'@
  $b = $b.Replace($needle, $insert.TrimEnd())
}

if ($b -notmatch "aiPrompt") {
  $needle = "  const [siteName, setSiteName] = useState('My Website');"
  $insert = @'
  const [siteName, setSiteName] = useState('My Website');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
'@
  $b = $b.Replace($needle, $insert.TrimEnd())
}

if ($b -notmatch "async function generateWithAI") {
  $needle = "  function saveProject() {"
  $insert = @'
  async function generateWithAI() {
    const prompt = aiPrompt.trim();
    if (!prompt || aiBusy) return;

    setAiBusy(true);
    setAiError('');

    try {
      const ai = createAIService('website-builder');
      const response = await ai.completeJSON<AIWebsiteGeneration>(
        { action: 'generate', prompt },
        [],
        { temperature: 0.7, maxTokens: 5000 },
      );

      let generated = response.json;
      if (!generated && response.content) {
        const cleaned = response.content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        generated = JSON.parse(cleaned) as AIWebsiteGeneration;
      }

      if (!generated || !Array.isArray(generated.sections) || generated.sections.length === 0) {
        throw new Error('AI returned an invalid website. Please try a more specific description.');
      }

      const allowedTypes = new Set<SectionType>([
        'hero', 'features', 'about', 'services', 'pricing', 'testimonials', 'contact', 'footer',
      ]);

      const normalized = generated.sections
        .filter((section) => allowedTypes.has(section.type))
        .map((section, index) => ({
          id: `${section.type}-ai-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
          type: section.type,
          title: section.title?.trim() || SECTION_LABELS[section.type],
          description: section.description?.trim() || '',
          buttonText: section.type === 'footer' ? '' : (section.buttonText?.trim() || 'Learn More'),
          buttonUrl: section.type === 'footer' ? '' : (section.buttonUrl?.trim() || '#contact'),
          background: /^#[0-9a-fA-F]{6}$/.test(section.background || '') ? section.background! : '#0f172a',
          accent: /^#[0-9a-fA-F]{6}$/.test(section.accent || '') ? section.accent! : '#7c3aed',
        }));

      if (normalized.length === 0) {
        throw new Error('AI did not return usable sections. Please try again.');
      }

      setSections(normalized);
      setSelectedId(normalized[0].id);
      setSiteName(generated.siteName?.trim() || 'My Website');
      setSaved(false);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'AI generation failed.');
    } finally {
      setAiBusy(false);
    }
  }

  function saveProject() {
'@
  $b = $b.Replace($needle, $insert.TrimEnd())
}

$oldPanel = @'
          <div
            className={`mt-6 rounded-xl border p-3 ${
              darkMode
                ? 'border-violet-500/20 bg-violet-500/5'
                : 'border-violet-100 bg-violet-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-400" />
              <span className="text-xs font-semibold">AI Builder</span>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
              AI generation will be connected after the visual builder is complete.
            </p>
          </div>
'@

$newPanel = @'
          <div
            className={`mt-6 rounded-xl border p-3 ${
              darkMode
                ? 'border-violet-500/20 bg-violet-500/5'
                : 'border-violet-100 bg-violet-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-400" />
              <span className="text-xs font-semibold">AI Website Builder</span>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
              Describe the website you want and AI will replace the current canvas with a complete design.
            </p>
            <textarea
              value={aiPrompt}
              onChange={(e) => {
                setAiPrompt(e.target.value);
                setAiError('');
              }}
              rows={4}
              placeholder="Example: Modern Italian restaurant in Stockholm with online booking, menu, testimonials and warm luxury colors..."
              className={`mt-3 w-full resize-none rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${
                darkMode
                  ? 'border-white/10 bg-white/5 text-white placeholder:text-gray-600'
                  : 'border-gray-200 bg-white text-gray-900 placeholder:text-gray-400'
              }`}
            />
            <button
              onClick={generateWithAI}
              disabled={!aiPrompt.trim() || aiBusy}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {aiBusy ? 'Generating...' : 'Generate Website'}
            </button>
            {aiError && (
              <p className="mt-2 text-[11px] leading-relaxed text-red-400">{aiError}</p>
            )}
          </div>
'@

if ($b.Contains($oldPanel)) {
  $b = $b.Replace($oldPanel, $newPanel)
} elseif ($b -notmatch "AI Website Builder") {
  throw "Could not find the existing AI Builder panel in $builder"
}

Write-Utf8 $builder $b

Write-Host "Website Builder AI upgrade applied." -ForegroundColor Green
