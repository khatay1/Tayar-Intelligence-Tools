import { UsersRound } from 'lucide-react';
import { toolRegistry } from '../registry';
import TeamWorkspaceTool from './TeamWorkspaceTool';

toolRegistry.register({
  id: 'team-workspace',
  name: 'Team Workspace',
  description: 'Invite teammates, manage roles and collaborate on shared projects.',
  category: 'business',
  status: 'active',
  tier: 'premium',
  version: '1.0.0',
  icon: UsersRound,
  component: TeamWorkspaceTool,
});

export { TeamWorkspaceTool };
