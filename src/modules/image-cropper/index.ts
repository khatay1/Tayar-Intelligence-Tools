import { lazy } from 'react';
import { Crop } from 'lucide-react';
import { ToolModule } from '../types';
import { toolRegistry } from '../registry';
const ImageCropperTool = lazy(() => import('./ImageCropperTool'));

const module: ToolModule = {
  id: 'image-cropper',
  name: 'Image Cropper',
  description: 'Crop JPEG, PNG and WebP images locally with precise controls and aspect presets.',
  category: 'images',
  status: 'active',
  tier: 'free',
  version: '1.0.0',
  icon: Crop,
  component: ImageCropperTool,
};

toolRegistry.register(module);
export default module;
