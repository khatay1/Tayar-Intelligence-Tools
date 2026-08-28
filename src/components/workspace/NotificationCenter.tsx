import { useLocalizer } from '@/lib/ui-localization';
import { Bell, Check, Trash2, BellOff } from 'lucide-react';
import { useNotifications } from '@/lib/use-notifications';

interface NotificationCenterProps {
  darkMode: boolean;
}

export default function NotificationCenter({ darkMode }: NotificationCenterProps) {
  const l = useLocalizer();
  const { notifications, unreadCount, markAsRead, markAllRead, deleteNotification, loading } = useNotifications();

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  return (
    <div className="w-80 max-w-[calc(100vw-2rem)]">
      <div className={`flex items-center justify-between px-4 py-3 border-b ${darkMode ? 'border-white/5' : 'border-gray-100'}`}>
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-violet-400" />
          <span className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{l('Notifications')}</span>
          {unreadCount > 0 && <span className="text-violet-400 text-xs">{unreadCount} new</span>}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="text-violet-400 text-xs hover:text-violet-300 transition-colors flex items-center gap-1">
            <Check className="w-3 h-3" /> Mark all read
          </button>
        )}
      </div>
      <div className="max-h-80 overflow-y-auto">
        {loading ? (
          <div className="py-8 text-center text-gray-500 text-sm">{l('Loading...')}</div>
        ) : notifications.length === 0 ? (
          <div className="py-8 text-center">
            <BellOff className="w-6 h-6 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-500 text-xs">{l('No notifications yet')}</p>
          </div>
        ) : (
          notifications.map(n => (
            <div
              key={n.id}
              className={`flex gap-3 px-4 py-3 border-b ${darkMode ? 'border-white/5' : 'border-gray-100'} last:border-0 hover:bg-white/5 transition-colors group ${!n.read ? 'bg-violet-600/5' : ''}`}
            >
              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!n.read ? 'bg-violet-500' : 'bg-gray-600'}`} />
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{n.title}</div>
                <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{n.message}</div>
                <div className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{timeAgo(n.created_at)}</div>
              </div>
              <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {!n.read && (
                  <button onClick={() => markAsRead(n.id)} className="text-gray-500 hover:text-violet-400" title="Mark as read">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={() => deleteNotification(n.id)} className="text-gray-500 hover:text-red-400" title="Delete">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
