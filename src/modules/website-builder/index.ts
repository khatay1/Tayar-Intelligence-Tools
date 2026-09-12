import { lazy } from 'react';
import { Globe } from 'lucide-react';
import { toolRegistry } from '../registry';

const WebsiteBuilderTool = lazy(() => import('./WebsiteBuilderTool'));

toolRegistry.register({
  id: 'website-builder',
  name: 'Website Builder',
  description: 'Build, operate, audit and publish production-ready websites.',
  category: 'business',
  status: 'active',
  tier: 'free',
  version: '1.0.0',
  icon: Globe,
  component: WebsiteBuilderTool,
});
