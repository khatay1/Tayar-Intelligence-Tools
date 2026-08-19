import { Globe } from 'lucide-react';
import { toolRegistry } from '../registry';
import WebsiteBuilderTool from './WebsiteBuilderTool';

toolRegistry.register({
  id: 'website-builder',
  name: 'Website Builder',
  description: 'Create, customize and preview modern websites with AI.',
  category: 'business',
  status: 'beta',
  tier: 'free',
  version: '1.0.0',
  icon: Globe,
  component: WebsiteBuilderTool,
});


