export type SocialProvider = 'whatsapp' | 'telegram' | 'messenger' | 'instagram';
export type ConversationStatus = 'open' | 'pending' | 'resolved' | 'spam';
export type ConversationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface SocialWorkspace {
  id: string;
  name: string;
  my_role: 'owner' | 'admin' | 'editor' | 'viewer';
}

export interface SocialConnection {
  id: string;
  provider: SocialProvider;
  displayName: string;
  status: 'disconnected' | 'pending' | 'connected' | 'degraded' | 'error' | 'revoked';
  lastErrorCode?: string | null;
  lastErrorAt?: string | null;
}

export interface SocialHubOverview {
  hub: { id: string; name: string; scope: 'customer' | 'tayar_official'; workspaceId: string | null };
  connections: SocialConnection[];
  counts: { open: number; unread: number; failed: number; pendingDrafts: number };
}

export interface SocialConversationSummary {
  id: string;
  status: ConversationStatus;
  priority: ConversationPriority;
  assignedTo: string | null;
  unreadCount: number;
  lastMessageAt: string;
  provider: SocialProvider;
  connectionName: string;
  contact: { id: string; displayName: string; lifecycle: string; tags: string[] };
  lastMessage: { id: string; direction: 'inbound' | 'outbound'; body: string; deliveryStatus: string; createdAt: string } | null;
}

export interface SocialMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  senderKind: 'contact' | 'agent' | 'automation' | 'ai';
  senderUserId: string | null;
  body: string;
  contentType: string;
  media: unknown[];
  deliveryStatus: string;
  failureCode: string | null;
  createdAt: string;
  sentAt: string | null;
}

export interface SocialConversationThread {
  conversation: {
    id: string;
    status: ConversationStatus;
    priority: ConversationPriority;
    assignedTo: string | null;
    provider: SocialProvider;
    connectionName: string;
  };
  contact: {
    id: string;
    displayName: string;
    email: string | null;
    phone: string | null;
    lifecycle: string;
    tags: string[];
    notes: string;
    assignedTo: string | null;
  };
  messages: SocialMessage[];
}

export interface SocialAutomation {
  id: string;
  name: string;
  enabled: boolean;
  triggerType: 'message_received' | 'conversation_opened' | 'keyword' | 'outside_hours';
  conditions: Record<string, unknown>;
  actionType: 'assign' | 'tag' | 'reply_template' | 'ai_draft' | 'ai_reply';
  actionConfig: Record<string, unknown>;
  aiRequiresApproval: boolean;
  updatedAt: string;
}

export const SOCIAL_PROVIDERS: Array<{ id: SocialProvider; label: string }> = [
  { id: 'whatsapp', label: 'WhatsApp Business' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'messenger', label: 'Facebook Messenger' },
  { id: 'instagram', label: 'Instagram' },
];
