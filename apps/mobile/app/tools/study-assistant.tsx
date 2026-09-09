import AiTextStudio from '@/components/AiTextStudio';

const modes = ['Explain', 'Summarize', 'Quiz', 'Flashcards'] as const;

export default function StudyAssistantScreen() {
  return (
    <AiTextStudio
      title="Study Assistant"
      subtitle="Explain, summarize and practice any topic without leaving the app."
      icon="school-outline"
      toolId="study-assistant"
      modes={modes}
      defaultMode="Explain"
      inputLabel={(mode) => mode === 'Explain' ? 'What should Tayar explain?' : mode === 'Summarize' ? 'Paste notes or study material' : 'Topic or study material'}
      placeholder={(mode) => mode === 'Explain'
        ? 'Paste a concept, question or difficult passage. Add your level if useful...'
        : mode === 'Summarize'
          ? 'Paste notes, a chapter excerpt or study material to condense...'
          : mode === 'Quiz'
            ? 'Enter the topic or notes. Tayar will create questions with answers...'
            : 'Enter a topic or notes. Tayar will turn them into concise Q/A flashcards...'}
      systemPrompt={(mode) => `You are Tayar Study Assistant. Mode: ${mode}. Be accurate, clear and educational. Adapt explanations to a practical learner. For Quiz, include a balanced set of questions followed by an answer key. For Flashcards, return compact Front/Back cards. Do not invent unsupported facts from supplied notes.`}
      userPrompt={(mode, input) => `Study mode: ${mode}\n\nMaterial or question:\n${input}`}
      actionLabel={(mode) => mode === 'Explain' ? 'Explain with AI' : mode === 'Summarize' ? 'Summarize' : mode === 'Quiz' ? 'Create Quiz' : 'Create Flashcards'}
      resultLabel="STUDY RESULT"
      maxTokens={3600}
      temperature={0.35}
    />
  );
}
