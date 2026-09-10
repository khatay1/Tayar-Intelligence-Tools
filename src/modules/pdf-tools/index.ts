import { lazy } from 'react';
import { FileStack } from 'lucide-react';
import { ToolModule } from '../types';
import { toolRegistry } from '../registry';
const PdfToolsTool = lazy(() => import('./PdfToolsTool'));

const module: ToolModule = {
  id: 'pdf-tools',
  name: 'PDF Studio',
  description: 'Organize, edit, convert and optimize PDF files locally with 16 focused tools.',
  category: 'productivity',
  status: 'active',
  tier: 'free',
  version: '1.0.0',
  icon: FileStack,
  component: PdfToolsTool,
};

toolRegistry.register(module);
export default module;
