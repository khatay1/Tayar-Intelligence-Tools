import { Table2 } from 'lucide-react';
import { ToolModule } from '../types';
import { toolRegistry } from '../registry';
import TemplatesHubTool from './TemplatesHubTool';

const module: ToolModule = {
  id: 'templates-hub',
  name: 'Templates Hub',
  description: 'Original starter templates for finance, business and productivity workflows.',
  category: 'productivity',
  status: 'active',
  tier: 'free',
  version: '1.0.0',
  icon: Table2,
  component: TemplatesHubTool,
};

toolRegistry.register(module);
export default module;
