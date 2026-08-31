import { FilePenLine } from 'lucide-react';
import { ToolModule } from '../types';
import { toolRegistry } from '../registry';
import LetterGeneratorTool from './LetterGeneratorTool';

const module: ToolModule = {
  id: 'letter-generator',
  name: 'Letter Generator',
  description: 'Create recommendation, authorization, business, complaint, resignation and thank-you letters.',
  category: 'writing',
  status: 'active',
  tier: 'free',
  version: '1.0.0',
  icon: FilePenLine,
  component: LetterGeneratorTool,
};

toolRegistry.register(module);
export default module;
