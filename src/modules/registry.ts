import { createElement } from 'react';
import { ToolModule } from './types';
import ToolAccessGate from './shared/ToolAccessGate';

class ToolRegistryImpl {
  private tools = new Map<string, ToolModule>();

  register(module: ToolModule): void {
    if (this.tools.has(module.id)) {
      console.warn(`[ToolRegistry] Tool "${module.id}" is already registered, skipping.`);
      return;
    }

    const OriginalComponent = module.component;
    const fallbackPlan = module.id === 'team-workspace'
      ? 'business'
      : module.tier === 'premium'
        ? 'pro'
        : 'free';

    const GuardedComponent: ToolModule['component'] = (props) =>
      createElement(
        ToolAccessGate,
        { toolId: module.id, fallbackPlan },
        createElement(OriginalComponent, props),
      );

    GuardedComponent.displayName = `ToolAccessGate(${module.id})`;

    this.tools.set(module.id, {
      ...module,
      component: GuardedComponent,
    });
  }

  get(id: string): ToolModule | undefined {
    return this.tools.get(id);
  }

  all(): ToolModule[] {
    return Array.from(this.tools.values());
  }

  byCategory(category: string): ToolModule[] {
    return this.all().filter(t => t.category === category);
  }

  active(): ToolModule[] {
    return this.all().filter(t => t.status === 'active');
  }

  available(): ToolModule[] {
    return this.all().filter(t => t.status === 'active' || t.status === 'beta');
  }

  search(query: string): ToolModule[] {
    const q = query.toLowerCase().trim();
    if (!q) return this.all();
    return this.all().filter(
      t =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
    );
  }

  count(): number {
    return this.tools.size;
  }
}

export const toolRegistry = new ToolRegistryImpl();
