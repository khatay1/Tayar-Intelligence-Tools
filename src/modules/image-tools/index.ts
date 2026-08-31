import { Image } from 'lucide-react';
import { ToolModule } from '../types';
import { toolRegistry } from '../registry';
import ImageToolsTool from './ImageToolsTool';

const module: ToolModule = {
  id: 'image-tools',
  name: 'Image Tools',
  description: 'Resize, compress and convert JPEG, PNG and WebP images locally in your browser.',
  category: 'images',
  status: 'active',
  tier: 'free',
  version: '1.0.0',
  icon: Image,
  component: ImageToolsTool,
};

toolRegistry.register(module);
export default module;
