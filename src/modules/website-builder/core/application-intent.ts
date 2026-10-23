const normalizeIntentText = (prompt: string) => prompt.normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g, '').trim();
const presentationRequestPattern = /\b(?:landing[ -]?page|brochure(?:[ -]?(?:page|site|website))?|marketing[ -]?(?:page|site|website)|(?:informational|showcase)[ -]?(?:site|website|page)|(?:website|site|page)\s+(?:describing|explaining|about|showcasing))\b|(?:صفحة\s+(?:هبوط|تعريفية|تسويقية)|موقع\s+(?:تعريفي|تسويقي))/iu;

/** A negated presentation requirement ("without a landing page") is not a request to create one. */
function hasPresentationDeliverable(text: string): boolean {
  const positive = text.replace(/\b(?:without|excluding|except|no|not)\s+(?:(?:a|an|the)\s+)?(?:landing[ -]?page|brochure|marketing[ -]?(?:page|site|website))\b|(?:بدون|من\s+دون)\s+(?:صفحة\s+(?:هبوط|تعريفية|تسويقية)|موقع\s+(?:تعريفي|تسويقي))/giu, '');
  return presentationRequestPattern.test(positive) || /\b(?:static\s+)?showcase\s+(?:of|for|about)\b/iu.test(positive);
}

/** Detect explicit requests for working applications rather than presentation-only sites.
 * This is a conservative intent guard, not a domain/template selection mechanism. */
export function explicitlyRequestsApplication(prompt: string): boolean {
  const text = normalizeIntentText(prompt);
  if (!text) return false;

  // "A landing page for my app" requests a page, not the app itself.
  const presentationOnly = hasPresentationDeliverable(text);
  const additionalAppRequest = /\b(?:also\s+(?:build|create|develop)|plus\s+(?:build|create|develop))\b|(?:بالإضافة\s+(?:إلى|الى)\s+(?:تطبيق|منصة|نظام)|(?:مع|وبنفس\s+الوقت)\s+(?:تطبيق|منصة|نظام)\s+(?:لإدارة|ادارة|عقارات|متكامل))/iu.test(text);
  // A single prompt can ask for BOTH an informational site and working software.
  // Check explicit second deliverables, not incidental mentions such as
  // "a landing page for my CRM". In that case only the page is requested.
  const combinedDeliverables =
    /\b(?:and|plus)\s+(?:(?:a|an|the|my)\s+)?(?:(?:working|functional|complete|custom|full[ -]?stack)\s+)?(?:(?:real[ -]?estate|booking|inventory|rental|property|payment)\s+)?(?:app(?:lication)?|crm|erp|platform|management\s+system)\b/iu.test(text)
    || /\bwith\s+(?:(?:a|an|the|my)\s+)?(?:working|functional|integrated)\s+(?:(?:real[ -]?estate|booking|inventory|rental|property|payment)\s+)?(?:app(?:lication)?|crm|erp|platform|management\s+system)\b/iu.test(text)
    || /\b(?:build|create|develop|design|make|need|want)\b.{0,100}\b(?:app(?:lication)?|crm|erp|platform|management\s+system)\b.{0,100}\b(?:landing[ -]?page|brochure|marketing[ -]?(?:page|website))\b/iu.test(text)
    || /\b(?:and|plus|with)\s+(?:(?:a|an|the|my)\s+)?(?:(?:live|working|functional)\s+)?(?:marketplace|customer\s+order\s+tracking|buyer\s+checkout)\b/iu.test(text)
    || /(?:صفحة\s+(?:هبوط|تعريفية)|موقع\s+(?:تعريفي|تسويقي)).{0,70}(?:بالإضافة\s+إلى|مع|بجانب).{0,35}(?:نظام\s+(?:حجز|إدارة)|تطبيق|متجر|منصة|لوحة\s+تحكم)/iu.test(text)
    || /(?:مع|وبجانب|إضافة\s+إلى|بالإضافة\s+إلى)\s+(?:(?:لوحة\s+(?:تحكم|إدارة|ادارة))|(?:نظام\s+(?:إدارة|ادارة))|(?:تطبيق\s+(?:عقارات|لإدارة|ادارة|متكامل))|(?:إضافة|تعديل|حذف)\s+(?:العقارات|الإعلانات|السجلات))/iu.test(text);

  // Require real data/auth/business behavior, independently of the domain label.
  // A simple filter, property photo gallery or an explanation ABOUT an app is
  // not proof that the user requested an actual backend application.
  const explicitWorkflow =
    /\b(?:landlords?|tenants?|visitors?|agents?|users?|staff|admins?|customers?|buyers?|sellers?|owners?)\b.{0,100}\b(?:can|must|should|able to|need to|will|allow(?:s|ing)?(?:\s+to)?)\b.{0,44}\b(?:upload|send|sign|select|choose|confirm|submit|request)\b.{0,40}\b(?:listings?|leases?|contracts?|offers?|times?|slots?|reservations?|appointments?|properties|orders?)\b/iu.test(text)
    || /\ballow(?:ing|s)?\b.{0,30}\b(?:buyers?|sellers?|users?|agents?|owners?|tenants?|staff)\b.{0,35}\b(?:upload|send|create|book|submit)\b.{0,40}\b(?:listings?|offers?|records?|properties|orders?|applications?)\b/iu.test(text)
    || /\b(?:booking|rental|property|real[ -]?estate|apartment)\s+(?:website|site|portal)\b.{0,80}\b(?:authentication|reservations?|checkouts?|signed[ -]?in)\b/iu.test(text)
    || /\b(?:book(?:ing)?\s+site|reservation\s+site)\b.{0,80}\b(?:choose|select|reserve|confirm|pay|appointment|time\s+slot)\b/iu.test(text)
    || /(?:يسمح|يتيح)\s+(?:ل(?:لزبائن|لعملاء|لمستخدمين|لموظفين|للمالكين|لملاك)|للزبائن|للعملاء|للمستخدمين|للموظفين).{0,22}(?:برفع|بإضافة|باضافة|بنشر|بحجز|بتعديل|رفع|إضافة|اضافة|نشر|حجز)|(?:يستطيع|يمكن)\s+(?:الزائر|العميل|الزبون|المستخدم).{0,30}(?:طلب|حجز|تسجيل|إضافة|اضافة)/iu.test(text)
    || /(?:منصة|تطبيق|موقع|متجر).{0,55}(?:استلام\s+المدفوعات|استقبال\s+الطلبات|تبادل\s+الرسائل|محادثات\s+خاصة|الدفع\s+واستقبال\s+الطلبات)/iu.test(text)
    || /\b(?:agents?|users?|staff|admins?|customers?|buyers?|sellers?|owners?)\b.{0,85}\b(?:can|must|should|able to|need to|will)\b.{0,32}\b(?:add|create|edit|update|delete|manage|save|publish|post|book|pay|register|log\s*in)\b/iu.test(text)
    || /\b(?:add|create|edit|update|delete|manage|save|publish|post|book|pay)\s+(?:(?:and|or|to|the|my|their|our|new|existing|own|all)\s+){0,5}(?:property|properties|listings?|records?|bookings?|appointments?|orders?|inventory|accounts?|payments?)\b/iu.test(text)
    || /\b(?:log[ -]?in|sign[ -]?up|sign[ -]?in|user\s+registration|user\s+accounts?|staff\s+accounts?)\b/iu.test(text)
    || /(?:موقع|منصة|تطبيق|نظام).{0,55}(?:يسمح\s+(?:للمستخدمين|للموظفين|للعملاء)|يمكن\s+(?:للمستخدمين|للموظفين|للعملاء)|صلاحيات|تسجيل\s+(?:ال)?دخول|إنشاء\s+حسابات|انشاء\s+حسابات)/iu.test(text)
    || /(?:إضافة|اضافة|إدخال|ادخال|تعديل|حذف)\s+(?:(?:ال)?عقارات|(?:ال)?إعلانات|(?:ال)?حجوزات|(?:ال)?طلبات|(?:ال)?سجلات|(?:ال)?عملاء|(?:ال)?مخزون)/iu.test(text)
    || /(?:فيه|مع|يشمل|يتضمن|نريد|أريد|بدي).{0,55}(?:إدارة|ادارة)\s+(?:(?:ال)?عقارات|(?:ال)?حجوزات|(?:ال)?طلبات|(?:ال)?سجلات|(?:ال)?عملاء)/iu.test(text);

  const marketingDescription = /\b(?:screenshots?|teaser|mockup|describing|explaining|demonstrating|about|features|logo)\b|(?:يعرض|صور|ميزات|مميزات|شرح|ترويج|توضح|يشرح|تشرح|تستعرض|تصف)/iu.test(text);
  if (presentationOnly && !additionalAppRequest && !combinedDeliverables
    && (!explicitWorkflow || marketingDescription)) return false;

  return additionalAppRequest || combinedDeliverables
    || /\b(?:web[ -]?app(?:lication)?|mobile[ -]?app(?:lication)?|full[ -]?stack[ -]?(?:app(?:lication)?|software)|saas|crm|erp|(?:admin|staff|customer)[ -]?dashboard|(?:real[ -]?estate|property|inventory|booking|business|customer)[ -]?(?:management[ -]?)?(?:app(?:lication)?|platform|system)|management[ -]?(?:system|platform))\b/iu.test(text)
    || /\b(?:build|create|develop|generate|make|need|want)\s+(?:(?:me|us)\s+)?(?:(?:a|an|the|my|our|full)[ -]?)?(?:functional[ -]?|complete[ -]?|custom[ -]?)?(?:app(?:lication)?|platform|software)(?:\b|\s)/iu.test(text)
    || /(?:^|[\s،:؛])(?:تطبيق(?:ا)?|منصة|برنامج)\s+(?:ل(?:إدارة|ادارة|لعقارات|لعقار|لحجز|لبيع|تأجير)|(?:إدارة|ادارة)|عقارات|العقارات|حجوزات|حجز|متكامل|العملاء|للعملاء|إعلانات|البيع|التأجير)/iu.test(text)
    || /(?:^|[\s،:؛])نظام\s+(?:إدارة|ادارة|لإدارة|لادارة|عقارات|العقارات|حجوزات|حجز|مخزون|طلبات|بيع|مبيعات|متكامل)/iu.test(text)
    || /(?:منصة\s+(?:لبيع|تواصل|مراسلة)|متجر\s+(?:إلكتروني|الكتروني|أونلاين|اونلاين|على\s+الانترنت))/iu.test(text)
    || /\b(?:online\s+marketplace|marketplace|e[ -]?commerce\s+(?:store|website|platform)|online\s+store|business\s+portal|customer\s+portal|staff\s+portal)\b/iu.test(text)
    || /\b(?:booking|payment|rental|property|real[ -]?estate|inventory|order|customer)\b.{0,48}\b(?:platform|system|app(?:lication)?)\b/iu.test(text)
    || /(?:نظام\s+(?:متابعة|إدارة|ادارة)|منصة\s+(?:حجوزات|إدارة|ادارة|متكاملة|شاملة)|تطبيق\s+(?:حجوزات|إدارة|ادارة|متكامل))/iu.test(text)
    || explicitWorkflow
    || /(?:لوحة\s+(?:تحكم|إدارة|ادارة)|(?:إضافة|ادخال|تعديل|حذف)\s+(?:العقارات|عقارات|الإعلانات|الاعلانات|السجلات|العملاء)|(?:إدارة|ادارة)\s+(?:العقارات|عقارات|العملاء|الحجوزات|السجلات|الطلبات|الإعلانات|الاعلانات))/iu.test(text);
}

/** Preserve explicit informational-site requests even when they mention app
 * features such as login, databases or bookings by name. */
export function isExplicitPresentationOnlyRequest(prompt: string): boolean {
  const text = normalizeIntentText(prompt);
  return hasPresentationDeliverable(text) && !explicitlyRequestsApplication(text);
}

/** Scope a deliberately narrow record-mutation contract to requested real-estate
 * operations. Domain labels alone do not imply CRUD, and a marketing page that
 * describes another app must not request any database mutation. */
export function requestedRealEstateRecordMutations(prompt: string): Array<'create' | 'update' | 'delete'> {
  if (!explicitlyRequestsApplication(prompt) || isExplicitPresentationOnlyRequest(prompt)) return [];
  const text = normalizeIntentText(prompt);
  if (!/\b(?:real[ -]?estate|propert(?:y|ies)|listings?|apartments?|housing)\b|(?:عقار|عقارات|العقار|العقارات|عقاري|عقارية)/iu.test(text)) return [];

  // Detect actions directed at property records, not the verb "create" in
  // "create a real-estate application", or edits to unrelated user accounts.
  const property = /\b(?:propert(?:y|ies)|listings?|apartments?|homes?)\b|(?:العقارات|عقارات|العقار|عقار|الإعلانات|الاعلانات|إعلانات|اعلانات)/giu;
  const verb = /\b(?:add|create|post|publish|upload|edit|update|modify|delete|remove)\b|(?:إضافة|اضافة|إدخال|ادخال|إنشاء|انشاء|نشر|رفع|تعديل|تحديث|تحرير|حذف|إزالة|ازالة)/giu;
  const unrelated = /\b(?:app|application|website|site|platform|system|account|accounts|users?|payments?|orders?|products?|photos?|pictures?|images?|blog|team)\b|(?:الحساب|حساب|حسابات|المستخدم|المستخدمين|المدفوعات|الطلبات)/iu;
  const requested = new Set<'create' | 'update' | 'delete'>();
  const addAction = (word: string) => {
    if (/^(?:add|create|post|publish|upload|إضافة|اضافة|إدخال|ادخال|إنشاء|انشاء|نشر|رفع)$/iu.test(word)) requested.add('create');
    else if (/^(?:edit|update|modify|تعديل|تحديث|تحرير)$/iu.test(word)) requested.add('update');
    else if (/^(?:delete|remove|حذف|إزالة|ازالة)$/iu.test(word)) requested.add('delete');
  };
  for (const match of text.matchAll(property)) {
    const position = match.index ?? 0;
    const following = text.slice(position + match[0].length);
    // "property management app" and "property photos" are not property rows.
    if (/^\s+(?:(?:(?:listing|management)\s+)?(?:app|application|website|site|platform|system)|(?:photos?|images?|pictures?|gallery))\b/iu.test(following)) continue;
    const before = text.slice(Math.max(0, position - 65), position);
    for (const operation of before.matchAll(verb)) {
      const offset = operation.index ?? 0;
      const between = before.slice(offset + operation[0].length);
      const prior = before.slice(Math.max(0, offset - 20), offset);
      if (unrelated.test(between) || /\b(?:without|not|no)\s+(?:the\s+ability\s+to\s+)?$|(?:بدون|من\s+دون)\s*$/iu.test(prior)) continue;
      addAction(operation[0]);
    }
    // Arabic shorthand "إضافة العقارات وتعديلها وحذفها" still names all three.
    const after = following.slice(0, 56);
    for (const operation of after.matchAll(/(?:و|ب)?(?:إضافتها|اضافتها|تعديلها|تحديثها|حذفها|إزالتها|ازالتها)|\b(?:can|must|should)\s+(?:be\s+)?(?:added|created|edited|updated|deleted|removed)\b/giu)) {
      const value = operation[0];
      if (/اضاف|إضاف|added|created/iu.test(value)) requested.add('create');
      else if (/تعديل|تحديث|edited|updated/iu.test(value)) requested.add('update');
      else requested.add('delete');
    }
  }
  return (['create', 'update', 'delete'] as const).filter(action => requested.has(action));
}

/** Require the bound CRUD controls to target a real-estate record table, not an
 * unrelated users, orders or generic settings table. */
export function isRealEstateRecordTable(table: { id: string; key: string; name: string }): boolean {
  return /\b(?:real[ -]?estate|propert(?:y|ies)|listings?|apartments?|homes?)\b|(?:عقار|عقارات|العقار|العقارات|عقاري|عقارية)/iu
    .test([table.id, table.key, table.name].join(' '));
}
