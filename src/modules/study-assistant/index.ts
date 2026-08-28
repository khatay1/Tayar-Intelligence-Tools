import { GraduationCap } from 'lucide-react';
import { ToolModule } from '../types';
import { toolRegistry } from '../registry';
import StudyAssistantTool from './StudyAssistantTool';

const module: ToolModule = {
  id: 'study-assistant',
  name: 'Study Assistant',
  description: 'Explain concepts, create quizzes, flashcards, and personalized study plans.',
  category: 'study',
  status: 'active',
  tier: 'free',
  version: '2.0.0',
  icon: GraduationCap,
  component: StudyAssistantTool,
  defaultModel: 'gpt-4o',
};

toolRegistry.register(module);
export default module;
