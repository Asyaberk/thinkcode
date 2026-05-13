import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Send, Bot, User, Loader2, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Question, ChatMessage } from '../types';
import { chatWithTutor, getTutorSession } from '../api/tutor';
import { cn } from '../lib/utils';

export interface ChatQuestionInterfaceRef {
  addFeedback: (isCorrect: boolean, explanation: string) => void;
  addMessage: (role: 'user' | 'assistant', content: string) => void;
  addExplanation: (code: string) => Promise<void>;
  addErrorExplanation: (code: string, error: string) => Promise<void>;
}

interface ChatQuestionInterfaceProps {
  question: Question;
}

export const ChatQuestionInterface = forwardRef<ChatQuestionInterfaceRef, ChatQuestionInterfaceProps>((
  { question },
  ref
) => {
  const problemId = question.problemId || question.id;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Parallel history kept as {role, content}[] to send to backend
  const [apiHistory, setApiHistory] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // True while loading the session from the backend on mount
  const [isRestoring, setIsRestoring] = useState(false);
  const [sessionRestored, setSessionRestored] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // On mount (or when the question changes): try to restore the saved session.
  // If no prior session exists, show the standard welcome message instead.
  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      setIsRestoring(true);
      setSessionRestored(false);
      try {
        const session = await getTutorSession(problemId);
        if (cancelled) return;

        if (session.messages && session.messages.length > 0) {
          // Rebuild the visual messages list from the stored API history
          const restored: ChatMessage[] = session.messages.map((m, i) => ({
            id: String(i),
            role: m.role as 'user' | 'assistant',
            content: m.content,
            timestamp: Date.now() - (session.messages.length - i) * 1000,
          }));
          setMessages(restored);
          setApiHistory(session.messages);
          setSessionRestored(true);
        } else {
          // No prior session — show welcome message
          setMessages([{
            id: '0',
            role: 'assistant',
            content: `Hi! I'm your AI Tutor for **${question.title}**.\n\nI won't give you the answer directly — but I'll guide you there with questions. Ask me for a hint, explain your thinking, or say "check my answer".`,
            timestamp: Date.now(),
          }]);
          setApiHistory([]);
        }
      } catch {
        // Network error or first-time session — fall back to welcome
        if (!cancelled) {
          setMessages([{
            id: '0',
            role: 'assistant',
            content: `Hi! I'm your AI Tutor for **${question.title}**.\n\nI won't give you the answer directly — but I'll guide you there with questions. Ask me for a hint, explain your thinking, or say "check my answer".`,
            timestamp: Date.now(),
          }]);
          setApiHistory([]);
        }
      } finally {
        if (!cancelled) setIsRestoring(false);
      }
    };

    restore();
    return () => { cancelled = true; };
  }, [question.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // ── Helper: push an AI message into state ──────────────────────────────────
  const pushAI = (content: string) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'assistant',
      content,
      timestamp: Date.now(),
    }]);
  };

  const pushUser = (content: string) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: Date.now(),
    }]);
  };

  // ── Core: call real backend ────────────────────────────────────────────────
  const callTutor = async (userMessage: string, codeContext?: string) => {
    if (!problemId) {
      pushAI("Sorry, I can't connect to the AI right now — problem ID missing.");
      return;
    }
    setIsLoading(true);
    try {
      const result = await chatWithTutor({
        problem_id: problemId,
        new_message: userMessage,
        chat_history: apiHistory as any,
        student_code_or_answer: codeContext || '',
      });
      const aiText = result.response;
      pushAI(aiText);
      // Update API history
      setApiHistory(result.chat_history as any);
    } catch (err: any) {
      pushAI("⚠️ Couldn't reach the AI Tutor. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Ref methods (called by QuestionPage) ───────────────────────────────────
  useImperativeHandle(ref, () => ({
    addFeedback: (isCorrect: boolean, explanation: string) => {
      if (isCorrect) {
        pushAI(`✅ Correct! ${explanation || "Great work!"}\n\nWould you like me to explain **why** this is the right answer?`);
      } else {
        pushAI(`❌ Not quite. ${explanation || "Let's think about this differently."}\n\nWould you like a hint?`);
      }
    },
    addMessage: (role: 'user' | 'assistant', content: string) => {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role,
        content,
        timestamp: Date.now(),
      }]);
    },
    addExplanation: async (code: string) => {
      pushUser('Can you explain my code?');
      await callTutor('Can you explain my code step by step?', code);
    },
    addErrorExplanation: async (code: string, error: string) => {
      pushUser(`I got this error: ${error.slice(0, 120)}`);
      await callTutor(
        `My code is giving this error: "${error}". Can you explain what it means and guide me to fix it?`,
        code
      );
    },
  }));

  // ── User sends a message ───────────────────────────────────────────────────
  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    pushUser(text);
    await callTutor(text);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-[#0f172a] border-l border-slate-800">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-800 bg-[#0f172a] flex items-center gap-4 shrink-0">
        <div className="relative">
          <div className="w-11 h-11 bg-emerald-500 rounded-2xl flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/10">
            <Bot size={22} strokeWidth={2} />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#0f172a] rounded-full" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-white text-[15px] tracking-tight">AI Tutor</h3>
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Socratic Mode · LangGraph</span>
        </div>
        {/* Session restored badge */}
        {sessionRestored && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700">
            <RotateCcw size={10} className="text-emerald-400" />
            <span className="text-[10px] text-emerald-400 font-medium">Restored</span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#0d1117]">
        {/* Restoring overlay */}
        {isRestoring && (
          <div className="flex items-center justify-center gap-2 py-4 text-slate-500 text-xs">
            <Loader2 size={14} className="animate-spin text-emerald-500" />
            <span>Loading your previous conversation…</span>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "flex gap-3 max-w-[92%]",
                msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
              )}
            >
              <div className={cn(
                "w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center shadow-sm",
                msg.role === 'user'
                  ? "bg-emerald-500 text-slate-950"
                  : "bg-slate-800 border border-slate-700 text-slate-200"
              )}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className={cn(
                "p-4 rounded-2xl text-sm leading-relaxed border",
                msg.role === 'user'
                  ? "bg-emerald-500 text-slate-950 border-emerald-400 rounded-tr-none font-medium"
                  : "bg-slate-800 text-slate-300 border-slate-700 rounded-tl-none"
              )}>
                {msg.content.split('\n').map((line, i) => (
                  <p
                    key={i}
                    className={line ? 'mb-2 last:mb-0' : 'h-2'}
                    dangerouslySetInnerHTML={{
                      __html: line
                        .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-bold">$1</strong>')
                        .replace(/`(.*?)`/g, '<code class="bg-slate-900 text-emerald-400 px-1 py-0.5 rounded text-xs font-mono">$1</code>')
                    }}
                  />
                ))}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Loading indicator */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3 max-w-[92%] mr-auto"
          >
            <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center bg-slate-800 border border-slate-700 text-slate-200">
              <Loader2 size={16} className="animate-spin" />
            </div>
            <div className="p-4 rounded-2xl bg-slate-800 border border-slate-700 rounded-tl-none flex items-center gap-2">
              <div className="flex gap-1">
                {[0, 150, 300].map(delay => (
                  <div
                    key={delay}
                    className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
              <span className="text-xs text-slate-500 italic">Thinking...</span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Quick prompts */}
      {messages.length <= 1 && (
        <div className="px-6 pb-3 flex gap-2 flex-wrap shrink-0">
          {["Give me a hint", "Explain this problem", "Check my approach", "What should I try first?"].map(prompt => (
            <button
              key={prompt}
              onClick={() => { setInput(prompt); }}
              className="text-[11px] px-3 py-1.5 rounded-full border border-slate-700 text-slate-400 hover:border-emerald-500/50 hover:text-emerald-400 transition-all"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-5 bg-[#0f172a] border-t border-slate-800 shrink-0">
        <div className="relative group">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ask for a hint, explain your thinking..."
            disabled={isLoading}
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-5 pr-14 py-4 text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-slate-800 outline-none transition-all placeholder:text-slate-600 text-slate-200 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-2 bottom-2 bg-emerald-500 text-slate-950 px-4 rounded-xl hover:bg-emerald-400 transition-all shadow-md active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
        <p className="text-[10px] text-slate-600 mt-2 text-center">
          Powered by LangGraph · GPT-4.1-nano · Socratic method
        </p>
      </div>
    </div>
  );
});
