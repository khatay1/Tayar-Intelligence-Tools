import { supabase } from '@/lib/supabase';
import { createEmptyCV } from '@/lib/cv-types';

export async function seedSampleContent(userId: string, fullName: string, userType: string): Promise<void> {
  try {
    // 1. Create a sample resume project
    const sampleCV = createEmptyCV();
    sampleCV.personal.fullName = fullName || 'Demo User';
    sampleCV.personal.jobTitle = userType === 'student' ? 'Computer Science Student' : 'Software Engineer';
    sampleCV.personal.email = 'demo@example.com';
    sampleCV.personal.phone = '+1 234 567 890';
    sampleCV.personal.address = 'Stockholm, Sweden';
    sampleCV.personal.linkedin = 'linkedin.com/in/demo';
    sampleCV.summary = 'Results-driven professional with 3+ years of experience in software development. Passionate about building scalable solutions and collaborating with cross-functional teams.';
    sampleCV.experience = [
      {
        id: 'exp1', jobTitle: 'Software Engineer', company: 'Tech Corp', location: 'Stockholm',
        startDate: 'Jan 2022', endDate: 'Present', current: true,
        description: 'Led development of a microservices architecture serving 100K+ daily users. Improved API response times by 40% through optimization.',
      },
    ];
    sampleCV.education = [
      { id: 'edu1', degree: 'B.Sc. Computer Science', institution: 'KTH Royal Institute', location: 'Stockholm', startDate: '2018', endDate: '2021', description: '' },
    ];
    sampleCV.skills = [
      { id: 's1', name: 'JavaScript', level: 'Advanced' },
      { id: 's2', name: 'React', level: 'Advanced' },
      { id: 's3', name: 'Python', level: 'Intermediate' },
      { id: 's4', name: 'SQL', level: 'Intermediate' },
      { id: 's5', name: 'Git', level: 'Advanced' },
    ];
    sampleCV.languages = [
      { id: 'l1', name: 'English', proficiency: 'Fluent' },
      { id: 'l2', name: 'Arabic', proficiency: 'Native' },
      { id: 'l3', name: 'Swedish', proficiency: 'Conversational' },
    ];

    const { data: cvProject } = await supabase
      .from('projects')
      .insert({
        user_id: userId,
        title: `${fullName || 'My'} First Resume`,
        type: 'cv',
        content: { cv: sampleCV, template: 'modern', colorTheme: 'violet', fontId: 'inter' },
        status: 'draft',
      })
      .select('id')
      .single();

    if (cvProject) {
      await supabase.from('workspace_files').insert({
        user_id: userId,
        project_id: cvProject.id,
        name: `${fullName || 'My'} First Resume.pdf`,
        type: 'cv',
        status: 'completed',
        favorite: true,
        data: {},
      });
    }

    // 2. Create a sample cover letter project
    const sampleCoverLetter = `Dear Hiring Manager,

I am writing to express my strong interest in the Software Engineer position at your company. With over 3 years of experience in full-stack development and a passion for building scalable solutions, I am confident in my ability to contribute meaningfully to your team.

In my current role at Tech Corp, I led the development of a microservices architecture that serves over 100,000 daily users. I improved API response times by 40% through strategic optimization and collaborated closely with cross-functional teams to deliver features ahead of schedule.

I am particularly drawn to your company's commitment to innovation and would welcome the opportunity to discuss how my skills in JavaScript, React, and Python align with your needs.

Thank you for your consideration. I look forward to hearing from you.

Best regards,
${fullName || 'Demo User'}`;

    const { data: clProject } = await supabase
      .from('projects')
      .insert({
        user_id: userId,
        title: 'Sample Cover Letter',
        type: 'cover-letter',
        content: { text: sampleCoverLetter },
        status: 'draft',
      })
      .select('id')
      .single();

    if (clProject) {
      await supabase.from('workspace_files').insert({
        user_id: userId,
        project_id: clProject.id,
        name: 'Sample Cover Letter.pdf',
        type: 'cover-letter',
        status: 'completed',
        favorite: false,
        data: {},
      });
    }

    // 3. Create a sample AI conversation with messages
    const { data: conversation } = await supabase
      .from('ai_conversations')
      .insert({
        user_id: userId,
        tool: 'ai-chat',
        title: 'Welcome to AI Chat',
        model: 'gpt-4o-mini',
      })
      .select('id')
      .single();

    if (conversation) {
      await supabase.from('ai_messages').insert([
        {
          conversation_id: conversation.id,
          user_id: userId,
          role: 'user',
          content: 'What can you help me with in Tayar Intelligence?',
        },
        {
          conversation_id: conversation.id,
          user_id: userId,
          role: 'assistant',
          content: `Welcome to Tayar Intelligence! I'm your AI assistant and I can help you with:\n\n• **Writing** — articles, emails, cover letters, and blog posts\n• **CV Builder** — create ATS-friendly resumes with AI suggestions\n• **Translation** — translate documents between 30+ languages\n• **Document Analysis** — summarize and extract insights from any file\n• **Study Assistant** — generate quizzes, flashcards, and study guides\n\nJust ask me anything, or pick a tool from the sidebar to get started!`,
        },
      ]);
    }

    // 4. Log activity
    await supabase.from('activity_log').insert([
      { user_id: userId, action: 'Created sample resume', tool: 'cv-builder' },
      { user_id: userId, action: 'Created sample cover letter', tool: 'cover-letter' },
      { user_id: userId, action: 'Welcome to Tayar Intelligence!', tool: 'onboarding' },
    ]);
  } catch (err) {
    console.error('Failed to seed sample content:', err);
  }
}
