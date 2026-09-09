import AiTextStudio from '@/components/AiTextStudio';

const modes = ['Article', 'Marketing', 'Social', 'Rewrite'] as const;

export default function AIWriterScreen() {
  return (
    <AiTextStudio
      title="AI Writer"
      subtitle="Create polished long-form and marketing copy in a mobile-first workspace."
      icon="pen-plus"
      toolId="ai-writer"
      modes={modes}
      defaultMode="Article"
      inputLabel={(mode) => mode === 'Rewrite' ? 'Paste the text and describe how to improve it' : 'What should Tayar write?'}
      placeholder={(mode) => mode === 'Article'
        ? 'Topic, audience, key points, length, style and anything that must be included...'
        : mode === 'Marketing'
          ? 'Product or service, audience, offer, proof points, CTA and tone...'
          : mode === 'Social'
            ? 'Platform, idea, audience, message, CTA and desired style...'
            : 'Paste the source text and add the goal for the rewrite...'}
      systemPrompt={(mode) => `You are Tayar AI Writer. Mode: ${mode}. Produce useful, original, polished copy with strong structure and no filler. Keep formatting mobile-readable. Return only the finished content, not commentary about the writing process.`}
      userPrompt={(mode, input) => `Mode: ${mode}\n\nUser brief/source:\n${input}`}
      actionLabel={(mode) => mode === 'Rewrite' ? 'Rewrite with AI' : `Create ${mode}`}
      resultLabel="READY TO USE"
      maxTokens={3800}
      temperature={0.55}
    />
  );
}
