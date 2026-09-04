import { useState } from 'react';
import type { ViewId } from './workspace-config';
import FileManagerBase from './FileManager.base';
import CodeProjectImportCard from './CodeProjectImportCard';

interface FileManagerProps {
  onNavigate: (view: ViewId, projectId?: string) => void;
}

export default function FileManager(props: FileManagerProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-6">
      <CodeProjectImportCard
        onImported={(projectId) => {
          setRefreshKey((value) => value + 1);
          props.onNavigate('code-assistant', projectId);
        }}
      />
      <FileManagerBase key={refreshKey} {...props} />
    </div>
  );
}
