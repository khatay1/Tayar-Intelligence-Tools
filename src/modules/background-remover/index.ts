import { Eraser } from 'lucide-react';
import { ToolModule } from '../types';
import { toolRegistry } from '../registry';
import BackgroundRemoverTool from './BackgroundRemoverTool';

const module: ToolModule = {
  id: 'background-remover',
  name: 'Background Remover',
  description: 'Remove image backgrounds through Tayar’s secured server-side image utility.',
  category: 'images',
  status: 'active',
  tier: 'free',
  version: '1.0.0',
  icon: Eraser,
  component: BackgroundRemoverTool,
};

toolRegistry.register(module);
export default module;
