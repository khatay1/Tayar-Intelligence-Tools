import type { ApplicationField } from '../core/application-model';
import type { createApplicationDataViewController } from '../core/application-data-view-controller';

type Copy = { unset: string; search: string; previous: string; next: string; relatedError: string; refresh: string; loading: string };

/** Related rows remain transient. A missing/out-of-page saved ID is retained
 * without inventing a display name or silently selecting a different record. */
export function createApplicationReferenceInput(field: ApplicationField, selected: string,
  controller: ReturnType<typeof createApplicationDataViewController>, copy: Copy, onIdentityLoss: () => void) {
  const input = document.createElement('select');
  const controls = document.createElement('div'); controls.className = 'toolbar';
  const search = document.createElement('input'); search.type = 'search'; search.maxLength = 200;
  search.placeholder = copy.search; search.setAttribute('aria-label', `${copy.search}: ${field.name}`);
  const status = document.createElement('span'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const button = (label: string, action: () => void) => { const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.addEventListener('click', action); return button; };
  let page = 0, query = '', busy = false, disabled = false, disposed = false, sequence = 0, hasNext = false, searchable = false;
  const previous = button(copy.previous, () => { if (!busy && !disabled && page > 0) { page--; void load(); } });
  const next = button(copy.next, () => { if (!busy && !disabled && hasNext) { page++; void load(); } });
  const find = button(copy.search, () => { if (!busy && !disabled) { page = 0; query = search.value; void load(); } });
  const refresh = button(copy.refresh, () => { if (!busy && !disabled) void load(); });
  controls.append(search, find, refresh, previous, next, status);
  const options = (rows: Array<{ id: string; label: string }>, value: string) => {
    input.replaceChildren(); const empty = document.createElement('option'); empty.value = ''; empty.textContent = copy.unset; input.append(empty);
    if (value && !rows.some(row => row.id === value)) { const current = document.createElement('option'); current.value = value; current.textContent = value; input.append(current); }
    for (const row of rows) { const option = document.createElement('option'); option.value = row.id; option.textContent = row.label; input.append(option); }
    input.value = value;
  };
  options([], selected);
  function updateDisabled() {
    input.disabled = disabled || busy; search.disabled = disabled || busy || !searchable;
    find.disabled = disabled || busy || !searchable; refresh.disabled = disabled || busy;
    previous.disabled = disabled || busy || page === 0; next.disabled = disabled || busy || !hasNext;
  }
  async function load() {
    if (disposed || busy) return;
    const request = ++sequence, value = input.value; busy = true; status.textContent = copy.loading; updateDisabled();
    try {
      const result = await controller.referenceOptions(field.id, page, query);
      if (disposed || request !== sequence) return;
      options(result.options, value); hasNext = result.hasNext; searchable = result.searchable; status.textContent = '';
    } catch {
      if (disposed || request !== sequence) return;
      options([], value); hasNext = false; status.textContent = copy.relatedError;
      if (controller.closed()) onIdentityLoss();
    } finally { if (!disposed && request === sequence) { busy = false; updateDisabled(); } }
  }
  search.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); find.click(); }
  });
  updateDisabled();
  return { input, controls, load, setDisabled(value: boolean) { disabled = value; updateDisabled(); },
    dispose() { disposed = true; sequence++; options([], ''); controls.replaceChildren(); } };
}
