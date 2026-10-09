import { ApplicationCounterRejected } from '../core/application-counter';
import { ApplicationTransactionRejected } from '../core/application-transaction';
import { ApplicationWorkflowRejected } from '../core/application-workflow';
import { createApplicationReferenceInput } from './application-reference-input';
import { ApplicationBookingRejected } from '../core/application-booking';
import type { Language } from '@/context/PreferencesContext';
import type { ApplicationDefinition, ApplicationField } from '../core/application-model';
import type { ApplicationDataViewBinding } from '../core/application-data-view';
import { createApplicationDataViewController } from '../core/application-data-view-controller';
import type { createApplicationDataRuntime } from '../core/application-data-runtime';

const translations = {
  en: { unavailable: 'The transaction is unavailable. Check the selected items and access.', transact: 'Create transaction', addLine: 'Add item', item: 'Item', quantity: 'Quantity', bounds: 'The change exceeds the allowed limits. Choose another amount.', adjust: 'Adjust quantity', delta: 'Change (+ / −)', relatedError: 'Could not load related records. Check access and try again.', conflict: 'This resource is already booked for that time. Choose another time.', interval: 'Booking end must be after start.', add: 'Add record', edit: 'Edit', remove: 'Delete', save: 'Save', cancel: 'Cancel', search: 'Search', refresh: 'Refresh', previous: 'Previous', next: 'Next', empty: 'No records found.', loading: 'Loading…', error: 'Could not load records. Sign in and try again.', failed: 'Could not save. Check your values and permissions. If the result is uncertain, retry with the same values.', saved: 'Saved.', removed: 'Deleted.', confirm: 'Delete this record permanently?', yes: 'Yes', no: 'No', unset: 'Select a value', actions: 'Actions', page: 'Page', readonly: 'Read only' },
  ar: { unavailable: 'المعاملة غير متاحة. تحقّق من العناصر المحددة والصلاحيات.', transact: 'إنشاء معاملة', addLine: 'إضافة عنصر', item: 'العنصر', quantity: 'الكمية', bounds: 'التغيير يتجاوز الحدود المسموحة. اختر كمية أخرى.', adjust: 'تغيير الكمية', delta: 'التغيير (+ / −)', relatedError: 'تعذّر تحميل السجلات المرتبطة. تحقّق من صلاحية الوصول وحاول مجددًا.', conflict: 'هذا المورد محجوز في الوقت المحدد. اختر وقتًا آخر.', interval: 'يجب أن يكون انتهاء الحجز بعد بدايته.', add: 'إضافة سجل', edit: 'تعديل', remove: 'حذف', save: 'حفظ', cancel: 'إلغاء', search: 'بحث', refresh: 'تحديث', previous: 'السابق', next: 'التالي', empty: 'لا توجد سجلات.', loading: 'جارٍ التحميل…', error: 'تعذّر تحميل السجلات. سجّل الدخول وحاول مجددًا.', failed: 'تعذّر الحفظ. تحقّق من القيم والصلاحيات. إذا كانت النتيجة غير مؤكدة، أعد المحاولة بالقيم نفسها.', saved: 'تم الحفظ.', removed: 'تم الحذف.', confirm: 'هل تريد حذف هذا السجل نهائيًا؟', yes: 'نعم', no: 'لا', unset: 'اختر قيمة', actions: 'الإجراءات', page: 'الصفحة', readonly: 'للقراءة فقط' },
  sv: { unavailable: 'Transaktionen är inte tillgänglig. Kontrollera valda poster och åtkomst.', transact: 'Skapa transaktion', addLine: 'Lägg till post', item: 'Post', quantity: 'Antal', bounds: 'Ändringen överskrider tillåtna gränser. Välj ett annat antal.', adjust: 'Ändra antal', delta: 'Ändring (+ / −)', relatedError: 'Kunde inte läsa relaterade poster. Kontrollera åtkomst och försök igen.', conflict: 'Resursen är redan bokad den tiden. Välj en annan tid.', interval: 'Bokningens slut måste vara efter starten.', add: 'Lägg till post', edit: 'Redigera', remove: 'Ta bort', save: 'Spara', cancel: 'Avbryt', search: 'Sök', refresh: 'Uppdatera', previous: 'Föregående', next: 'Nästa', empty: 'Inga poster hittades.', loading: 'Laddar…', error: 'Kunde inte läsa poster. Logga in och försök igen.', failed: 'Kunde inte spara. Kontrollera värden och behörigheter. Om resultatet är osäkert, försök igen med samma värden.', saved: 'Sparat.', removed: 'Borttaget.', confirm: 'Ta bort den här posten permanent?', yes: 'Ja', no: 'Nej', unset: 'Välj ett värde', actions: 'Åtgärder', page: 'Sida', readonly: 'Skrivskyddad' },
};

/** A native, isolated data component. All record values use textContent/value;
 * authored HTML, shared caches and platform credentials never render rows. */
export function mountApplicationDataView(host: HTMLElement, definition: ApplicationDefinition, binding: ApplicationDataViewBinding,
  runtime: ReturnType<typeof createApplicationDataRuntime>, language: Language, scope: { projectRef: string; projectId: string; pageId: string; sectionId: string }) {
  const copy = translations[language] ?? translations.en;
  const failure = (error: unknown) => error instanceof ApplicationBookingRejected ? copy[error.reason]
    : error instanceof ApplicationCounterRejected ? copy.bounds : error instanceof ApplicationTransactionRejected ? copy[error.reason]
      : error instanceof ApplicationWorkflowRejected ? copy.unavailable : copy.failed;
  const controller = createApplicationDataViewController(definition, binding, runtime, () => crypto.randomUUID(), {
    keyPrefix: `tayar-app-form:${scope.projectRef}:${scope.projectId}:${scope.pageId}:data:${scope.sectionId}`,
    storage: { getItem: key => sessionStorage.getItem(key), setItem: (key, value) => sessionStorage.setItem(key, value), removeItem: key => sessionStorage.removeItem(key) }, crypto,
  });
  const root = host.attachShadow({ mode: 'open' });
  let disposed = false, busy = false, sequence = 0, page = 0, query = '';
  let references: Array<ReturnType<typeof createApplicationReferenceInput>> = [];
  function stopEditor() { for (const reference of references) reference.dispose(); references = []; }
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
  view.append(title, toolbar, status, editor, scroll, empty, pager); root.append(style, view);
  function setBusy(value: boolean) {
    busy = value; view.setAttribute('aria-busy', String(value));
    for (const control of view.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement>('button,input,select,textarea')) control.disabled = value;
    for (const reference of references) reference.setDisabled(value);
  }
  function clear() { stopEditor(); body.replaceChildren(); empty.hidden = true; add.hidden = true; transact.hidden = true; editor.replaceChildren(); editor.hidden = true; previous.disabled = true; next.disabled = true; }
  async function load() {
    if (disposed || busy) return;
    const current = ++sequence; setBusy(true); status.textContent = copy.loading;
    try {
      const actions = await controller.permissions();
      const result = await controller.load(page, query);
      if (disposed || current !== sequence) return;
      clear(); add.hidden = !actions.includes('create') || actions.includes('transact'); transact.hidden = !actions.includes('transact'); actionsHeader.hidden = !actions.includes('update') && !actions.includes('delete') && !actions.includes('adjust') && !actions.includes('transition');
      for (const row of result.rows) {
        const tr = document.createElement('tr');
        for (const field of controller.columns) { const td = document.createElement('td'); td.textContent = display(row[field.key], field); tr.append(td); }
        const td = document.createElement('td'); td.hidden = actionsHeader.hidden;
        if (actions.includes('transition')) for (const transition of controller.workflowTransitions(row)) {
          td.append(button(transition.label, () => {
            if (busy) return; setBusy(true); status.textContent = copy.loading;
            void controller.transition(String(row.id), transition.id).then(() => { if (!disposed) { setBusy(false); status.textContent = copy.saved; void load(); } })
              .catch((error: unknown) => { if (!disposed) { if (controller.closed()) clear(); setBusy(false); status.textContent = failure(error); } });
          }));
        }
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
      if (controller.table.workflow?.fieldId === field.id) continue;
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
      if (controller.table.workflow?.fieldId === field.id) continue;
      const label = document.createElement('label'); label.textContent = field.name;
      let input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      let reference: ReturnType<typeof createApplicationReferenceInput> | undefined;
      if (field.type === 'reference') {
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
    const save = document.createElement('button'); save.type = 'submit'; save.textContent = copy.save;
    const cancel = button(copy.cancel, () => { stopEditor(); editor.replaceChildren(); editor.hidden = true; add.focus(); }); form.append(save, cancel);
    form.addEventListener('submit', event => {
      event.preventDefault(); if (busy || disposed) return;
      const values = Object.fromEntries([...inputs].map(([key, input]) => [key, input.value])); setBusy(true); status.textContent = copy.loading;
      const operation = row ? controller.update(String(row.id), values) : controller.create(values);
      void operation.then(() => { if (!disposed) { stopEditor(); editor.hidden = true; setBusy(false); status.textContent = copy.saved; void load(); } }).catch((error: unknown) => { if (!disposed) { if (controller.closed()) clear(); else body.replaceChildren(); setBusy(false); status.textContent = failure(error); } });
    });
    editor.append(form); for (const reference of references) void reference.load(); inputs.values().next().value?.focus();
  }
  void load();
  return () => { disposed = true; sequence++; controller.dispose(); clear(); root.replaceChildren(); };
}
