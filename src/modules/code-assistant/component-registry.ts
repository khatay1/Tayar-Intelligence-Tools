import { SEED_COMPONENTS } from './seed-components';
import { getRegistrySource, isRedistributableSource } from './source-catalog';
import { UIComponentCategory, UIComponentRecord } from './types';

class ComponentRegistry {
  private records = new Map<string, UIComponentRecord>();

  constructor(initial: UIComponentRecord[] = []) {
    initial.forEach((record) => this.register(record));
  }

  register(record: UIComponentRecord) {
    if (!isRedistributableSource(record.sourceId)) {
      throw new Error(`Registry source "${record.sourceId}" is not approved for redistribution.`);
    }
    const source = getRegistrySource(record.sourceId);
    if (!source) throw new Error(`Unknown registry source "${record.sourceId}".`);
    if (this.records.has(record.id)) throw new Error(`Duplicate component id "${record.id}".`);
    this.records.set(record.id, record);
  }

  all() {
    return Array.from(this.records.values());
  }

  get(id: string) {
    return this.records.get(id);
  }

  search(query: string, category: UIComponentCategory | 'all' = 'all') {
    const q = query.trim().toLowerCase();
    return this.all().filter((record) => {
      if (category !== 'all' && record.category !== category) return false;
      if (!q) return true;
      return [
        record.name,
        record.description,
        record.category,
        ...record.tags,
      ].some((value) => value.toLowerCase().includes(q));
    });
  }
}

export const componentRegistry = new ComponentRegistry(SEED_COMPONENTS);
