import { FileStack } from 'lucide-react';
import { ToolModule } from '../types';
import { toolRegistry } from '../registry';
import ImageToPdfTool from './ImageToPdfTool';

const module: ToolModule = {
  id: 'image-to-pdf',
  name: 'Image to PDF',
  description: 'Combine JPEG, PNG and WebP images into one local PDF with page ordering and size controls.',
  category: 'productivity',
  status: 'active',
  tier: 'free',
  version: '1.0.0',
  icon: FileStack,
  component: ImageToPdfTool,
};

toolRegistry.register(module);
export default module;
