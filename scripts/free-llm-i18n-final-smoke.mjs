import fs from 'node:fs';
const ui=fs.readFileSync('src/components/admin/AdminFreeLLMCatalog.tsx','utf8');
const copy=fs.readFileSync('src/lib/ai/free-provider-copy.ts','utf8');
const validation=fs.readFileSync('src/lib/ai/free-provider-validation.ts','utf8');
for(const lang of ['en:','ar:','sv:']){if(!ui.includes(lang))throw new Error(`UI copy language missing: ${lang}`);if(!copy.includes(lang))throw new Error(`Provider copy language missing: ${lang}`);}
for(const marker of ['freeLLMProviderDescription(language,provider.key)','freeLLMModelNote(language,provider.key,selectedModel)','resolveLocalizedFreeLLMProviderBaseUrl','{c.sourceLink}','{c.refresh}','{c.baseUrl}','c.testOk:c.testFailed'])if(!ui.includes(marker))throw new Error(`Localized UI wiring missing: ${marker}`);
for(const raw of ['>source <','/>Refresh</','>Base URL<',"?'OK':'Failed'"])if(ui.includes(raw))throw new Error(`Hardcoded visible English remains: ${raw}`);
for(const lang of ['en:','ar:','sv:'])if(!validation.includes(lang))throw new Error(`Validation language missing: ${lang}`);
console.log('free LLM final i18n audit: OK (AR/SV/EN)');
