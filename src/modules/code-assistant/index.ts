import { lazy } from 'react';
import { Code2 } from 'lucide-react';
import { ToolModule } from '../types';
import { toolRegistry } from '../registry';

const CodeAssistantTool = lazy(() => import('./CodeAssistantTool'));

const codeAssistantModule: ToolModule = {
  id: 'code-assistant',
  name: 'Coding Assistance',
  description: 'Build, inspect, adapt, and reuse UI components with AI-assisted workflows.',
  category: 'productivity',
  status: 'beta',
  tier: 'premium',
  version: '0.2.0',
  icon: Code2,
  component: CodeAssistantTool,
};

toolRegistry.register(codeAssistantModule);

export default codeAssistantModule;
