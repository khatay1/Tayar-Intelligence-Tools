import { lazy } from 'react';
import { MessagesSquare } from 'lucide-react';
import { toolRegistry } from '../registry';
// Build visibility is an additional guard. The server scope flag independently
// denies every operation until an authorized operator explicitly enables it.
if (import.meta.env.VITE_SOCIAL_HUB_ENABLED === 'true') {
  toolRegistry.register({ id: 'social-hub', name: 'Social Media Hub',
    description: 'Manage connected business conversations in an isolated team inbox.',
    category: 'business', status: 'beta', tier: 'premium', version: '0.1.0', icon: MessagesSquare,
    component: lazy(() => import('./SocialHubTool')) });
}
