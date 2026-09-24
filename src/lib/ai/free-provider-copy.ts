import type { FreeLLMProviderKey } from './free-provider-registry';

export type FreeLLMLanguage = 'en' | 'ar' | 'sv';

export const FREE_LLM_PROVIDER_COPY: Record<FreeLLMLanguage, Record<FreeLLMProviderKey, { description: string; notes: Record<string, string> }>> = {
  en: {
    gemini: { description: 'Tayar native Gemini adapter with the existing production fallback path.', notes: { 'gemini-3.6-flash': '15 RPM / 1,500 RPD listed by the catalog snapshot.', 'gemini-3.5-flash': '15 RPM / 1,500 RPD listed by the catalog snapshot.' } },
    groq: { description: 'Fast OpenAI-compatible inference with a no-card free tier.', notes: { 'groq/compound': '30 RPM / 250 RPD listed by the catalog snapshot.' } },
    nvidia: { description: 'Large free model catalog behind an OpenAI-compatible endpoint.', notes: { 'z-ai/glm-5.2': 'Up to 40 RPM listed by the catalog snapshot.' } },
    openrouter: { description: 'OpenAI-compatible router with many :free models; quotas can depend on account status.', notes: {} },
    mistral: { description: 'OpenAI-compatible Mistral endpoint with free-tier models.', notes: {} },
    cerebras: { description: 'Low-latency OpenAI-compatible inference with a free tier.', notes: { 'zai-glm-4.7': '10 RPM / 100 RPD / 1M TPD listed by the catalog snapshot.' } },
    cloudflare: { description: "Workers AI through Cloudflare's OpenAI-compatible Chat Completions endpoint.", notes: { '@cf/meta/llama-3.3-70b-instruct-fp8-fast': 'Workers AI quotas are shared by account.' } },
  },
  ar: {
    gemini: { description: 'موصل Gemini الأصلي في Tayar مع مسار الاحتياط الإنتاجي الحالي.', notes: { 'gemini-3.6-flash': 'تُظهر لقطة الدليل حدًا قدره 15 طلبًا بالدقيقة و1,500 طلب باليوم.', 'gemini-3.5-flash': 'تُظهر لقطة الدليل حدًا قدره 15 طلبًا بالدقيقة و1,500 طلب باليوم.' } },
    groq: { description: 'استدلال سريع متوافق مع OpenAI ضمن خطة مجانية لا تتطلب بطاقة.', notes: { 'groq/compound': 'تُظهر لقطة الدليل حدًا قدره 30 طلبًا بالدقيقة و250 طلبًا باليوم.' } },
    nvidia: { description: 'مجموعة كبيرة من النماذج المجانية عبر نقطة API متوافقة مع OpenAI.', notes: { 'z-ai/glm-5.2': 'تُظهر لقطة الدليل حدًا يصل إلى 40 طلبًا بالدقيقة.' } },
    openrouter: { description: 'موجّه متوافق مع OpenAI يضم العديد من نماذج :free؛ وقد تعتمد الحصص على حالة الحساب.', notes: {} },
    mistral: { description: 'نقطة Mistral متوافقة مع OpenAI وتوفر نماذج ضمن الخطة المجانية.', notes: {} },
    cerebras: { description: 'استدلال منخفض التأخير ومتوافق مع OpenAI ضمن خطة مجانية.', notes: { 'zai-glm-4.7': 'تُظهر لقطة الدليل 10 طلبات بالدقيقة و100 طلب باليوم ومليون token باليوم.' } },
    cloudflare: { description: 'Workers AI عبر نقطة Chat Completions من Cloudflare المتوافقة مع OpenAI.', notes: { '@cf/meta/llama-3.3-70b-instruct-fp8-fast': 'حصص Workers AI مشتركة على مستوى الحساب.' } },
  },
  sv: {
    gemini: { description: 'Tayars inbyggda Gemini-adapter med den befintliga reservvägen för produktion.', notes: { 'gemini-3.6-flash': 'Katalogsnapshoten anger 15 förfrågningar/minut och 1 500 förfrågningar/dag.', 'gemini-3.5-flash': 'Katalogsnapshoten anger 15 förfrågningar/minut och 1 500 förfrågningar/dag.' } },
    groq: { description: 'Snabb OpenAI-kompatibel inferens med en gratisnivå utan kortkrav.', notes: { 'groq/compound': 'Katalogsnapshoten anger 30 förfrågningar/minut och 250 förfrågningar/dag.' } },
    nvidia: { description: 'Stor katalog med kostnadsfria modeller via en OpenAI-kompatibel API-adress.', notes: { 'z-ai/glm-5.2': 'Katalogsnapshoten anger upp till 40 förfrågningar/minut.' } },
    openrouter: { description: 'OpenAI-kompatibel router med många :free-modeller; kvoter kan bero på kontots status.', notes: {} },
    mistral: { description: 'OpenAI-kompatibel Mistral-adress med modeller på gratisnivå.', notes: {} },
    cerebras: { description: 'OpenAI-kompatibel inferens med låg latens och en gratisnivå.', notes: { 'zai-glm-4.7': 'Katalogsnapshoten anger 10 förfrågningar/minut, 100 förfrågningar/dag och 1 miljon token/dag.' } },
    cloudflare: { description: 'Workers AI via Cloudflares OpenAI-kompatibla Chat Completions-adress.', notes: { '@cf/meta/llama-3.3-70b-instruct-fp8-fast': 'Workers AI-kvoter delas på kontonivå.' } },
  },
};

export function freeLLMProviderDescription(language: FreeLLMLanguage, providerKey: FreeLLMProviderKey): string {
  return FREE_LLM_PROVIDER_COPY[language][providerKey].description;
}

export function freeLLMModelNote(language: FreeLLMLanguage, providerKey: FreeLLMProviderKey, modelId: string): string {
  return FREE_LLM_PROVIDER_COPY[language][providerKey].notes[modelId] || '';
}
