import { TayarTemplate } from '../template-types';

export const BUSINESS_TEMPLATES: TayarTemplate[] = [
  {
    id: 'inventory-list',
    name: 'Inventory List',
    description: 'A clean stock list for SKUs, quantities, reorder levels and unit costs.',
    category: 'business',
    columns: ['SKU', 'Item', 'Category', 'Quantity', 'Reorder Level', 'Unit Cost', 'Location', 'Notes'],
    sampleRows: [
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
    ],
    tags: ['inventory', 'stock', 'operations'],
  },
  {
    id: 'online-sales-tracker',
    name: 'Online Sales Tracker',
    description: 'Track orders, sales channels, fees and net sales in one table.',
    category: 'business',
    columns: ['Date', 'Order ID', 'Channel', 'Product', 'Quantity', 'Gross Sales', 'Fees', 'Net Sales'],
    sampleRows: [
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
    ],
    tags: ['sales', 'ecommerce', 'orders'],
  },
  {
    id: 'leads-tracker',
    name: 'Leads Management Tracker',
    description: 'Track sales leads, value, stage, owner and the next action.',
    category: 'business',
    columns: ['Lead', 'Company', 'Source', 'Stage', 'Value', 'Owner', 'Next Action', 'Follow-up Date'],
    sampleRows: [
      ['', '', '', 'New', '', '', '', ''],
      ['', '', '', 'Qualified', '', '', '', ''],
    ],
    tags: ['crm', 'leads', 'sales'],
  },
  {
    id: 'timesheet',
    name: 'Work Timesheet',
    description: 'Record work time by employee, project and date.',
    category: 'business',
    columns: ['Date', 'Employee', 'Project', 'Start', 'End', 'Break Minutes', 'Hours', 'Notes'],
    sampleRows: [
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
    ],
    tags: ['time', 'hr', 'project'],
  },
];
