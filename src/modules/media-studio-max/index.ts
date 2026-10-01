import { lazy } from 'react';
import { Video } from 'lucide-react';
import type { ToolModule } from '../types';
import { toolRegistry } from '../registry';

const MediaStudioMax = lazy(() => import('./MediaStudioMax'));

const module: ToolModule = {
  id: 'media-studio-max',
  name: 'Media Studio MAX',
  description: 'Convert, edit, compress and transform video, audio, GIFs and frames locally in the browser.',
  category: 'images',
  status: 'active',
  tier: 'free',
  version: '1.0.0',
  icon: Video,
  component: MediaStudioMax,
};

toolRegistry.register(module);
export default module;
