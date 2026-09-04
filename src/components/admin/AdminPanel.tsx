import { useLocalizer } from '@/lib/ui-localization';
import { useState } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useAdmin } from '@/context/AdminContext';
import AdminLayout, { AdminView } from './AdminLayout';
import AdminDashboard from './AdminDashboard';
import AdminConfigurationCenter from './AdminConfigurationCenter';
import AdminUsers from './AdminUsers';
import AdminAI from './AdminAI';
import AdminTools from './AdminTools';
import AdminPlansV2 from './AdminPlansV2';
import AdminSubscriptions from './AdminSubscriptions';
import AdminSupport from './AdminSupport';
import AdminContent from './AdminContent';
import AdminSystem from './AdminSystem';

interface AdminPanelProps {
  onExitToWorkspace: () => void;
}

export default function AdminPanel({ onExitToWorkspace }: AdminPanelProps) {
  const l = useLocalizer();
  const { isAdmin, adminLoading, adminError, refreshAdminStatus } = useAdmin();
  const [view, setView] = useState<AdminView>('dashboard');

  if (adminLoading) {
    return (
      <div className="min-h-screen bg-[#06060f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
          <p className="text-gray-400 text-sm">{l('Checking admin access...')}</p>
        </div>
      </div>
    );
  }

  if (adminError) {
    return (
      <div className="min-h-screen bg-[#06060f] flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">{l('Admin access check failed')}</h1>
          <p className="text-gray-400 text-sm mb-5">{adminError}</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => void refreshAdminStatus()} className="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 transition-colors">
              {l('Retry')}
            </button>
            <button onClick={onExitToWorkspace} className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-300 border border-white/10 hover:bg-white/5 transition-colors">
              {l('Back to Workspace')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#06060f] flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">{l('Access Denied')}</h1>
          <p className="text-gray-400 text-sm mb-6">{l("You don't have permission to access the admin panel. Only active administrators can view this page.")}</p>
          <button onClick={onExitToWorkspace} className="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 transition-colors">
            {l('Back to Workspace')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout activeView={view} onViewChange={setView} onExitToWorkspace={onExitToWorkspace}>
      {view === 'dashboard' && <div className="space-y-6"><AdminConfigurationCenter onNavigate={setView} /><AdminDashboard /></div>}
      {view === 'users' && <AdminUsers />}
      {view === 'ai' && <AdminAI />}
      {view === 'tools' && <AdminTools />}
      {view === 'subscriptions' && <div className="space-y-6"><AdminPlansV2 onOpenTools={() => setView('tools')} /><AdminSubscriptions /></div>}
      {view === 'support' && <AdminSupport />}
      {view === 'content' && <AdminContent />}
      {view === 'system' && <AdminSystem />}
    </AdminLayout>
  );
}
