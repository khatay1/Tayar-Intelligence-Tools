import { PromptTemplate } from './prompt-types';

export const MAX_VARIABLE_LENGTH = 500;

function bounded(value: string) {
  return value.trim().slice(0, MAX_VARIABLE_LENGTH);
}

export function personalizePrompt(
  template: PromptTemplate,
  variables: { topic: string; audience: string; goal: string },
) {
  return template.prompt
    .replace(/\{\{topic\}\}/g, bounded(variables.topic) || '[topic]')
    .replace(/\{\{audience\}\}/g, bounded(variables.audience) || '[audience]')
    .replace(/\{\{goal\}\}/g, bounded(variables.goal) || '[goal]');
}
