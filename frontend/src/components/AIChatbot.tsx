import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ChatMessage } from '../types';
import { cn } from '../lib/utils';

interface AIChatbotProps {
  context?: string;
}

export const AIChatbot: React.FC<AIChatbotProps> = ({ context }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm your coding guide. Need a hint? I won't give you the answer, but I can help you find it!",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    // Simulate AI Response
    setTimeout(() => {
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: getMockHint(input, context),
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    }, 1000);
  };

  const getMockHint = (query: string, ctx?: string) => {
    if (query.toLowerCase().includes('answer')) {
      return "I can't give you the direct answer, but think about the `std::` namespace in C++. Which object is used for standard output?";
    }
    if (query.toLowerCase().includes('cout')) {
      return "`std::cout` is used to print text to the console. Don't forget to use the insertion operator `<<`!";
    }
    return "C++ can be tricky! Remember that every statement must end with a semicolon `;`. Have you checked your syntax?";
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
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed",
                    msg.role === 'user'
                      ? "bg-emerald-500 text-slate-950 ml-auto rounded-tr-none font-medium"
                      : "bg-slate-800 text-slate-200 border border-slate-700 mr-auto rounded-tl-none"
                  )}
                >
                  {msg.content}
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-slate-800 bg-[#0f172a]">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask for a hint..."
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-full px-5 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none text-slate-200 placeholder:text-slate-600"
                />
                <button
                  onClick={handleSend}
                  className="bg-emerald-500 text-slate-950 p-2.5 rounded-full hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/10 active:scale-95"
                >
                  <Send size={18} />
                </button>
              </div>
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
