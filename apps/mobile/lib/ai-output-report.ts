export type ReportableAiOutput = {
  id: string;
  tool: string;
  output: string;
  createdAt: number;
};

type Listener = (value: ReportableAiOutput | null) => void;

const MAX_LOCAL_OUTPUT = 12_000;
let sequence = 0;
let current: ReportableAiOutput | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener(current);
}

export function recordAiOutput(tool: string, output: string) {
  const text = output.trim();
  if (!text) return;

  current = {
    id: `${Date.now()}-${++sequence}`,
    tool: tool.trim() || 'ai',
    output: text.slice(0, MAX_LOCAL_OUTPUT),
    createdAt: Date.now(),
  };
  emit();
}

export function getReportableAiOutput() {
  return current;
}

export function subscribeAiOutput(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clearReportableAiOutput(id?: string) {
  if (!current || (id && current.id !== id)) return;
  current = null;
  emit();
}
