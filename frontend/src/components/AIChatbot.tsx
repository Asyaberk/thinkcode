/**
 * AIChatbot.tsx — Floating AI Study Guide bubble (context-free mode)
 * Uses /tutor/playground-chat for general Q&A (no problem_id needed).
 * Appears on non-QuestionPage screens as a general coding helper.
 */
import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ChatMessage } from '../types';
import { api } from '../api/client';
import { cn } from '../lib/utils';

interface AIChatbotProps {
  context?: string;  // Optional context hint (e.g. current topic name)
}

export const AIChatbot: React.FC<AIChatbotProps> = ({ context }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm your AI Study Guide. Ask me anything about algorithms, data structures, or your code — I'll guide you without just giving the answer!",
      timestamp: Date.now(),
    },
  ]);
  const [apiHistory, setApiHistory] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen, isLoading]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Use playground-chat for context-free study guide
      const result = await api.post<{ response: string; chat_history: any[] }>(
        '/tutor/playground-chat',
        {
          language: 'general',
          code: context ? `Context: ${context}` : '',
          new_message: text,
          chat_history: apiHistory,
        }
      );

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.response,
        timestamp: Date.now(),
      }]);
      setApiHistory(result.chat_history);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "⚠️ Can't reach the AI right now. Please try again.",
        timestamp: Date.now(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="absolute bottom-20 right-0 w-80 sm:w-96 h-[500px] bg-[#0f172a] rounded-2xl shadow-2xl border border-slate-800 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 bg-emerald-500 text-slate-950 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Bot size={20} />
                <span className="font-bold uppercase tracking-widest text-xs">AI Study Guide</span>
              </div>
              <button onClick={() => setIsOpen(false)} className="hover:bg-black/10 p-1 rounded transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0d1117]">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={cn(
                    "max-w-[82%] p-3.5 rounded-2xl text-sm leading-relaxed",
                    msg.role === 'user'
                      ? "bg-emerald-500 text-slate-950 ml-auto rounded-tr-none font-medium"
                      : "bg-slate-800 text-slate-200 border border-slate-700 mr-auto rounded-tl-none"
                  )}
                >
                  {msg.content}
                </div>
              ))}
              {isLoading && (
                <div className="max-w-[82%] p-3.5 rounded-2xl bg-slate-800 border border-slate-700 mr-auto rounded-tl-none flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-emerald-500" />
                  <span className="text-xs text-slate-500 italic">Thinking...</span>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-slate-800 bg-[#0f172a]">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  disabled={isLoading}
                  placeholder="Ask anything..."
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-full px-5 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none text-slate-200 placeholder:text-slate-600 disabled:opacity-50"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="bg-emerald-500 text-slate-950 p-2.5 rounded-full hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/10 active:scale-95 disabled:opacity-40"
                >
                  {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={18} />}
                </button>
              </div>
              <p className="text-[10px] text-slate-700 mt-2 text-center">GPT-4.1-nano · ThinkCode AI</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all",
          isOpen ? "bg-slate-800 text-white" : "bg-emerald-500 text-slate-950 shadow-emerald-500/20"
        )}
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </motion.button>
    </div>
  );
};
