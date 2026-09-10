import { lazy } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { ToolModule } from '../types';
import { toolRegistry } from '../registry';
const CsvCleanerTool = lazy(() => import('./CsvCleanerTool'));

const module: ToolModule = {
  id: 'csv-cleaner',
  name: 'CSV Cleaner',
  description: 'Clean, normalize and safely export CSV data directly in your browser.',
  category: 'productivity',
  status: 'active',
  tier: 'free',
  version: '1.0.0',
  icon: FileSpreadsheet,
  component: CsvCleanerTool,
};

toolRegistry.register(module);
export default module;
