import { lazy } from 'react';
import { FileSignature, Mailbox, BarChart3 } from 'lucide-react';
import { ToolModule } from '../types';
import { toolRegistry } from '../registry';
const EmailWriterTool = lazy(() => import('./EmailWriterTool'));
const ContractWriterTool = lazy(() => import('./ContractWriterTool'));
const AnalyticsAITool = lazy(() => import('./AnalyticsAITool'));

const futureModules: ToolModule[] = [
  {
    id: 'email-writer',
    name: 'AI Email Writer',
    description: 'Compose, reply to, and improve professional emails with AI.',
    category: 'business',
    status: 'beta',
    tier: 'free',
    version: '1.0.0-beta.1',
    icon: Mailbox,
    component: EmailWriterTool,
  },
  {
    id: 'contract-writer',
    name: 'AI Contract Writer',
    description: 'Draft agreements, review contract risks, and improve clauses with AI.',
    category: 'business',
    status: 'beta',
    tier: 'premium',
    version: '1.0.0-beta.1',
    icon: FileSignature,
    component: ContractWriterTool,
  },
  {
    id: 'analytics-ai',
    name: 'AI Data Analytics',
    description: 'Profile CSV data locally and turn statistics into AI business insights.',
    category: 'business',
    status: 'beta',
    tier: 'premium',
    version: '1.0.0-beta.1',
    icon: BarChart3,
    component: AnalyticsAITool,
  },
];

for (const mod of futureModules) {
  toolRegistry.register(mod);
}

export default futureModules;
