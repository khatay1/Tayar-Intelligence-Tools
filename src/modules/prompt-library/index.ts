import { Sparkles } from 'lucide-react';
import { ToolModule } from '../types';
import { toolRegistry } from '../registry';
import PromptLibraryTool from './PromptLibraryTool';

const module: ToolModule = {
  id: 'prompt-library',
  name: 'Prompt Library',
  description: 'Search and personalize original Tayar prompts for business, career, writing and social workflows.',
  category: 'productivity',
  status: 'active',
  tier: 'free',
  version: '1.0.0',
  icon: Sparkles,
  component: PromptLibraryTool,
};

toolRegistry.register(module);
export default module;
