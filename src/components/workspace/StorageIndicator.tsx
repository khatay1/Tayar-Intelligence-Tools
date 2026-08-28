// Storage Indicator — shows used storage with a progress bar.
// Prepares for future cloud storage integration.

import { useState, useEffect } from 'react';
import { HardDrive, Cloud } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

interface StorageData {
  usedMB: number;
  quotaMB: number;
  fileCount: number;
}

export function StorageIndicator({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const [data, setData] = useState<StorageData>({ usedMB: 0, quotaMB: 500, fileCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('projects')
      .select('content')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .then(({ data: rows }) => {
        const fileCount = rows?.length || 0;
        const usedBytes = JSON.stringify(rows || []).length;
        const usedMB = usedBytes / (1024 * 1024);
        setData({ usedMB, quotaMB: 500, fileCount });
        setLoading(false);
      });
  }, [user]);

  const percent = Math.min((data.usedMB / data.quotaMB) * 100, 100);
  const isLow = percent > 80;

  if (compact) {
    return (
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 mb-1.5">
          <HardDrive className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-gray-400 text-xs flex-1">Storage</span>
          <span className="text-gray-500 text-xs">{data.usedMB.toFixed(1)} MB</span>
        </div>
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isLow ? 'bg-amber-500' : 'bg-violet-500'}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
          {loading ? <HardDrive className="w-5 h-5 text-violet-400 animate-pulse" /> : <Cloud className="w-5 h-5 text-violet-400" />}
        </div>
        <div>
          <h3 className="text-white text-sm font-semibold">Storage</h3>
          <p className="text-gray-500 text-xs">{data.fileCount} files · {data.usedMB.toFixed(2)} MB used</p>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">{data.usedMB.toFixed(1)} MB</span>
          <span className="text-gray-600">{data.quotaMB} MB</span>
        </div>
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${isLow ? 'bg-gradient-to-r from-amber-600 to-orange-500' : 'bg-gradient-to-r from-violet-600 to-fuchsia-500'}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="text-gray-600 text-xs">
          {isLow ? 'Running low on storage. Upgrade to Pro for more space.' : `${(data.quotaMB - data.usedMB).toFixed(1)} MB available`}
        </p>
      </div>
    </div>
  );
}
