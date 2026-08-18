// Prompt templates for every AI tool in the platform.
// Each template is a function that returns a system prompt and a user prompt template.

export type ToolId =
  | 'cv-builder' | 'cover-letter' | 'ai-writer'
  | 'document-ai' | 'study-assistant' | 'translator' | 'ai-chat';

export interface PromptTemplate {
  system: string;
  user: (input: Record<string, unknown>) => string;
}

export const PROMPT_TEMPLATES: Record<ToolId, PromptTemplate> = {
  'cv-builder': {
    system: `You are an expert CV/resume writer and ATS optimization specialist.
You help users create professional, ATS-friendly resumes that get past automated screening systems.
Always use strong action verbs, quantify achievements with numbers, and structure content clearly.
Return ONLY the improved text — no explanations, no markdown, no preamble.
When rewriting experience bullets, return each bullet on its own line starting with a bullet character (•).`,
    user: (input) => {
      const action = input.action as string;
      if (action === 'generate') {
        return `Generate a complete professional CV for someone with the following details:
Name: ${input.fullName || '[Not provided]'}
Job Title: ${input.jobTitle || '[Not provided]'}
Years of Experience: ${input.years || '[Not provided]'}
Key Skills: ${input.skills || '[Not provided]'}
Target Industry: ${input.industry || '[Not provided]'}

Create a compelling CV with quantified achievements and ATS-optimized keywords.`;
      }
      if (action === 'improve-summary') {
        return `Improve this professional summary to be more impactful and ATS-friendly.
Current summary: "${input.summary}"
Job title: ${input.jobTitle || 'Professional'}
Return only the improved summary, 3-4 sentences.`;
      }
      if (action === 'improve-experience') {
        return `Improve this work experience bullet point to be more impactful.
Use strong action verbs and quantify results where possible.
Current: "${input.description}"
Job title: ${input.jobTitle || 'Professional'}
Return only the improved bullet point.`;
      }
      if (action === 'rewrite-experience') {
        return `Rewrite ALL work experience descriptions below to use strong action verbs, quantify achievements, and sound professional. Return ONLY the rewritten descriptions, one per experience entry, in the SAME ORDER. Use bullet points (•) for each achievement. Separate each experience with a blank line.

Experiences:
${JSON.stringify(input.experiences || [], null, 2)}

Return ONLY the rewritten text, no explanations.`;
      }
      if (action === 'improve-grammar') {
        return `Fix grammar, spelling, and clarity in the following resume text. Return ONLY the corrected text, no explanations.

Text:
${input.text || ''}
`;
      }
      if (action === 'shorten-text') {
        return `Make the following resume text more concise while keeping key information. Return ONLY the shortened text.

Text:
${input.text || ''}
`;
      }
      if (action === 'expand-text') {
        return `Expand the following resume text with more detail and context while keeping it professional. Return ONLY the expanded text.

Text:
${input.text || ''}
`;
      }
      if (action === 'generate-achievements') {
        return `Generate 3 quantified achievement bullet points for this role. Use realistic but plausible metrics. Return ONLY bullet points, each starting with •.

Job Title: ${input.jobTitle || 'Professional'}
Company: ${input.company || ''}
Current Description: ${input.description || ''}
Industry: ${input.industry || 'general'}
`;
      }
      if (action === 'suggest-skills') {
        return `Based on this resume, suggest 8-10 relevant skills that are commonly searched by ATS systems and recruiters. Return ONLY a comma-separated list of skill names, no explanations.

Job Title: ${input.jobTitle || 'Professional'}
Current Skills: ${Array.isArray(input.skills) ? input.skills.join(', ') : ''}
Experience: ${Array.isArray(input.experiences) ? input.experiences.map((e: { jobTitle: string; description: string }) => e.description).join(' ') : ''}
`;
      }
      if (action === 'optimize-ats') {
        return `Optimize this resume summary for ATS keyword matching. Return ONLY the optimized summary, 3-4 sentences.

Current Summary: ${input.summary || ''}
Job Title: ${input.jobTitle || 'Professional'}
Target Industry: ${input.industry || 'general'}
`;
      }
      if (action === 'match-job') {
        return `Analyze how well this resume matches the job description. Return a JSON object with:
- matchPercentage (0-100)
- missingSkills (array of strings)
- matchedKeywords (array of strings)
- suggestions (array of strings, 3-5 actionable tips)

Resume: ${JSON.stringify(input.cv || {})}
Job Description: ${input.jobDescription || ''}

Return ONLY valid JSON, no markdown.`;
      }
      if (action === 'generate-cover-letter') {
        return `Write a professional cover letter based on this resume. Return ONLY the cover letter text, 250-400 words, no explanations.

Resume Data: ${JSON.stringify(input.cv || {})}
Job Description (if provided): ${input.jobDescription || 'Not provided'}
Company: ${input.company || 'Not provided'}
`;
      }
      return `Help with CV building. Input: ${JSON.stringify(input)}`;
    },
  },

  'cover-letter': {
    system: `You are an expert cover letter writer.
You create personalized, compelling cover letters tailored to specific job postings.
Each cover letter should be concise (250-400 words), professional, and highlight relevant experience.
Never use generic templates — always customize based on the job and candidate details.`,
    user: (input) => {
      const action = input.action as string;
      if (action === 'generate') {
        return `Write a professional cover letter for the following position:
Job Title: ${input.jobTitle || '[Not provided]'}
Company: ${input.company || '[Not provided]'}
Candidate Name: ${input.name || '[Not provided]'}
Key Qualifications: ${input.qualifications || '[Not provided]'}
Why they want this job: ${input.motivation || '[Not provided]'}

Write a compelling, personalized cover letter (250-400 words).`;
      }
      if (action === 'improve') {
        return `Improve this cover letter to be more compelling and professional:
"${input.content}"
Make it more concise and impactful while keeping the key points.`;
      }
      return `Help with cover letter writing. Input: ${JSON.stringify(input)}`;
    },
  },

  'ai-writer': {
    system: `You are an expert content writer and copywriter.
You can write blog posts, articles, marketing copy, emails, social media content, and more.
Always match the requested tone, use clear structure with headings, and write engaging content.
Optimize for readability with short paragraphs and varied sentence lengths.`,
    user: (input) => {
      const action = input.action as string;
      if (action === 'generate') {
        return `Write a ${input.type || 'blog post'} about: "${input.topic}"
Tone: ${input.tone || 'professional'}
Length: ${input.length || 'medium'}
Target audience: ${input.audience || 'general'}
Key points to cover: ${input.points || 'N/A'}

Write engaging, well-structured content with clear headings.`;
      }
      if (action === 'improve') {
        return `Improve this content to be more engaging and well-structured:
"${input.content}"
Keep the same topic but enhance readability and impact.`;
      }
      return `Help with writing. Input: ${JSON.stringify(input)}`;
    },
  },

  'document-ai': {
    system: `You are an expert document analyst.
You can summarize documents, extract key information, answer questions about content,
and analyze structure. Always be accurate and cite specific details from the document.
When summarizing, capture the main points without losing important nuance.`,
    user: (input) => {
      const action = input.action as string;
      if (action === 'summarize') {
        return `Summarize the following document, capturing the key points and main conclusions.
Keep it concise but comprehensive (200-300 words):

${input.content}`;
      }
      if (action === 'extract') {
        return `Extract the following information from this document: ${input.fields || 'key data points'}

Document:
${input.content}

Return the extracted information in a clear, structured format.`;
      }
      if (action === 'analyze') {
        return `Analyze this document and provide insights on its structure, tone, key arguments, and any gaps:

${input.content}`;
      }
      if (action === 'qa') {
        return `Based on this document, answer the following question:
Question: ${input.question}

Document:
${input.content}`;
      }
      return `Analyze this document. Input: ${JSON.stringify(input)}`;
    },
  },

  'study-assistant': {
    system: `You are an expert tutor and study assistant.
You help students understand concepts, prepare for exams, create study plans,
and explain complex topics in simple terms. Always be encouraging and pedagogically sound.
Use examples and analogies to make concepts easier to grasp.`,
    user: (input) => {
      const action = input.action as string;
      if (action === 'explain') {
        return `Explain this concept in simple, easy-to-understand terms with examples:
Topic: ${input.topic}
Level: ${input.level || 'beginner'}

Use analogies and examples to make it clear.`;
      }
      if (action === 'quiz') {
        return `Create a practice quiz on this topic with ${input.count || 5} questions.
Include multiple choice questions with answers and explanations.
Topic: ${input.topic}
Difficulty: ${input.difficulty || 'medium'}`;
      }
      if (action === 'study-plan') {
        return `Create a study plan for:
Subject: ${input.subject}
Time available: ${input.time || '1 week'}
Goal: ${input.goal || 'general understanding'}
Current level: ${input.level || 'beginner'}

Create a day-by-day plan with specific activities.`;
      }
      if (action === 'flashcards') {
        return `Create ${input.count || 10} flashcards (question/answer pairs) for:
Topic: ${input.topic}

Format each as: Q: [question] A: [answer]`;
      }
      return `Help with studying. Input: ${JSON.stringify(input)}`;
    },
  },

  'translator': {
    system: `You are an expert translator fluent in over 100 languages.
You provide accurate, natural-sounding translations that preserve meaning, tone, and cultural context.
Always maintain the original formatting and structure. If the text contains technical terms,
translate them appropriately or keep them in the original language if that's standard practice.`,
    user: (input) => {
      const action = input.action as string;
      if (action === 'translate') {
        return `Translate the following text from ${input.from || 'auto-detect'} to ${input.to}.
Maintain the original tone and formatting.

Text to translate:
${input.text}`;
      }
      if (action === 'detect') {
        return `Detect the language of this text and provide a brief description:
${input.text}`;
      }
      return `Help with translation. Input: ${JSON.stringify(input)}`;
    },
  },

  'ai-chat': {
    system: `You are Tayar, a helpful AI assistant integrated into the Tayar Intelligence Tools platform.
You help users with questions about the platform, document creation, career advice, and general tasks.
Be concise, friendly, and helpful. When users ask about specific tools, guide them to use the right tool.`,
    user: (input) => {
      const message = input.message as string;
      return message || JSON.stringify(input);
    },
  },
};

// Prompt Manager — central registry for all prompts
export class PromptManager {
  private templates: Record<ToolId, PromptTemplate>;

  constructor(templates: Record<ToolId, PromptTemplate> = PROMPT_TEMPLATES) {
    this.templates = templates;
  }

  getTemplate(tool: ToolId): PromptTemplate {
    return this.templates[tool] || this.templates['ai-chat'];
  }

  getSystemPrompt(tool: ToolId): string {
    return this.getTemplate(tool).system;
  }

  buildUserPrompt(tool: ToolId, input: Record<string, unknown>): string {
    return this.getTemplate(tool).user(input);
  }

  buildMessages(
    tool: ToolId,
    input: Record<string, unknown>,
    history: Array<{ role: string; content: string }> = []
  ): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: this.getSystemPrompt(tool) },
    ];
    for (const msg of history) {
      messages.push({ role: msg.role, content: msg.content });
    }
    messages.push({ role: 'user', content: this.buildUserPrompt(tool, input) });
    return messages;
  }

  registerTemplate(tool: ToolId, template: PromptTemplate): void {
    this.templates[tool] = template;
  }

  listTools(): ToolId[] {
    return Object.keys(this.templates) as ToolId[];
  }
}

export const promptManager = new PromptManager();
