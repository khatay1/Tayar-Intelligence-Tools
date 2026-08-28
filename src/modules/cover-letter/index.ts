import { Mail } from 'lucide-react';
import { ToolModule } from '../types';
import { toolRegistry } from '../registry';
import CoverLetterTool from './CoverLetterTool';

const module: ToolModule = {
  id: 'cover-letter',
  name: 'Cover Letter Writer',
  description: 'Craft personalized, compelling cover letters for any job.',
  category: 'career',
  status: 'active',
  tier: 'free',
  version: '2.0.0',
  icon: Mail,
  component: CoverLetterTool,
  defaultModel: 'gpt-4o',
};

toolRegistry.register(module);
export default module;
