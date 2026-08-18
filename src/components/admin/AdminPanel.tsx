import { useState, useEffect } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAdmin } from '@/context/AdminContext';
import AdminLayout, { AdminView } from './AdminLayout';
import AdminDashboard from './AdminDashboard';
import AdminUsers from './AdminUsers';
import AdminAI from './AdminAI';
import AdminTools from './AdminTools';
import AdminSubscriptions from './AdminSubscriptions';
import AdminSupport from './AdminSupport';
import AdminContent from './AdminContent';
import AdminSystem from './AdminSystem';

interface AdminPanelProps {
  onExitToWorkspace: () => void;
}

export default function AdminPanel({ onExitToWorkspace }: AdminPanelProps) {
  const { user } = useAuth();
  const { isAdmin, adminLoading } = useAdmin();
  const [view, setView] = useState<AdminView>('dashboard');

  if (adminLoading) {
    return (
      <div className="min-h-screen bg-[#06060f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
          <p className="text-gray-400 text-sm">Checking admin access...</p>
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
          <h1 className="text-xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-gray-400 text-sm mb-6">You don't have permission to access the admin panel. Only administrators can view this page.</p>
          <button onClick={onExitToWorkspace} className="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 transition-colors">
            Back to Workspace
          </button>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout activeView={view} onViewChange={setView} onExitToWorkspace={onExitToWorkspace}>
      {view === 'dashboard' && <AdminDashboard />}
      {view === 'users' && <AdminUsers />}
      {view === 'ai' && <AdminAI />}
      {view === 'tools' && <AdminTools />}
      {view === 'subscriptions' && <AdminSubscriptions />}
      {view === 'support' && <AdminSupport />}
      {view === 'content' && <AdminContent />}
      {view === 'system' && <AdminSystem />}
    </AdminLayout>
  );
}
