import { FileText } from 'lucide-react';
import { ToolModule } from '../types';
import { toolRegistry } from '../registry';
import CVBuilderComponent from './CVBuilderTool';

const module: ToolModule = {
  id: 'cv-builder',
  name: 'AI CV Builder',
  description: 'Create ATS-friendly resumes with AI-powered optimization.',
  category: 'career',
  status: 'active',
  tier: 'free',
  version: '2.0.0',
  icon: FileText,
  component: CVBuilderComponent,
  defaultModel: 'gpt-4o',
};

toolRegistry.register(module);
export default module;
