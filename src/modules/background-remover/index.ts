import { lazy } from 'react';
import { Eraser } from 'lucide-react';
import { ToolModule } from '../types';
import { toolRegistry } from '../registry';
const BackgroundRemoverTool = lazy(() => import('./BackgroundRemoverTool'));

const module: ToolModule = {
  id: 'background-remover',
  name: 'Background Remover',
  description: 'Remove image backgrounds privately with local in-browser AI. Image pixels stay on the user’s device.',
  category: 'images',
  status: 'beta',
  tier: 'free',
  version: '1.1.0',
  icon: Eraser,
  component: BackgroundRemoverTool,
};

toolRegistry.register(module);
export default module;
