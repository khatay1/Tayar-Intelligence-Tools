import { Languages } from 'lucide-react';
import { ToolModule } from '../types';
import { toolRegistry } from '../registry';
import TranslatorTool from './TranslatorTool';

const module: ToolModule = {
  id: 'translator',
  name: 'AI Translator',
  description: 'Translate between 100+ languages with natural, context-aware results.',
  category: 'productivity',
  status: 'active',
  tier: 'free',
  version: '2.0.0',
  icon: Languages,
  component: TranslatorTool,
  defaultModel: 'gpt-4o-mini',
};

toolRegistry.register(module);
export default module;
