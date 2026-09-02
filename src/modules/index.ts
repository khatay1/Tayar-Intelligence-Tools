// Central module import — importing this file registers all tools.
// To add a new tool, create a module folder and add an import here.

import './cv-builder';
import './cover-letter';
import './writer';
import './translator';
import './document-ai';
import './study-assistant';
import './future-tools';
import './code-assistant';
import './website-builder';
import './team-workspace';
import './invoice-generator';
import './image-tools';
import './csv-cleaner';
import './templates-hub';
import './name-generator';
import './letter-generator';
import './prompt-library';
import './batch-image-tools';
import './image-cropper';
import './background-remover';
import './image-to-pdf';

export { toolRegistry } from './registry';
export { CATEGORIES, getCategory } from './categories';
export type { ToolModule, ToolCategory, ToolStatus, ToolTier, CategoryMeta } from './types';
