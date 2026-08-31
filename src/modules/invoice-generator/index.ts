import { ReceiptText } from 'lucide-react';
import { ToolModule } from '../types';
import { toolRegistry } from '../registry';
import InvoiceGeneratorTool from './InvoiceGeneratorTool';

const module: ToolModule = {
  id: 'invoice-generator',
  name: 'Invoice Generator',
  description: 'Create professional invoices with automatic totals, VAT, draft saving and PDF printing.',
  category: 'business',
  status: 'active',
  tier: 'free',
  version: '1.0.0',
  icon: ReceiptText,
  component: InvoiceGeneratorTool,
};

toolRegistry.register(module);
export default module;
