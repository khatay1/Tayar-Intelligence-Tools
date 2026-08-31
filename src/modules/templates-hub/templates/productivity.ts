import { TayarTemplate } from '../template-types';

export const PRODUCTIVITY_TEMPLATES: TayarTemplate[] = [
  {
    id: 'project-todo',
    name: 'Project To-Do List',
    description: 'Manage project tasks with owners, priority, status and deadlines.',
    category: 'productivity',
    columns: ['Task', 'Owner', 'Priority', 'Status', 'Start Date', 'Due Date', 'Notes'],
    sampleRows: [
      ['', '', 'High', 'Not started', '', '', ''],
      ['', '', 'Medium', 'Not started', '', '', ''],
      ['', '', 'Low', 'Not started', '', '', ''],
    ],
    tags: ['project', 'tasks', 'planning'],
  },
  {
    id: 'daily-planner',
    name: 'Daily Planner',
    description: 'Plan a day by time, task, category, priority and status.',
    category: 'productivity',
    columns: ['Time', 'Task', 'Category', 'Priority', 'Status', 'Notes'],
    sampleRows: [
      ['08:00', '', '', '', '', ''],
      ['10:00', '', '', '', '', ''],
      ['13:00', '', '', '', '', ''],
      ['15:00', '', '', '', '', ''],
    ],
    tags: ['planner', 'daily', 'schedule'],
  },
  {
    id: 'habit-log',
    name: 'Habit Tracking Log',
    description: 'A flexible row-based habit log that works cleanly in spreadsheets.',
    category: 'productivity',
    columns: ['Date', 'Habit', 'Completed', 'Value', 'Notes'],
    sampleRows: [
      ['', 'Read', 'No', '', ''],
      ['', 'Exercise', 'No', '', ''],
      ['', 'Drink water', 'No', '', ''],
    ],
    tags: ['habits', 'tracker', 'wellbeing'],
  },
];
