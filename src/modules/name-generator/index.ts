import { lazy } from 'react';
import { Wand2 } from 'lucide-react';
import { ToolModule } from '../types';
import { toolRegistry } from '../registry';
const NameGeneratorTool = lazy(() => import('./NameGeneratorTool'));

const module: ToolModule = {
  id: 'name-generator',
  name: 'Name Generator',
  description: 'Generate original business, product, brand, YouTube and Instagram name ideas.',
  category: 'business',
  status: 'active',
  tier: 'free',
  version: '1.0.0',
  icon: Wand2,
  component: NameGeneratorTool,
};

toolRegistry.register(module);
export default module;
