import { lazy } from 'react';
import { MessagesSquare } from 'lucide-react';
import type { ToolModule } from '../types';
import { toolRegistry } from '../registry';

const SocialHubTool = lazy(() => import('./SocialHubTool'));

const module: ToolModule = {
  id: 'social-hub',
  name: 'Social Hub',
  description: 'Manage WhatsApp, Telegram, Messenger and Instagram conversations in one secure inbox.',
  category: 'business',
  status: 'active',
  tier: 'premium',
  version: '1.0.0',
  icon: MessagesSquare,
  component: SocialHubTool,
};

toolRegistry.register(module);
export default module;
