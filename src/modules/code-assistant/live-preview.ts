import type { UIComponentRecord } from './types';

export interface LivePreviewResult {
  supported: boolean;
  reason?: string;
  srcDoc?: string;
}

const MAX_SOURCE_CHARS = 45_000;
const BLOCKED_RUNTIME = /\b(?:eval|Function|fetch|XMLHttpRequest|WebSocket|EventSource|Worker|SharedWorker|localStorage|sessionStorage|indexedDB)\b|document\.cookie|window\.(?:parent|top|opener)|\bpostMessage\s*\(|\bsetInterval\s*\(|while\s*\(\s*true\s*\)|for\s*\(\s*;\s*;\s*\)/;
const NON_REACT_IMPORT = /(?:^|\n)\s*import\s+[\s\S]*?\sfrom\s*['"](?!react['"])([^'"]+)['"]\s*;?|(?:^|\n)\s*import\s*['"](?!react['"])([^'"]+)['"]\s*;?/m;

function escapeScriptJson(value: string): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

function extractComponentName(source: string): string | null {
  const patterns = [
    /export\s+default\s+function\s+([A-Za-z_$][\w$]*)/,
    /export\s+function\s+([A-Za-z_$][\w$]*)/,
    /export\s+const\s+([A-Za-z_$][\w$]*)\s*=/,
    /function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/,
    /const\s+([A-Za-z_$][\w$]*)\s*=\s*\([^)]*\)\s*=>/,
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function sanitizeSource(source: string): string {
  return source
    .replace(/^\s*['"]use client['"];?\s*$/gm, '')
    .replace(/^\s*import\s+[\s\S]*?\sfrom\s*['"]react['"]\s*;?\s*$/gm, '')
    .replace(/^\s*import\s*['"]react['"]\s*;?\s*$/gm, '')
    .replace(/export\s+default\s+function\s+/g, 'function ')
    .replace(/export\s+function\s+/g, 'function ')
    .replace(/export\s+const\s+/g, 'const ')
    .replace(/export\s+default\s+([A-Za-z_$][\w$]*)\s*;?/g, '')
    .replace(/^\s*export\s*\{[^}]*\}\s*;?\s*$/gm, '');
}

function styleText(item: UIComponentRecord): string {
  const css = item.registryStyles?.css;
  if (typeof css === 'string') return css.slice(0, 60_000);
  return '';
}

export function buildIsolatedLivePreview(item: UIComponentRecord, rawSource: string): LivePreviewResult {
  const source = rawSource.trim();
  if (!source) return { supported: false, reason: 'Source code is not loaded yet.' };
  if (source.length > MAX_SOURCE_CHARS) return { supported: false, reason: 'Source is too large for the isolated browser preview.' };
  if (item.dependencies.length) {
    return { supported: false, reason: `Live preview currently supports self-contained React components only. Required packages: ${item.dependencies.join(', ')}` };
  }
  if (item.remote?.registryDependencies.length) {
    return { supported: false, reason: 'This component requires registry dependencies; use the safe schematic preview or AI adaptation first.' };
  }
  if (item.remote && item.remote.files.length > 1) {
    return { supported: false, reason: 'This registry item spans multiple source files; isolated preview is disabled until it is adapted into one project-aware result.' };
  }
  if (NON_REACT_IMPORT.test(source)) {
    return { supported: false, reason: 'The component imports a module other than React, so isolated preview is disabled.' };
  }
  if (BLOCKED_RUNTIME.test(source)) {
    return { supported: false, reason: 'The source contains browser/network/storage/runtime APIs that are blocked in isolated preview.' };
  }

  const componentName = extractComponentName(source);
  if (!componentName) return { supported: false, reason: 'Tayar could not identify a renderable exported React component.' };

  const cleaned = sanitizeSource(source);
  const css = styleText(item);
  const payload = escapeScriptJson(cleaned);
  const cssPayload = escapeScriptJson(css);
  const namePayload = escapeScriptJson(componentName);

  const srcDoc = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' https://unpkg.com https://cdn.tailwindcss.com; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; media-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none';" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
html,body,#root{min-height:100%;margin:0}body{font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:#090917;color:#fff;padding:20px;box-sizing:border-box}
*{box-sizing:border-box}#error{white-space:pre-wrap;color:#fecaca;background:#450a0a;border:1px solid #7f1d1d;border-radius:12px;padding:12px;font:12px/1.5 ui-monospace,monospace;display:none}
</style>
<script src="https://cdn.tailwindcss.com"></script>
<script crossorigin src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone@7.25.6/babel.min.js"></script>
</head>
<body>
<div id="root"></div><pre id="error"></pre>
<script>
(function(){
  const showError=(error)=>{const el=document.getElementById('error');el.style.display='block';el.textContent=String(error&&error.stack||error);};
  window.addEventListener('error',(event)=>showError(event.error||event.message));
  window.addEventListener('unhandledrejection',(event)=>showError(event.reason));
  try {
    const source=${payload};
    const extraCss=${cssPayload};
    const componentName=${namePayload};
    if(extraCss){const style=document.createElement('style');style.textContent=extraCss;document.head.appendChild(style);}
    const hooks='const {useState,useEffect,useMemo,useRef,useCallback,useLayoutEffect,useId,useReducer,useContext,Fragment}=React;\\n';
    const transformed=Babel.transform(hooks+source+'\\n;globalThis.__TAYAR_COMPONENT__='+componentName+';',{
      presets:[['typescript',{isTSX:true,allExtensions:true}],['react',{runtime:'classic'}]],
      filename:'component.tsx',
      sourceType:'script'
    }).code;
    const execution=document.createElement('script');
    execution.type='text/javascript';
    execution.textContent=transformed;
    document.body.appendChild(execution);
    execution.remove();
    const Component=globalThis.__TAYAR_COMPONENT__;
    if(typeof Component!=='function') throw new Error('Preview component is not renderable.');
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Component));
  } catch(error){ showError(error); }
})();
</script>
</body>
</html>`;

  return { supported: true, srcDoc };
}
