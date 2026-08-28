import { BookOpen } from 'lucide-react';
import { ToolModule } from '../types';
import { toolRegistry } from '../registry';
import DocumentAITool from './DocumentAITool';

const module: ToolModule = {
  id: 'document-ai',
  name: 'Document AI',
  description: 'Summarize, analyze, extract data, and answer questions about any document.',
  category: 'business',
  status: 'active',
  tier: 'premium',
  version: '2.0.0',
  icon: BookOpen,
  component: DocumentAITool,
  defaultModel: 'gpt-4o',
};

toolRegistry.register(module);
export default module;
