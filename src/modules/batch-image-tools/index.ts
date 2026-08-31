import { Images } from 'lucide-react';
import { ToolModule } from '../types';
import { toolRegistry } from '../registry';
import BatchImageTool from './BatchImageTool';

const module: ToolModule = {
  id: 'batch-image-tools',
  name: 'Batch Image Converter',
  description: 'Resize and convert multiple images locally, with individual downloads or one ZIP.',
  category: 'images',
  status: 'active',
  tier: 'free',
  version: '1.0.0',
  icon: Images,
  component: BatchImageTool,
};

toolRegistry.register(module);
export default module;
