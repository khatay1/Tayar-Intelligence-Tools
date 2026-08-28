import { PenLine } from 'lucide-react';
import { ToolModule } from '../types';
import { toolRegistry } from '../registry';
import WriterTool from './WriterTool';

const module: ToolModule = {
  id: 'ai-writer',
  name: 'AI Writer',
  description: 'Write blogs, articles, marketing copy, and social media content.',
  category: 'writing',
  status: 'active',
  tier: 'free',
  version: '2.0.0',
  icon: PenLine,
  component: WriterTool,
  defaultModel: 'gpt-4o',
};

toolRegistry.register(module);
export default module;
