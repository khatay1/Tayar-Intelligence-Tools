import { ApplicationCounterRejected } from '../core/application-counter';
import { applicationReportDifference } from '../core/application-reports';
import { ApplicationTransactionRejected } from '../core/application-transaction';
import { ApplicationWorkflowRejected } from '../core/application-workflow';
import { createApplicationReferenceInput } from './application-reference-input';
import { ApplicationBookingRejected } from '../core/application-booking';
import { formatApplicationBookingSchedule } from '../core/application-booking-schedule';
import type { Language } from '@/context/PreferencesContext';
import type { ApplicationDefinition, ApplicationField } from '../core/application-model';
import type { ApplicationDataViewBinding } from '../core/application-data-view';
import { createApplicationDataViewController } from '../core/application-data-view-controller';
import type { createApplicationDataRuntime } from '../core/application-data-runtime';

const translations = {
  en: { files: 'Attachments', upload: 'Upload file', download: 'Download', fileConfirm: 'Delete this attachment permanently?', fileLimit: 'Allowed types and size', unavailable: 'The transaction is unavailable. Check the selected items and access.', transact: 'Create transaction', addLine: 'Add item', item: 'Item', quantity: 'Quantity', bounds: 'The change exceeds the allowed limits. Choose another amount.', adjust: 'Adjust quantity', delta: 'Change (+ / −)', relatedError: 'Could not load related records. Check access and try again.', conflict: 'This resource is already booked for that time. Choose another time.', schedule: 'Choose a time within working hours and the maximum booking duration.', interval: 'Booking end must be after start.', add: 'Add record', edit: 'Edit', remove: 'Delete', save: 'Save', cancel: 'Cancel', search: 'Search', refresh: 'Refresh', previous: 'Previous', next: 'Next', empty: 'No records found.', loading: 'Loading…', error: 'Could not load records. Sign in and try again.', failed: 'Could not save. Check your values and permissions. If the result is uncertain, retry with the same values.', saved: 'Saved.', removed: 'Deleted.', confirm: 'Delete this record permanently?', yes: 'Yes', no: 'No', unset: 'Select a value', actions: 'Actions', page: 'Page', readonly: 'Read only' },
  ar: { files: 'المرفقات', upload: 'رفع ملف', download: 'تنزيل', fileConfirm: 'هل تريد حذف هذا المرفق نهائيًا؟', fileLimit: 'الأنواع والحجم المسموحان', unavailable: 'المعاملة غير متاحة. تحقّق من العناصر المحددة والصلاحيات.', transact: 'إنشاء معاملة', addLine: 'إضافة عنصر', item: 'العنصر', quantity: 'الكمية', bounds: 'التغيير يتجاوز الحدود المسموحة. اختر كمية أخرى.', adjust: 'تغيير الكمية', delta: 'التغيير (+ / −)', relatedError: 'تعذّر تحميل السجلات المرتبطة. تحقّق من صلاحية الوصول وحاول مجددًا.', conflict: 'هذا المورد محجوز في الوقت المحدد. اختر وقتًا آخر.', schedule: 'اختر وقتًا ضمن ساعات العمل والمدة القصوى للحجز.', interval: 'يجب أن يكون انتهاء الحجز بعد بدايته.', add: 'إضافة سجل', edit: 'تعديل', remove: 'حذف', save: 'حفظ', cancel: 'إلغاء', search: 'بحث', refresh: 'تحديث', previous: 'السابق', next: 'التالي', empty: 'لا توجد سجلات.', loading: 'جارٍ التحميل…', error: 'تعذّر تحميل السجلات. سجّل الدخول وحاول مجددًا.', failed: 'تعذّر الحفظ. تحقّق من القيم والصلاحيات. إذا كانت النتيجة غير مؤكدة، أعد المحاولة بالقيم نفسها.', saved: 'تم الحفظ.', removed: 'تم الحذف.', confirm: 'هل تريد حذف هذا السجل نهائيًا؟', yes: 'نعم', no: 'لا', unset: 'اختر قيمة', actions: 'الإجراءات', page: 'الصفحة', readonly: 'للقراءة فقط' },
  sv: { files: 'Bilagor', upload: 'Ladda upp fil', download: 'Ladda ner', fileConfirm: 'Ta bort bilagan permanent?', fileLimit: 'Tillåtna typer och storlek', unavailable: 'Transaktionen är inte tillgänglig. Kontrollera valda poster och åtkomst.', transact: 'Skapa transaktion', addLine: 'Lägg till post', item: 'Post', quantity: 'Antal', bounds: 'Ändringen överskrider tillåtna gränser. Välj ett annat antal.', adjust: 'Ändra antal', delta: 'Ändring (+ / −)', relatedError: 'Kunde inte läsa relaterade poster. Kontrollera åtkomst och försök igen.', conflict: 'Resursen är redan bokad den tiden. Välj en annan tid.', schedule: 'Välj en tid inom öppettiderna och bokningens längdgräns.', interval: 'Bokningens slut måste vara efter starten.', add: 'Lägg till post', edit: 'Redigera', remove: 'Ta bort', save: 'Spara', cancel: 'Avbryt', search: 'Sök', refresh: 'Uppdatera', previous: 'Föregående', next: 'Nästa', empty: 'Inga poster hittades.', loading: 'Laddar…', error: 'Kunde inte läsa poster. Logga in och försök igen.', failed: 'Kunde inte spara. Kontrollera värden och behörigheter. Om resultatet är osäkert, försök igen med samma värden.', saved: 'Sparat.', removed: 'Borttaget.', confirm: 'Ta bort den här posten permanent?', yes: 'Ja', no: 'Nej', unset: 'Välj ett värde', actions: 'Åtgärder', page: 'Sida', readonly: 'Skrivskyddad' },
};

/** A native, isolated data component. All record values use textContent/value;
 * authored HTML, shared caches and platform credentials never render rows. */
export function mountApplicationDataView(host: HTMLElement, definition: ApplicationDefinition, binding: ApplicationDataViewBinding,
  runtime: ReturnType<typeof createApplicationDataRuntime>, language: Language, scope: { projectRef: string; projectId: string; pageId: string; sectionId: string; organizationId?: string }) {
  const copy = translations[language] ?? translations.en;
  const stockCopy = ({ en: { action: 'Available stock', result: 'Available', hint: 'Informational only. A reservation must still succeed before stock is committed.' },
    ar: { action: 'المخزون المتاح', result: 'المتاح', hint: 'للاطلاع فقط. يجب نجاح الحجز قبل اعتماد الكمية.' },
    sv: { action: 'Tillgängligt lager', result: 'Tillgängligt', hint: 'Endast information. En reservation måste lyckas innan lagret tas i anspråk.' } })[language];
  const holdCopy = ({ en: { manage: 'Manage stock hold', reserve: 'Reserve stock', release: 'Release hold', fulfill: 'Fulfill hold', location: 'Location reference UUID (label only)', quantity: 'Quantity', pending: 'Retry the same reservation to confirm its result.', held: 'Hold active for up to 15 minutes. Choose release or fulfillment.', uncertain: 'Result uncertain. Retry the same operation; do not change the receipt.', expired: 'The hold expired. Available stock may be reserved again.', completed: 'Stock operation confirmed.' },
    ar: { manage: 'إدارة حجز المخزون', reserve: 'حجز المخزون', release: 'تحرير الحجز', fulfill: 'تسليم الحجز', location: 'معرّف الموقع UUID (وصف فقط)', quantity: 'الكمية', pending: 'أعد محاولة الحجز نفسه لتأكيد النتيجة.', held: 'الحجز فعّال حتى 15 دقيقة. اختر التحرير أو التسليم.', uncertain: 'النتيجة غير مؤكدة. أعد العملية نفسها دون تغيير معرّف الحجز.', expired: 'انتهت صلاحية الحجز. يمكن حجز الكمية المتاحة مجدداً.', completed: 'تم تأكيد عملية المخزون.' },
    sv: { manage: 'Hantera lagerreservation', reserve: 'Reservera lager', release: 'Frisläpp reservation', fulfill: 'Slutför reservation', location: 'Platsreferens UUID (endast etikett)', quantity: 'Antal', pending: 'Försök igen med samma reservation för att bekräfta resultatet.', held: 'Reservationen gäller i högst 15 minuter. Frisläpp eller slutför.', uncertain: 'Resultatet är osäkert. Försök igen med samma kvitto.', expired: 'Reservationen har löpt ut. Tillgängligt lager kan reserveras igen.', completed: 'Lageråtgärden bekräftades.' } })[language];
  const transferCopy = ({ en: {action:'Transfer stock',destination:'Destination stock',pending:'Previously selected destination',quantity:'Quantity',submit:'Confirm transfer',uncertain:'Result uncertain. Retry this same transfer to confirm it.',done:'Stock transfer confirmed.',empty:'Create a stock record for this item at the destination warehouse first.'},
    ar: {action:'نقل المخزون',destination:'رصيد الوجهة',pending:'الوجهة المحددة سابقًا',quantity:'الكمية',submit:'تأكيد النقل',uncertain:'النتيجة غير مؤكدة. أعد التحويل نفسه لتأكيده.',done:'تم تأكيد نقل المخزون.',empty:'أنشئ سجل رصيد لهذا الصنف في مستودع الوجهة أولًا.'},
    sv: {action:'Flytta lager',destination:'Destinationslager',pending:'Tidigare vald destination',quantity:'Antal',submit:'Bekräfta flytt',uncertain:'Resultatet är osäkert. Försök igen med samma flytt.',done:'Lagerflytten bekräftades.',empty:'Skapa först en lagerpost för varan på destinationslagret.'} })[language];
  const reportCopy = ({ en: { title: 'Aggregate reports', scope: 'All records you can read. Search, filters and page selection do not change totals.', error: 'Could not load totals. Refresh and try again.' },
    ar: { title: 'التقارير المجمّعة', scope: 'جميع السجلات المسموح لك بقراءتها. البحث والتصفية واختيار الصفحة لا تغيّر الإجماليات.', error: 'تعذّر تحميل الإجماليات. حدّث وحاول مجددًا.' },
    sv: { title: 'Sammanställda rapporter', scope: 'Alla poster du får läsa. Sökning, filter och sidval ändrar inte totalsummorna.', error: 'Kunde inte läsa totalsummorna. Uppdatera och försök igen.' } })[language];
  const analyticsCopy = ({ en: { previous: 'Previous period', difference: 'Change', group: 'Group', empty: 'No value', limit: 'Only the first 100 groups are shown. Totals include all groups.', download: 'Download report (JSON)', period: 'Calendar period', partial: 'Current periods may be incomplete; the preceding period is complete.' },
    ar: { previous: 'الفترة السابقة', difference: 'التغيير', group: 'المجموعة', empty: 'بدون قيمة', limit: 'تظهر أول 100 مجموعة فقط. الإجماليات تشمل جميع المجموعات.', download: 'تنزيل التقرير (JSON)', period: 'الفترة الزمنية', partial: 'قد تكون الفترة الحالية غير مكتملة؛ الفترة السابقة كاملة.' },
    sv: { previous: 'Föregående period', difference: 'Förändring', group: 'Grupp', empty: 'Inget värde', limit: 'Endast de första 100 grupperna visas. Totalsummorna omfattar alla grupper.', download: 'Ladda ner rapport (JSON)', period: 'Kalenderperiod', partial: 'Aktuella perioder kan vara ofullständiga; föregående period är komplett.' } })[language];
  const periodUnits = { en: { day: 'Day', week: 'Week', month: 'Month', year: 'Year' }, ar: { day: 'يوم', week: 'أسبوع', month: 'شهر', year: 'سنة' }, sv: { day: 'Dag', week: 'Vecka', month: 'Månad', year: 'År' } }[language];
  const bookingCopy = { en: { wait: 'Join waiting list', note: 'A waiting-list entry does not reserve time. Confirmation requires an authorized update and a fresh conflict check.', check: 'Check availability', free: 'Available now. Saving confirms the reservation.', taken: 'This interval is unavailable. Choose another time or join the waiting list.' },
    ar: { wait: 'الانضمام لقائمة الانتظار', note: 'طلب الانتظار لا يحجز الوقت. التأكيد يحتاج تعديلًا بصلاحية مناسبة وفحص التعارض مجددًا.', check: 'فحص الإتاحة', free: 'متاح الآن. الحفظ يؤكد الحجز.', taken: 'الفترة غير متاحة. اختر وقتًا آخر أو انضم لقائمة الانتظار.' },
    sv: { wait: 'Gå med i väntelistan', note: 'En väntelistepost reserverar ingen tid. Bekräftelse kräver en behörig uppdatering och en ny konfliktkontroll.', check: 'Kontrollera tillgänglighet', free: 'Ledigt nu. Spara för att bekräfta bokningen.', taken: 'Intervallet är inte ledigt. Välj en annan tid eller gå med i väntelistan.' } }[language];
  const recurrenceCopy = ({ en: { enable: 'Repeat booking', count: 'Number of appointments', frequency: 'Frequency', daily: 'Daily', weekly: 'Weekly', interval: 'Every (days or weeks)', note: 'All appointments save together. Dates below use your device time zone; repetition follows the configured booking time zone.' },
    ar: { enable: 'تكرار الحجز', count: 'عدد المواعيد', frequency: 'التكرار', daily: 'يومي', weekly: 'أسبوعي', interval: 'كل (أيام أو أسابيع)', note: 'تُحفظ المواعيد كلها معًا. التواريخ أدناه بتوقيت جهازك؛ التكرار يتبع المنطقة الزمنية المحددة للحجز.' },
    sv: { enable: 'Upprepa bokning', count: 'Antal bokningar', frequency: 'Frekvens', daily: 'Dagligen', weekly: 'Varje vecka', interval: 'Var (dagar eller veckor)', note: 'Alla bokningar sparas tillsammans. Datumen nedan använder enhetens tidszon; upprepning följer bokningens tidszon.' } })[language];
  const paymentStates = ({ en: ['Unpaid', 'Pending payment', 'Paid', 'Payment failed', 'Refund pending', 'Partially refunded', 'Refunded', 'Refund failed'],
    ar: ['غير مدفوع', 'بانتظار الدفع', 'مدفوع', 'فشل الدفع', 'استرداد قيد الانتظار', 'استرداد جزئي', 'تم الاسترداد', 'فشل الاسترداد'],
    sv: ['Obetald', 'Väntar på betalning', 'Betald', 'Betalning misslyckades', 'Återbetalning väntar', 'Delvis återbetald', 'Återbetald', 'Återbetalning misslyckades'] })[language];
  const paymentStatusCopy = ({ en: { title: 'Payment status', due: 'Due', paid: 'Paid', refunded: 'Refunded', units: 'Amounts in minor currency units' },
    ar: { title: 'حالة الدفع', due: 'المستحق', paid: 'المدفوع', refunded: 'المسترد', units: 'المبالغ بأصغر وحدة للعملة' },
    sv: { title: 'Betalningsstatus', due: 'Belopp', paid: 'Betalt', refunded: 'Återbetalt', units: 'Belopp i minsta valutaenhet' } })[language];
  const paymentCopy = ({ en: { pay: 'Pay order', refund: 'Refund', amount: 'Refund amount in minor currency units (for example, 100 = 1.00)', confirm: 'Submit this refund?', accepted: 'Refund request accepted. Final status is confirmed by the payment provider.' },
    ar: { pay: 'دفع الطلب', refund: 'استرداد', amount: 'مبلغ الاسترداد بأصغر وحدة للعملة (مثال: 100 = 1.00)', confirm: 'هل تريد إرسال طلب الاسترداد؟', accepted: 'تم قبول طلب الاسترداد. الحالة النهائية يؤكدها مزود الدفع.' },
    sv: { pay: 'Betala order', refund: 'Återbetala', amount: 'Belopp i minsta valutaenhet (till exempel 100 = 1,00)', confirm: 'Skicka återbetalningen?', accepted: 'Återbetalningen har accepterats. Betalningsleverantören bekräftar slutstatus.' } })[language] ?? { pay: 'Pay order', refund: 'Refund', amount: 'Amount in minor currency units', confirm: 'Submit refund?', accepted: 'Refund request accepted.' };
  const failure = (error: unknown) => error instanceof ApplicationBookingRejected ? copy[error.reason]
    : error instanceof ApplicationCounterRejected ? copy.bounds : error instanceof ApplicationTransactionRejected ? copy[error.reason]
      : error instanceof ApplicationWorkflowRejected ? copy.unavailable : copy.failed;
  const controller = createApplicationDataViewController(definition, binding, runtime, () => crypto.randomUUID(), {
    keyPrefix: `tayar-app-form:${scope.projectRef}:${scope.projectId}:${scope.pageId}:data:${scope.sectionId}`,
    storage: { getItem: key => sessionStorage.getItem(key), setItem: (key, value) => sessionStorage.setItem(key, value), removeItem: key => sessionStorage.removeItem(key) }, crypto,
    organizationId: scope.organizationId,
  });
  const root = host.attachShadow({ mode: 'open' });
  let disposed = false, busy = false, sequence = 0, page = 0, query = '', filterValue = '';
  let references: Array<ReturnType<typeof createApplicationReferenceInput>> = [];
  let editorSequence = 0;
  const downloadUrls = new Set<string>();
  function stopEditor() { editorSequence++; for (const url of downloadUrls) URL.revokeObjectURL(url); downloadUrls.clear(); for (const reference of references) reference.dispose(); references = []; }
  const style = document.createElement('style');
  style.textContent = ':host{display:block;font:15px/1.5 system-ui,sans-serif;color:#0f172a}*{box-sizing:border-box}.view{background:#fff;border:1px solid #cbd5e1;border-radius:14px;padding:20px}.toolbar,.pager{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:12px 0}.scroll{overflow:auto}table{width:100%;border-collapse:collapse}th,td{text-align:start;padding:10px;border-bottom:1px solid #e2e8f0;white-space:pre-wrap;overflow-wrap:anywhere;max-width:360px}th{background:#f1f5f9}button,input,select,textarea{font:inherit}button{border:1px solid #64748b;border-radius:8px;padding:8px 12px;background:#f8fafc;color:#0f172a;cursor:pointer}button:disabled{opacity:.5;cursor:default}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid #2563eb;outline-offset:2px}.danger{color:#b91c1c}label{display:grid;gap:5px;margin:12px 0}input,select,textarea{width:100%;padding:9px;border:1px solid #94a3b8;border-radius:6px;background:#fff;color:#0f172a}textarea{min-height:100px}.editor{border:1px solid #94a3b8;padding:16px;border-radius:10px;margin:16px 0}h3{margin:0}p{overflow-wrap:anywhere}[hidden]{display:none!important}';
  const view = document.createElement('div'); view.className = 'view'; view.dir = language === 'ar' ? 'rtl' : 'ltr';
  const title = document.createElement('h3'); title.textContent = controller.table.name;
  const status = document.createElement('p'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const toolbar = document.createElement('div'); toolbar.className = 'toolbar';
  const button = (label: string, action: () => void) => {
    const result = document.createElement('button'); result.type = 'button'; result.textContent = label; result.addEventListener('click', action); return result;
  };
  const add = button(copy.add, () => openEditor()); add.hidden = true;
  const transact = button(copy.transact, () => openTransaction()); transact.hidden = true;
  const refresh = button(copy.refresh, () => { void load(); });
  toolbar.append(add, transact, refresh);
  if (controller.filter) {
    const label = document.createElement('label'), select = document.createElement('select');
    label.textContent = controller.filter.name;
    select.dataset.applicationFilter = controller.filter.id;
    const all = document.createElement('option'); all.value = '';
    all.textContent = ({ en: 'All values', ar: 'كل القيم', sv: 'Alla värden' })[language] ?? 'All values';
    select.append(all);
    for (const value of controller.filter.options ?? []) {
      const option = document.createElement('option'); option.value = value; option.textContent = value; select.append(option);
    }
    select.addEventListener('change', () => {
      if (busy) { select.value = filterValue; return; }
      filterValue = select.value; page = 0; void load();
    });
    label.append(select); toolbar.append(label);
  }
  if (controller.search) {
    const searchForm = document.createElement('form');
    const search = document.createElement('input'); search.type = 'search'; search.maxLength = 200; search.placeholder = copy.search; search.setAttribute('aria-label', `${copy.search}: ${controller.search.name}`);
    const submit = document.createElement('button'); submit.type = 'submit'; submit.textContent = copy.search;
    searchForm.append(search, submit); searchForm.addEventListener('submit', event => { event.preventDefault(); if (busy) return; query = search.value; page = 0; void load(); });
    toolbar.append(searchForm);
  }
  const scroll = document.createElement('div'); scroll.className = 'scroll';
  const table = document.createElement('table'), head = document.createElement('thead'), body = document.createElement('tbody');
  const header = document.createElement('tr');
  for (const field of controller.columns) { const th = document.createElement('th'); th.scope = 'col'; th.textContent = field.name; header.append(th); }
  const actionsHeader = document.createElement('th'); actionsHeader.scope = 'col'; actionsHeader.textContent = copy.actions; header.append(actionsHeader); head.append(header); table.append(head, body); scroll.append(table);
  const empty = document.createElement('p'); empty.textContent = copy.empty; empty.hidden = true;
  const editor = document.createElement('div'); editor.className = 'editor'; editor.hidden = true;
  const pager = document.createElement('div'); pager.className = 'pager';
  const previous = button(copy.previous, () => { if (page > 0 && !busy) { page--; void load(); } });
  const next = button(copy.next, () => { if (!busy) { page++; void load(); } });
  const pageLabel = document.createElement('span'); pager.append(previous, pageLabel, next);
  const summaries = document.createElement('section'); summaries.hidden = true; summaries.setAttribute('aria-label', reportCopy.title);
  view.append(title, toolbar, status, summaries, editor, scroll, empty, pager); root.append(style, view);
  if (controller.table.booking?.schedule) {
    const info = document.createElement('p'); info.textContent = formatApplicationBookingSchedule(controller.table.booking.schedule, language);
    title.after(info);
  }
  function setBusy(value: boolean) {
    busy = value; view.setAttribute('aria-busy', String(value));
    for (const control of view.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement>('button,input,select,textarea')) control.disabled = value;
    for (const reference of references) reference.setDisabled(value);
  }
  function clear() { stopEditor(); summaries.replaceChildren(); summaries.hidden = true; body.replaceChildren(); empty.hidden = true; add.hidden = true; transact.hidden = true; editor.replaceChildren(); editor.hidden = true; previous.disabled = true; next.disabled = true; }
  async function load() {
    if (disposed || busy) return;
    const current = ++sequence; setBusy(true); status.textContent = copy.loading;
    summaries.replaceChildren(); summaries.hidden = true;
    try {
      const actions = await controller.permissions();
      const result = await controller.load(page, query, filterValue);
      if (disposed || current !== sequence) return;
      clear(); add.hidden = !actions.includes('create') || actions.includes('transact'); transact.hidden = !actions.includes('transact'); actionsHeader.hidden = !actions.some(action => ['update', 'delete', 'adjust', 'transition', 'attachments', 'pay', 'refund', 'stock-availability', 'stock-reservation', 'stock-transfer'].includes(action));
      if (controller.table.reports?.length) {
        let reportResult: Awaited<ReturnType<typeof controller.reports>> | undefined;
        try { reportResult = await controller.reports(); } catch { if (controller.closed()) throw new Error('Report identity changed.'); }
        if (disposed || current !== sequence) return;
        const note = document.createElement('p'); note.textContent = reportResult ? reportCopy.scope : reportCopy.error; summaries.append(note);
        if (reportResult) for (const report of reportResult) {
          const line = document.createElement('p'); line.textContent = `${report.name}: ${report.value ?? '—'}`; summaries.append(line);
          const configured = controller.table.reports.find(item => item.id === report.id)!;
          if (configured.period) {
            const info = document.createElement('p'); info.textContent = `${analyticsCopy.period}: ${periodUnits[configured.period.unit]} (${configured.period.offset}) · ${configured.period.timeZone}. ${analyticsCopy.partial}`; summaries.append(info);
          }
          if (report.previousValue !== undefined) {
            const comparison = document.createElement('p'); comparison.textContent = `${analyticsCopy.previous}: ${report.previousValue ?? '—'} · ${analyticsCopy.difference}: ${applicationReportDifference(report.value, report.previousValue) ?? '—'}`; summaries.append(comparison);
          }
          if (report.groups) {
            const grouped = document.createElement('table'), header = document.createElement('tr');
            for (const text of [analyticsCopy.group, report.name, ...(report.previousValue !== undefined ? [analyticsCopy.previous, analyticsCopy.difference] : [])]) {
              const cell = document.createElement('th'); cell.scope = 'col'; cell.textContent = text; header.append(cell);
            }
            grouped.append(header);
            for (const group of report.groups) {
              const row = document.createElement('tr');
              for (const text of [group.key ?? analyticsCopy.empty, group.value ?? '—', ...(group.previousValue !== undefined ? [group.previousValue ?? '—', applicationReportDifference(group.value, group.previousValue) ?? '—'] : [])]) {
                const cell = document.createElement('td'); cell.textContent = text; row.append(cell);
              }
              grouped.append(row);
            }
            summaries.append(grouped);
            if (report.truncated) { const warning = document.createElement('p'); warning.textContent = analyticsCopy.limit; summaries.append(warning); }
          }
        }
        if (reportResult) summaries.append(button(analyticsCopy.download, () => {
          if (busy) return; setBusy(true);
          // Recheck the current account and fetch a fresh authorized snapshot at export.
          void controller.reports().then(reports => {
            if (disposed || current !== sequence || controller.closed()) return;
            const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), tableId: controller.table.id,
              definitions: controller.table.reports, reports }, null, 2)], { type: 'application/json' }));
            const link = document.createElement('a'); link.href = url; link.download = 'application-report.json'; link.click(); URL.revokeObjectURL(url);
          }).catch(() => { clear(); status.textContent = reportCopy.error; }).finally(() => { if (!disposed) setBusy(false); });
        }));
        summaries.hidden = false;
      }
      for (const row of result.rows) {
        const tr = document.createElement('tr');
        for (const field of controller.columns) { const td = document.createElement('td'); td.textContent = display(row[field.key], field); tr.append(td); }
        const td = document.createElement('td'); td.hidden = actionsHeader.hidden;
        if (actions.includes('stock-availability')) td.append(button(stockCopy.action, () => {
          if (busy) return; setBusy(true); status.textContent = copy.loading;
          void controller.stockAvailable(String(row.id)).then(amount => {
            if (disposed) return;
            status.textContent = `${stockCopy.result}: ${amount}. ${stockCopy.hint}`; setBusy(false);
          }).catch(() => { if (!disposed) { if (controller.closed()) clear(); setBusy(false); status.textContent = copy.error; } });
        }));
        if (actions.includes('stock-transfer')) td.append(button(transferCopy.action, () => openTransfer(row)));
        if (actions.includes('stock-reservation')) td.append(button(holdCopy.manage, () => openStock(row)));
        if (actions.includes('pay') || actions.includes('refund')) td.append(button(paymentStatusCopy.title, () => {
          if (busy) return; setBusy(true); status.textContent = copy.loading;
          void controller.paymentStatus(String(row.id)).then(payment => {
            if (disposed) return;
            const states = ['unpaid', 'pending', 'paid', 'payment-failed', 'refund-pending', 'partially-refunded', 'refunded', 'refund-failed'];
            status.textContent = `${paymentStates[states.indexOf(payment.status)]}. ${paymentStatusCopy.due}: ${payment.amountDue}; ${paymentStatusCopy.paid}: ${payment.amountPaid}; ${paymentStatusCopy.refunded}: ${payment.amountRefunded} ${payment.currency.toUpperCase()}. ${paymentStatusCopy.units}.`;
            setBusy(false);
          }).catch(() => { if (!disposed) { if (controller.closed()) clear(); setBusy(false); status.textContent = copy.error; } });
        }));
        if (actions.includes('pay')) td.append(button(paymentCopy.pay, () => {
          if (busy) return; setBusy(true); status.textContent = copy.loading;
          void controller.pay(String(row.id)).then(url => { if (!disposed) window.location.assign(url); })
            .catch(() => { if (!disposed) { if (controller.closed()) clear(); setBusy(false); status.textContent = copy.failed; } });
        }));
        if (actions.includes('refund')) td.append(button(paymentCopy.refund, () => openRefund(String(row.id))));
        if (actions.includes('transition')) for (const transition of controller.workflowTransitions(row)) {
          td.append(button(transition.label, () => {
            if (busy) return; setBusy(true); status.textContent = copy.loading;
            void controller.transition(String(row.id), transition.id).then(() => { if (!disposed) { setBusy(false); status.textContent = copy.saved; void load(); } })
              .catch((error: unknown) => { if (!disposed) { if (controller.closed()) clear(); setBusy(false); status.textContent = failure(error); } });
          }));
        }
        if (actions.includes('attachments')) td.append(button(copy.files, () => openFiles(String(row.id))));
        if (actions.includes('adjust')) td.append(button(copy.adjust, () => openAdjustment(row)));
        if (actions.includes('update')) td.append(button(copy.edit, () => openEditor(row)));
        if (actions.includes('delete')) {
          const remove = button(copy.remove, () => {
            if (busy || !window.confirm(copy.confirm)) return;
            setBusy(true); status.textContent = copy.loading;
            void controller.remove(String(row.id)).then(() => { if (!disposed) { status.textContent = copy.removed; setBusy(false); void load(); } }).catch(() => { if (!disposed) { clear(); setBusy(false); status.textContent = copy.failed; } });
          }); remove.className = 'danger'; td.append(remove);
        }
        tr.append(td); body.append(tr);
      }
      empty.hidden = result.rows.length > 0; pageLabel.textContent = `${copy.page} ${page + 1}`;
      status.textContent = actions.length ? '' : copy.readonly;
      setBusy(false); previous.disabled = page === 0; next.disabled = !result.hasNext;
    } catch { if (!disposed && current === sequence) { clear(); setBusy(false); previous.disabled = true; next.disabled = true; status.textContent = copy.error; } }
  }
  function display(value: unknown, field: ApplicationField) {
    if (value === null || value === undefined) return '—';
    if (field.type === 'boolean') return value ? copy.yes : copy.no;
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  }
  async function openTransfer(row: Record<string, unknown>) {
    if (disposed || busy) return;
    stopEditor(); const opening = editorSequence; editor.replaceChildren(); editor.hidden = false;
    const active = () => !disposed && !controller.closed() && editorSequence === opening;
    const rule = controller.table.stockLocations!;
    const product = controller.table.fields.find(field => field.id === rule.itemFieldId)!;
    const location = controller.table.fields.find(field => field.id === rule.locationFieldId)!;
    let pending: Awaited<ReturnType<typeof controller.stockTransferState>>;
    try { pending = await controller.stockTransferState(String(row.id)); if (!active()) return; }
    catch { clear(); status.textContent = copy.error; return; }
    const form = document.createElement('form'), destination = document.createElement('select'), amount = document.createElement('input');
    const targetLabel = document.createElement('label'), amountLabel = document.createElement('label'), notice = document.createElement('p');
    targetLabel.textContent = transferCopy.destination; destination.required = true; destination.name = 'destination'; targetLabel.append(destination);
    amountLabel.textContent = transferCopy.quantity; amount.name = 'quantity'; amount.type = 'number'; amount.min = '1'; amount.max = '1000000000000'; amount.step = '1'; amount.required = true;
    amount.value = String(pending?.quantity ?? 1); amount.readOnly = !!pending; amountLabel.append(amount);
    let destinationPage = 0, hasNext = false;
    const previousTarget = button(copy.previous, () => { if (!busy && !pending && destinationPage > 0) { destinationPage--; void loadTargets(); } });
    const nextTarget = button(copy.next, () => { if (!busy && !pending && hasNext) { destinationPage++; void loadTargets(); } });
    const submit = document.createElement('button'); submit.type = 'submit'; submit.textContent = transferCopy.submit;
    async function loadTargets() {
      destination.disabled = true; submit.disabled = true; previousTarget.disabled = true; nextTarget.disabled = true;
      try {
        const result = await controller.stockTransferOptions(String(row[product.key]),String(row[location.key]),destinationPage);
        if (!active()) return;
        destination.replaceChildren(); hasNext = result.hasNext;
        for (const target of result.options) { const option = document.createElement('option'); option.value = target.id; option.textContent = target.label; destination.append(option); }
        destination.disabled = false; submit.disabled = !result.options.length; previousTarget.disabled = destinationPage === 0; nextTarget.disabled = !hasNext;
        notice.textContent = result.options.length ? '' : transferCopy.empty;
      } catch {
        if (!disposed && editorSequence === opening) { if (controller.closed()) clear(); status.textContent = copy.error; }
      }
    }
    if (pending) {
      const option = document.createElement('option'); option.value = pending.destinationId; option.textContent = transferCopy.pending; destination.append(option);
      destination.disabled = true; previousTarget.disabled = true; nextTarget.disabled = true; notice.textContent = transferCopy.uncertain;
    }
    form.append(targetLabel,amountLabel,previousTarget,nextTarget,notice,submit,button(copy.cancel, () => { stopEditor(); editor.replaceChildren(); editor.hidden = true; }));
    form.addEventListener('submit', event => {
      event.preventDefault(); if (busy || !active() || !form.reportValidity() || !destination.value) return;
      const selected = destination.value, quantity = Number(amount.value); setBusy(true); status.textContent = copy.loading;
      void controller.stockTransfer(String(row.id),selected,quantity).then(async () => {
        if (!active()) return;
        stopEditor(); editor.replaceChildren(); editor.hidden = true; setBusy(false);
        await load(); if (!disposed) status.textContent = transferCopy.done;
      }).catch(() => {
        if (disposed) return;
        if (controller.closed()) { clear(); setBusy(false); return; }
        setBusy(false); destination.disabled = true; amount.readOnly = true; previousTarget.disabled = true; nextTarget.disabled = true;
        notice.textContent = transferCopy.uncertain; status.textContent = transferCopy.uncertain;
      });
    });
    editor.append(form); if (!pending) void loadTargets();
  }
  async function openStock(row: Record<string, unknown>) {
    const recordId = String(row.id);
    const locationField = controller.table.fields.find(field => field.id === controller.table.stockLocations?.locationFieldId);
    if (disposed || busy) return;
    stopEditor(); const opening = editorSequence; editor.replaceChildren(); editor.hidden = false;
    let hold: Awaited<ReturnType<typeof controller.stockState>>;
    try { hold = await controller.stockState(recordId); if (disposed || controller.closed() || editorSequence !== opening) return; }
    catch { clear(); status.textContent = copy.error; return; }
    const form = document.createElement('form');
    const locationLabel = document.createElement('label'); locationLabel.textContent = locationField ? ({ en: 'Warehouse reference UUID', ar: 'معرّف المستودع UUID', sv: 'Lagerreferens UUID' })[language] : holdCopy.location;
    const location = document.createElement('input'); location.required = true; location.pattern = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
    location.value = hold?.locationId ?? (locationField ? String(row[locationField.key] ?? '') : ''); location.readOnly = !!locationField; location.disabled = !!hold; locationLabel.append(location);
    const amountLabel = document.createElement('label'); amountLabel.textContent = holdCopy.quantity;
    const amount = document.createElement('input'); amount.type = 'number'; amount.min = '1'; amount.max = '1000000000000'; amount.step = '1'; amount.required = true;
    amount.value = String(hold?.quantity ?? 1); amount.disabled = !!hold; amountLabel.append(amount);
    const notice = document.createElement('p'); notice.textContent = hold?.phase === 'reserve' ? holdCopy.pending
      : hold?.phase === 'held' ? holdCopy.held : hold?.phase ? holdCopy.uncertain : stockCopy.hint;
    const run = (operation: 'reserve' | 'release' | 'fulfill') => {
      if (busy || !form.reportValidity()) return;
      setBusy(true); status.textContent = copy.loading;
      const task = operation === 'reserve' ? controller.stockReserve(recordId, location.value, Number(amount.value)) : controller.stockSettle(recordId, operation);
      void task.then(receipt => {
        if (disposed) return;
        stopEditor(); editor.hidden = true; editor.replaceChildren(); setBusy(false);
        void load().then(() => { if (!disposed) status.textContent = receipt === 'already-expired' ? holdCopy.expired : holdCopy.completed; });
      }).catch(() => { if (!disposed) { if (controller.closed()) clear(); setBusy(false); status.textContent = holdCopy.uncertain; } });
    };
    if (!hold || hold.phase === 'reserve') {
      const submit = document.createElement('button'); submit.type = 'submit'; submit.textContent = holdCopy.reserve;
      form.append(locationLabel, amountLabel, notice, submit);
      form.addEventListener('submit', event => { event.preventDefault(); run('reserve'); });
    } else {
      form.append(notice);
      if (hold.phase === 'held' || hold.phase === 'release') form.append(button(holdCopy.release, () => run('release')));
      if (hold.phase === 'held' || hold.phase === 'fulfill') form.append(button(holdCopy.fulfill, () => run('fulfill')));
    }
    form.append(button(copy.cancel, () => { stopEditor(); editor.hidden = true; editor.replaceChildren(); }));
    editor.append(form); if (!hold) location.focus();
  }
  function openRefund(recordId: string) {
    if (disposed || busy) return;
    stopEditor(); editor.replaceChildren(); editor.hidden = false;
    const label = document.createElement('label'); label.textContent = `${paymentCopy.amount} — ${controller.table.payment?.currency.toUpperCase()}`;
    const amount = document.createElement('input'); amount.type = 'number'; amount.min = '1'; amount.max = '99999999999'; amount.step = '1'; amount.required = true; label.append(amount);
    const form = document.createElement('form'), submit = document.createElement('button'); submit.type = 'submit'; submit.textContent = paymentCopy.refund;
    form.append(label, submit, button(copy.cancel, () => { stopEditor(); editor.hidden = true; editor.replaceChildren(); }));
    form.addEventListener('submit', event => {
      event.preventDefault(); if (busy || !form.reportValidity() || !window.confirm(paymentCopy.confirm)) return;
      setBusy(true); status.textContent = copy.loading;
      void controller.refund(recordId, Number(amount.value)).then(() => {
        if (!disposed) { setBusy(false); stopEditor(); editor.hidden = true; editor.replaceChildren(); status.textContent = paymentCopy.accepted; }
      }).catch(() => { if (!disposed) { if (controller.closed()) clear(); setBusy(false); status.textContent = copy.failed; } });
    });
    editor.append(form); amount.focus();
  }
  function openFiles(recordId: string) {
    if (disposed || busy || !controller.table.attachments) return;
    stopEditor(); editor.replaceChildren(); editor.hidden = false;
    const current = editorSequence, rule = controller.table.attachments;
    const active = () => !disposed && current === editorSequence;
    const info = document.createElement('p'); info.textContent = `${copy.fileLimit}: ${rule.mimeTypes.join(', ')}; ${rule.maxBytes / (1024 * 1024)} MiB`;
    const input = document.createElement('input'); input.type = 'file'; input.accept = rule.mimeTypes.join(','); input.setAttribute('aria-label', copy.upload);
    const list = document.createElement('div'); let canWrite = false, filePage = 0, hasNext = false, selectedId = crypto.randomUUID();
    input.addEventListener('change', () => { selectedId = crypto.randomUUID(); });
    const report = () => { if (active()) { if (controller.closed()) clear(); setBusy(false); status.textContent = copy.failed; } };
    async function loadFiles() {
      if (!active()) return;
      canWrite = await controller.fileWritesAllowed();
      const result = await controller.listFiles(recordId, filePage);
      if (!active()) return;
      input.hidden = !canWrite; upload.hidden = !canWrite;
      list.replaceChildren(); hasNext = result.hasNext;
      for (const file of result.files) {
        const row = document.createElement('p'); row.textContent = `${file.id} (${file.size} B) `;
        const download = button(copy.download, () => {
          if (busy || !active()) return; setBusy(true);
          void controller.downloadFile(recordId, file.id).then(blob => {
            if (!active()) return;
            const url = URL.createObjectURL(blob); downloadUrls.add(url);
            const link = document.createElement('a'); link.href = url; link.download = `attachment-${file.id}${file.extension}`; row.append(link); link.click(); link.remove();
            window.setTimeout(() => { URL.revokeObjectURL(url); downloadUrls.delete(url); }, 1000); setBusy(false);
          }).catch(report);
        });
        row.append(download);
        if (canWrite) row.append(button(copy.remove, () => {
          if (busy || !active() || !window.confirm(copy.fileConfirm)) return; setBusy(true);
          void controller.removeFile(recordId, file.id).then(async () => { if (active()) { await loadFiles(); setBusy(false); } }).catch(report);
        })); list.append(row);
      }
      filePrevious.disabled = filePage === 0; fileNext.disabled = !hasNext;
    }
    const upload = button(copy.upload, () => {
      const file = input.files?.[0]; if (!file || busy || !active()) return; setBusy(true);
      void controller.uploadFile(recordId, selectedId, file).then(async () => { if (active()) { input.value = ''; selectedId = crypto.randomUUID(); filePage = 0; await loadFiles(); setBusy(false); status.textContent = copy.saved; } }).catch(report);
    });
    const filePrevious = button(copy.previous, () => { if (!busy && filePage > 0) { filePage--; void loadFiles().catch(report); } });
    const fileNext = button(copy.next, () => { if (!busy && hasNext) { filePage++; void loadFiles().catch(report); } });
    editor.append(info, input, upload, list, filePrevious, fileNext, button(copy.cancel, () => { stopEditor(); editor.replaceChildren(); editor.hidden = true; }));
    void loadFiles().catch(report);
  }
  function openAdjustment(row: Record<string, unknown>) {
    if (disposed || busy) return;
    stopEditor(); editor.replaceChildren(); editor.hidden = false;
    const form = document.createElement('form'), label = document.createElement('label'), delta = document.createElement('input');
    label.textContent = copy.delta; delta.type = 'number'; delta.required = true; delta.step = controller.table.counter?.integer ? '1' : 'any';
    delta.name = 'adjustment'; label.append(delta);
    const save = document.createElement('button'); save.type = 'submit'; save.textContent = copy.save;
    form.append(label, save, button(copy.cancel, () => { stopEditor(); editor.replaceChildren(); editor.hidden = true; }));
    form.addEventListener('submit', event => {
      event.preventDefault(); if (busy || disposed) return;
      setBusy(true); status.textContent = copy.loading;
      void controller.adjust(String(row.id), delta.value).then(() => { if (!disposed) { editor.hidden = true; setBusy(false); void load(); } })
        .catch((error: unknown) => { if (!disposed) { if (controller.closed()) clear(); else body.replaceChildren(); setBusy(false); status.textContent = failure(error); } });
    });
    editor.append(form); delta.focus();
  }
  function openTransaction() {
    if (disposed || busy || !controller.table.transaction) return;
    stopEditor(); editor.replaceChildren(); editor.hidden = false;
    const form = document.createElement('form'); const inputs = new Map<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>();
    for (const field of controller.table.fields) {
      if (controller.table.workflow?.fieldId === field.id || controller.table.organizationFieldId === field.id || field.formula) continue;
      const label = document.createElement('label'); label.textContent = field.name;
      let input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      if (field.type === 'reference') {
        const reference = createApplicationReferenceInput(field, '', controller, copy, () => { clear(); status.textContent = copy.error; });
        references.push(reference); input = reference.input; form.append(label, reference.controls); void reference.load();
      } else if (field.type === 'enum' || field.type === 'boolean') {
        const select = document.createElement('select'), options = field.type === 'boolean' ? [['', copy.unset], ['true', copy.yes], ['false', copy.no]] : [['', copy.unset], ...(field.options ?? []).map(value => [value, value])];
        for (const [value, text] of options) { const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option); } input = select; label.append(input); form.append(label);
      } else if (field.type === 'json') { input = document.createElement('textarea'); input.maxLength = 20_000; label.append(input); form.append(label); }
      else { const text = document.createElement('input'); text.type = field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'datetime' ? 'datetime-local' : 'text'; if (field.type === 'number' || field.type === 'datetime') text.step = 'any'; text.maxLength = 20_000; input = text; label.append(input); form.append(label); }
      input.name = field.key; input.required = field.required && field.defaultValue === undefined; inputs.set(field.key, input);
    }
    const picker = document.createElement('fieldset'), search = document.createElement('input'), select = document.createElement('select'), quantity = document.createElement('input');
    const itemLabel = document.createElement('label'), quantityLabel = document.createElement('label'), selected = document.createElement('div'); let itemPage = 0, itemQuery = '', hasNext = false;
    // These inputs stage a line; only the committed lines belong to the transaction.
    // Adding a line clears quantity, so requiring it would block the parent form.
    search.type = 'search'; search.maxLength = 200; search.placeholder = copy.search; quantity.type = 'number'; quantity.min = '0'; quantity.step = 'any';
    itemLabel.textContent = copy.item; itemLabel.append(select); quantityLabel.textContent = copy.quantity; quantityLabel.append(quantity);
    const lines: Array<{ itemId: string; quantity: number; label: string }> = [];
    const renderLines = () => { selected.replaceChildren(); for (const line of lines) { const row = document.createElement('p'); row.textContent = `${line.label}: ${line.quantity} `; row.append(button(copy.remove, () => { lines.splice(lines.indexOf(line), 1); renderLines(); })); selected.append(row); } };
    const loadItems = async () => { const result = await controller.transactionItemOptions(itemPage, itemQuery); select.replaceChildren(); hasNext = result.hasNext; for (const option of result.options) { const node = document.createElement('option'); node.value = option.id; node.textContent = option.label; select.append(node); } itemPrevious.disabled = itemPage === 0; itemNext.disabled = !hasNext; };
    const searchButton = button(copy.search, () => { itemQuery = search.value; itemPage = 0; void loadItems().catch(() => { status.textContent = copy.relatedError; }); });
    const itemPrevious = button(copy.previous, () => { if (itemPage > 0) { itemPage--; void loadItems(); } });
    const itemNext = button(copy.next, () => { if (hasNext) { itemPage++; void loadItems(); } });
    const addItem = button(copy.addLine, () => { const amount = Number(quantity.value), option = select.selectedOptions[0]; if (!option || !Number.isFinite(amount) || amount <= 0 || lines.some(line => line.itemId === option.value)) { status.textContent = copy.failed; return; } lines.push({ itemId: option.value, quantity: amount, label: option.textContent ?? option.value }); quantity.value = ''; renderLines(); });
    picker.append(search, searchButton, itemLabel, quantityLabel, addItem, itemPrevious, itemNext, selected); form.append(picker);
    const save = document.createElement('button'); save.type = 'submit'; save.textContent = copy.save;
    form.append(save, button(copy.cancel, () => { stopEditor(); editor.replaceChildren(); editor.hidden = true; transact.focus(); }));
    form.addEventListener('submit', event => { event.preventDefault(); if (busy || disposed || !lines.length) return;
      const values = Object.fromEntries([...inputs].map(([key, input]) => [key, input.value])); setBusy(true); status.textContent = copy.loading;
      void controller.transact(values, lines.map(({ itemId, quantity: amount }) => ({ itemId, quantity: amount }))).then(() => { if (!disposed) { stopEditor(); editor.hidden = true; setBusy(false); status.textContent = copy.saved; void load(); } })
        .catch((error: unknown) => { if (!disposed) { if (controller.closed()) clear(); setBusy(false); status.textContent = failure(error); } });
    });
    editor.append(form); void loadItems().catch(() => { status.textContent = copy.relatedError; }); inputs.values().next().value?.focus();
  }
  function openEditor(row?: Record<string, unknown>) {
    if (disposed || busy) return;
    stopEditor(); editor.replaceChildren(); editor.hidden = false;
    const form = document.createElement('form'); const inputs = new Map<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>();
    for (const field of controller.table.fields) {
      if (controller.table.workflow?.fieldId === field.id || controller.table.organizationFieldId === field.id || field.formula) continue;
      const label = document.createElement('label'); label.textContent = field.name;
      let input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      let reference: ReturnType<typeof createApplicationReferenceInput> | undefined;
      if (row && controller.table.stockLocations && [controller.table.stockLocations.itemFieldId, controller.table.stockLocations.locationFieldId].includes(field.id)) {
        const fixed = document.createElement('input'); fixed.readOnly = true; input = fixed;
      } else if (field.type === 'reference') {
        reference = createApplicationReferenceInput(field, typeof row?.[field.key] === 'string' ? row[field.key] as string : '', controller, copy, () => { clear(); status.textContent = copy.error; });
        references.push(reference); input = reference.input;
      } else if (field.type === 'enum' || field.type === 'boolean') {
        const select = document.createElement('select');
        const options = field.type === 'boolean' ? [['', copy.unset], ['true', copy.yes], ['false', copy.no]] : [['', copy.unset], ...(field.options ?? []).map(value => [value, value])];
        for (const [value, text] of options) { const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option); } input = select;
      } else if (field.type === 'json') { input = document.createElement('textarea'); input.maxLength = 20_000; }
      else { const text = document.createElement('input'); text.type = field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'datetime' ? 'datetime-local' : 'text'; if (field.type === 'number' || field.type === 'datetime') text.step = 'any'; text.maxLength = 20_000; input = text; }
      if (controller.table.counter?.fieldId === field.id && input instanceof HTMLInputElement) { input.readOnly = true; if (!row) input.value = String(controller.table.counter.minimum); }
      input.name = field.key; input.required = field.required && (!!row || field.defaultValue === undefined);
      const value = row?.[field.key];
      if (value !== undefined && value !== null) {
        if (field.type === 'datetime') {
          const date = new Date(String(value));
          if (Number.isFinite(date.getTime())) input.value = new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, -1);
        } else input.value = field.type === 'json' ? JSON.stringify(value) : String(value);
      }
      label.append(input); form.append(label); if (reference) form.append(reference.controls); inputs.set(field.key, input);
    }
    if (!row && controller.table.booking) {
      const availability = document.createElement('p'); availability.setAttribute('role', 'status');
      form.addEventListener('input', () => { availability.textContent = ''; });
      form.addEventListener('change', () => { availability.textContent = ''; });
      form.append(button(bookingCopy.check, () => {
        if (busy || disposed) return;
        const values = Object.fromEntries([...inputs].map(([key, input]) => [key, input.value]));
        setBusy(true); availability.textContent = copy.loading;
        void controller.bookingAvailable(values).then(free => {
          if (!disposed) { setBusy(false); availability.textContent = free ? bookingCopy.free : bookingCopy.taken; }
        }).catch((error: unknown) => {
          if (!disposed) { if (controller.closed()) clear(); setBusy(false); availability.textContent = ''; status.textContent = failure(error); }
        });
      }), availability);
    }
    if (!row && controller.table.booking?.waitlistStatus) {
      const rule = controller.table.booking, key = controller.table.fields.find(field => field.id === rule.statusFieldId)!.key;
      form.append(button(bookingCopy.wait, () => {
        if (busy) return;
        const state = inputs.get(key); if (state) { state.value = rule.waitlistStatus!; status.textContent = bookingCopy.note; }
      }));
      const note = document.createElement('p'); note.textContent = bookingCopy.note; form.append(note);
    }
    let repeatControls: { enabled: HTMLInputElement; count: HTMLInputElement; interval: HTMLInputElement; frequency: HTMLSelectElement } | undefined;
    if (!row && controller.table.booking?.recurrence) {
      const rule = controller.table.booking.recurrence, fieldset = document.createElement('fieldset');
      const label = document.createElement('label'), enabled = document.createElement('input'); enabled.type = 'checkbox'; label.append(enabled, document.createTextNode(recurrenceCopy.enable)); fieldset.append(label);
      const controls = document.createElement('fieldset'); controls.hidden = true; controls.disabled = true;
      const note = document.createElement('p'); note.textContent = `${recurrenceCopy.note} ${rule.timeZone}`; controls.append(note);
      const number = (name: string, initial: number, maximum: number) => {
        const label = document.createElement('label'); label.textContent = name;
        const input = document.createElement('input'); input.type = 'number'; input.min = name === recurrenceCopy.count ? '2' : '1'; input.max = String(maximum); input.step = '1'; input.value = String(initial); label.append(input); controls.append(label); return input;
      };
      const count = number(recurrenceCopy.count, Math.min(4, rule.maxOccurrences), rule.maxOccurrences), interval = number(recurrenceCopy.interval, 1, 12);
      const frequencyLabel = document.createElement('label'); frequencyLabel.textContent = recurrenceCopy.frequency;
      const frequency = document.createElement('select');
      for (const [value, text] of [['daily', recurrenceCopy.daily], ['weekly', recurrenceCopy.weekly]]) { const option = document.createElement('option'); option.value = value; option.textContent = text; frequency.append(option); }
      frequency.value = 'weekly'; frequencyLabel.append(frequency); controls.append(frequencyLabel); fieldset.append(controls); form.append(fieldset);
      enabled.addEventListener('change', () => { controls.hidden = !enabled.checked; controls.disabled = !enabled.checked; count.required = enabled.checked; interval.required = enabled.checked; });
      repeatControls = { enabled, count, interval, frequency };
    }
    const save = document.createElement('button'); save.type = 'submit'; save.textContent = copy.save;
    const cancel = button(copy.cancel, () => { stopEditor(); editor.replaceChildren(); editor.hidden = true; add.focus(); }); form.append(save, cancel);
    form.addEventListener('submit', event => {
      event.preventDefault(); if (busy || disposed) return;
      const values = Object.fromEntries([...inputs].map(([key, input]) => [key, input.value])); setBusy(true); status.textContent = copy.loading;
      const operation = row ? controller.update(String(row.id), values) : repeatControls?.enabled.checked
        ? controller.recur(values, { count: Number(repeatControls.count.value), interval: Number(repeatControls.interval.value), frequency: repeatControls.frequency.value }) : controller.create(values);
      void operation.then(() => { if (!disposed) { stopEditor(); editor.hidden = true; setBusy(false); status.textContent = copy.saved; void load(); } }).catch((error: unknown) => { if (!disposed) { if (controller.closed()) clear(); else body.replaceChildren(); setBusy(false); status.textContent = failure(error); } });
    });
    editor.append(form); for (const reference of references) void reference.load(); inputs.values().next().value?.focus();
  }
  void load();
  return () => { disposed = true; sequence++; controller.dispose(); clear(); root.replaceChildren(); };
}
