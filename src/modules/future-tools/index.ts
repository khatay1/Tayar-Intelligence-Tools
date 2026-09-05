import { FileSignature, Mailbox, BarChart3 } from 'lucide-react';
import { ToolModule } from '../types';
import { toolRegistry } from '../registry';
import FutureToolsView from './FutureToolsView';

// Future tools are registered with status 'soon' — they show in the dashboard
// but display a "Coming Soon" badge and aren't clickable.

const futureModules: ToolModule[] = [
  {
    id: 'email-writer',
    name: 'AI Email Writer',
    description: 'Write professional emails, replies, and newsletters.',
    category: 'business',
    status: 'soon',
    tier: 'free',
    version: '0.1.0',
    icon: Mailbox,
    component: FutureToolsView,
  },
  {
    id: 'contract-writer',
    name: 'Contract Writer',
    description: 'Generate legal contracts and agreements with AI.',
    category: 'business',
    status: 'soon',
    tier: 'premium',
    version: '0.1.0',
    icon: FileSignature,
    component: FutureToolsView,
  },
  {
    id: 'analytics-ai',
    name: 'Data Analytics AI',
    description: 'Analyze data, generate insights, and create visualizations.',
    category: 'business',
    status: 'soon',
    tier: 'premium',
    version: '0.1.0',
    icon: BarChart3,
    component: FutureToolsView,
  },
];

for (const mod of futureModules) {
  toolRegistry.register(mod);
}

export default futureModules;
