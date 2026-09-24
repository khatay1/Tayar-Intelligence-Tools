import { lazy } from 'react';
import { FileText } from 'lucide-react';
import { ToolModule } from '../types';
import { toolRegistry } from '../registry';
const CVBuilderComponent = lazy(() => import('./CVBuilderTool'));
const SavedCVProjectComponent = lazy(() => import('./SavedCVProjectTool'));

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

const savedCVRoute: ToolModule = {
  ...module,
  id: 'cv',
  name: 'Saved CV',
  description: 'Open an existing saved CV in the resume editor.',
  component: SavedCVProjectComponent,
};

toolRegistry.register(module);
toolRegistry.register(savedCVRoute);
export default module;
