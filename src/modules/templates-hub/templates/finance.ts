import { TayarTemplate } from '../template-types';

export const FINANCE_TEMPLATES: TayarTemplate[] = [
  {
    id: 'small-business-cash-flow',
    name: 'Small Business Cash Flow',
    description: 'Track opening balance, money in, money out and closing balance by period.',
    category: 'finance',
    columns: ['Period', 'Opening Balance', 'Cash In', 'Cash Out', 'Closing Balance', 'Notes'],
    sampleRows: [
      ['January', '', '', '', '', ''],
      ['February', '', '', '', '', ''],
      ['March', '', '', '', '', ''],
    ],
    tags: ['cash flow', 'business', 'finance'],
  },
  {
    id: 'personal-budget',
    name: 'Simple Personal Budget',
    description: 'Compare planned and actual spending across household categories.',
    category: 'finance',
    columns: ['Category', 'Planned', 'Actual', 'Difference', 'Notes'],
    sampleRows: [
      ['Housing', '', '', '', ''],
      ['Food', '', '', '', ''],
      ['Transport', '', '', '', ''],
      ['Savings', '', '', '', ''],
    ],
    tags: ['budget', 'personal finance'],
  },
  {
    id: 'profit-loss',
    name: 'Profit & Loss Starter',
    description: 'Organize revenue and expense accounts into a simple P&L input sheet.',
    category: 'finance',
    columns: ['Account', 'Type', 'Month 1', 'Month 2', 'Month 3', 'Notes'],
    sampleRows: [
      ['Product revenue', 'Revenue', '', '', '', ''],
      ['Service revenue', 'Revenue', '', '', '', ''],
      ['Cost of goods', 'Expense', '', '', '', ''],
      ['Operating expenses', 'Expense', '', '', '', ''],
    ],
    tags: ['p&l', 'accounting', 'profit'],
  },
  {
    id: 'business-trip-budget',
    name: 'Business Trip Budget',
    description: 'Plan and review travel costs without hidden formulas or macros.',
    category: 'finance',
    columns: ['Expense', 'Planned', 'Actual', 'Currency', 'Receipt', 'Notes'],
    sampleRows: [
      ['Transport', '', '', '', '', ''],
      ['Hotel', '', '', '', '', ''],
      ['Meals', '', '', '', '', ''],
      ['Other', '', '', '', '', ''],
    ],
    tags: ['travel', 'budget', 'expenses'],
  },
];
