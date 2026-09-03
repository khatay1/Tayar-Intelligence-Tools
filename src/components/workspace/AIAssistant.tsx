import { useLocalizer } from '@/lib/ui-localization';
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles, X, Send, Loader2, MessageSquare, Trash2, Plus,
  FileText,
} from 'lucide-react';
import { createAIService } from '@/lib/ai/service';
import { getErrorInfo } from '@/lib/ai/error-handler';
import { useToast } from '@/components/ui/Toast';
import { AILoading, AIStreamingIndicator } from '@/components/ui/AILoading';
import { useWorkspace, ActiveContext } from '@/context/WorkspaceContext';
import { ViewId } from './workspace-config';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

const QUICK_PROMPTS = [
  'How do I improve my CV?',
  'What tools are available?',
  'Help me write a cover letter',
  'Tips for ATS optimization',
];

function renderMarkdown(text: string): string {
  // Escape the entire AI response first. Markdown formatting is applied only
  // after escaping so model/user supplied HTML can never execute in Tayar.
  let html = escapeHtml(text);
  html = html.replace(/```([\s\S]*?)```/g, (_, code) => `<pre class="bg-black/30 rounded-lg p-3 my-2 overflow-x-auto text-xs text-gray-300"><code>${code.trim()}</code></pre>`);
  html = html.replace(/`([^`]+)`/g, '<code class="bg-white/10 rounded px-1.5 py-0.5 text-xs text-violet-300">$1</code>');
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-white font-semibold text-sm mt-3 mb-1">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-white font-bold text-base mt-3 mb-1">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-white font-bold text-lg mt-3 mb-1">$1</h1>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em class="text-gray-300">$1</em>');
  html = html.replace(/^- (.+)$/gm, '<li class="text-gray-300 ml-4 list-disc">$1</li>');
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="text-gray-300 ml-4 list-decimal">$1</li>');
  html = html.replace(/\n/g, '<br/>');
  return html;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function contextLabel(ctx: ActiveContext): string {
  if (!ctx.type) return '';
  const labels: Record<string, string> = {
    'cv': 'CV', 'cover-letter': 'Cover Letter', 'document': 'Document',
    'writer': 'Writing', 'translation': 'Translation', 'study': 'Study',
    'project': 'Project',
  };
  return `${labels[ctx.type] || ctx.type}${ctx.title ? ': ' + ctx.title : ''}`;
}

interface AIAssistantProps {
  darkMode: boolean;
  onNavigate?: (view: ViewId) => void;
}

export default function AIAssistant({ darkMode: _darkMode, onNavigate: _onNavigate }: AIAssistantProps) {
  const l = useLocalizer();
  const { assistantOpen, setAssistantOpen, activeContext, clearActiveContext } = useWorkspace();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { error: showError } = useToast();
  const aiService = useRef(createAIService('ai-chat'));

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent, assistantOpen]);

  const loadConversations = useCallback(async () => {
    const convs = await aiService.current.getConversations();
    setConversations(convs.map(c => ({ id: c.id, title: c.title, updated_at: c.updated_at })));
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    const msgs = await aiService.current.getMessages(conversationId);
    setMessages(msgs.filter(m => m.role !== 'system').map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })));
    setActiveConversationId(conversationId);
  }, []);

  const startNewConversation = useCallback(() => {
    setMessages([]);
    setActiveConversationId(null);
    setError(null);
    setShowHistory(false);
  }, []);

  const send = useCallback(async (prompt?: string) => {
    const rawText = (prompt || input).trim();
    if (!rawText || loading) return;

    // Smart context: if user says "improve this" and there's an active context, augment the message
    let text = rawText;
    if (activeContext.type && activeContext.content) {
      const lower = rawText.toLowerCase();
      if (lower.includes('this') || lower.includes('it') || lower.includes('improve') || lower.includes('fix') || lower.includes('enhance')) {
        text = `${rawText}\n\n[Active context: ${contextLabel(activeContext)}]\n\nContent:\n${activeContext.content.slice(0, 4000)}`;
      }
    } else if (activeContext.type) {
      text = `${rawText}\n\n[Active context: ${contextLabel(activeContext)}]`;
    }

    setInput('');
    setLoading(true);
    setError(null);
    setStreamingContent('');

    const userMsg: ChatMessage = { role: 'user', content: rawText };
    setMessages(prev => [...prev, userMsg]);

    const history = messages.map(m => ({ role: m.role, content: m.content }));

    try {
      const response = await aiService.current.stream(
        { message: text },
        history,
        (chunk) => { setStreamingContent(prev => prev + chunk); },
      );
      setMessages(prev => [...prev, { role: 'assistant', content: response.content }]);
      setStreamingContent('');
      loadConversations();
    } catch (err) {
      const info = getErrorInfo(err);
      setError(info.message);
      showError(info.title);
      setStreamingContent('');
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, loadConversations, showError, activeContext]);

  const deleteConversation = useCallback(async (id: string) => {
    await aiService.current.deleteConversation(id);
    if (activeConversationId === id) startNewConversation();
    loadConversations();
  }, [activeConversationId, startNewConversation, loadConversations]);

  // Floating button when closed
  if (!assistantOpen) {
    return (
      <button
        onClick={() => { setAssistantOpen(true); loadConversations(); }}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white flex items-center justify-center shadow-lg shadow-violet-500/30 hover:scale-110 transition-transform active:scale-95"
        aria-label={l('Open AI Assistant')}
      >
        <Sparkles className="w-6 h-6" />
        <span className="absolute inset-0 rounded-full bg-violet-500/30 animate-ping opacity-20" />
      </button>
    );
  }

  return (
    <>
      {/* Mobile overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm xl:hidden"
        onClick={() => setAssistantOpen(false)}
      />
      <aside
        className="fixed xl:sticky top-0 right-0 z-50 xl:z-10 h-screen w-[calc(100vw-2rem)] sm:w-80 xl:w-80 flex-shrink-0 bg-[#0a0a1a]/95 xl:bg-[#0a0a1a]/80 backdrop-blur-2xl border-l border-white/10 flex flex-col transition-transform duration-300"
        style={{ animation: 'slideInRight 0.25s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-gradient-to-r from-violet-600/10 to-transparent">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-white text-sm font-semibold">{l('AI Assistant')}</div>
              <div className="text-emerald-400 text-xs flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> {l('Online')}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowHistory(!showHistory)} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors" title={l('History')}>
              <MessageSquare className="w-4 h-4" />
            </button>
            <button onClick={startNewConversation} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors" title={l('New conversation')}>
              <Plus className="w-4 h-4" />
            </button>
            <button onClick={() => setAssistantOpen(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Active context banner */}
        {activeContext.type && (
          <div className="flex items-center gap-2 px-4 py-2 bg-violet-600/10 border-b border-violet-500/20">
            <FileText className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
            <span className="text-xs text-violet-300 font-medium flex-1 truncate">{l('Context')}: {contextLabel(activeContext)}</span>
            <button onClick={clearActiveContext} className="text-violet-400/60 hover:text-violet-400 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* History panel */}
        {showHistory && (
          <div className="border-b border-white/5 max-h-48 overflow-y-auto p-2 space-y-1">
            {conversations.length === 0 ? (
              <p className="text-gray-500 text-xs text-center py-4">{l('No conversations yet')}</p>
            ) : (
              conversations.map(c => (
                <div key={c.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${activeConversationId === c.id ? 'bg-violet-600/15' : 'hover:bg-white/5'}`}>
                  <button onClick={() => { loadMessages(c.id); setShowHistory(false); }} className="flex-1 text-left">
                    <div className="text-white text-xs truncate">{c.title}</div>
                    <div className="text-gray-500 text-[10px]">{new Date(c.updated_at).toLocaleString()}</div>
                  </button>
                  <button onClick={() => deleteConversation(c.id)} className="text-red-400/40 hover:text-red-400 p-1">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && !loading && !streamingContent && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600/20 to-fuchsia-600/20 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-violet-400" />
              </div>
              <div>
                <p className="text-white text-sm font-medium">{l('How can I help you?')}</p>
                <p className="text-gray-500 text-xs mt-1">{l('Ask me anything about your tools or documents.')}</p>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${msg.role === 'user' ? 'bg-violet-600 text-white rounded-br-sm' : 'bg-white/5 text-gray-200 border border-white/10 rounded-bl-sm'}`}>
                {msg.role === 'assistant' ? <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} /> : msg.content}
              </div>
            </div>
          ))}

          {streamingContent && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed bg-white/5 text-gray-200 border border-white/10 rounded-bl-sm">
                <div dangerouslySetInnerHTML={{ __html: renderMarkdown(streamingContent) }} />
                <AIStreamingIndicator />
              </div>
            </div>
          )}

          {loading && !streamingContent && <AILoading label={l('AI is thinking')} variant="inline" />}

          {error && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm bg-red-500/10 border border-red-500/20 text-red-300 rounded-bl-sm">{error}</div>
            </div>
          )}
        </div>

        {/* Quick prompts */}
        {messages.length === 0 && !loading && (
          <div className="px-4 pb-2 flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map(p => (
              <button key={p} onClick={() => send(p)} className="text-xs text-gray-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full px-3 py-1.5 transition-colors">{l(p)}</button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="p-3 border-t border-white/5">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder={l('Ask anything...')}
              className="flex-1 bg-transparent text-white text-sm placeholder:text-gray-600 focus:outline-none"
            />
            <button onClick={() => send()} disabled={!input.trim() || loading} className="text-violet-400 hover:text-violet-300 disabled:opacity-40 transition-colors">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
