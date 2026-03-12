import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Send, Bot, User, CheckCircle2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { Question, ChatMessage } from '../types';
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

export const ChatQuestionInterface = forwardRef<ChatQuestionInterfaceRef, ChatQuestionInterfaceProps>(({
  question,
}, ref) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [pendingExplanation, setPendingExplanation] = useState<string | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    addFeedback: (isCorrect: boolean, explanation: string) => {
      const aiMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: isCorrect 
          ? "Great job! That's the correct answer. Would you like to understand **why** this is the right choice?"
          : "Not quite. That doesn't seem to be the correct snippet for this blank. Would you like to know **why** it's incorrect and get a hint?",
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, aiMsg]);
      setPendingExplanation(explanation);
    },
    addMessage: (role: 'user' | 'assistant', content: string) => {
      const msg: ChatMessage = {
        id: Date.now().toString(),
        role,
        content,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, msg]);
    },
    addExplanation: async (code: string) => {
      setIsAiThinking(true);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const prompt = `
          Explain the following C++ code to a student.
          Include:
          1. What the code does
          2. Line by line explanation
          3. Why it works
          4. Possible improvements
          
          Code:
          \`\`\`cpp
          ${code}
          \`\`\`
        `;
        
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
        });
        
        const aiMsg: ChatMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          content: response.text || "I'm sorry, I couldn't generate an explanation for this code.",
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, aiMsg]);
      } catch (error) {
        console.error("AI Explanation error:", error);
      } finally {
        setIsAiThinking(false);
      }
    },
    addErrorExplanation: async (code: string, error: string) => {
      setIsAiThinking(true);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const prompt = `
          Explain the following C++ compiler error to a student.
          Include:
          1. What the error means
          2. Why it happened in this specific code
          3. How to fix it
          
          Code:
          \`\`\`cpp
          ${code}
          \`\`\`
          
          Error:
          ${error}
        `;
        
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
        });
        
        const aiMsg: ChatMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          content: response.text || "I'm sorry, I couldn't analyze this error.",
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, aiMsg]);
      } catch (error) {
        console.error("AI Error Explanation error:", error);
      } finally {
        setIsAiThinking(false);
      }
    }
  }));

  useEffect(() => {
    const initialMessages: ChatMessage[] = [
      {
        id: '1',
        role: 'assistant',
        content: `I've set up a C++ exercise for you in the IDE. \n\n**Goal:** ${question.description}\n\nLook at the code and select the correct option below the editor to fill the blank.`,
        timestamp: Date.now(),
      },
    ];
    setMessages(initialMessages);
  }, [question]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    const currentInput = input.trim().toLowerCase();
    setInput('');

    setTimeout(() => {
      let aiResponse = "";
      
      if (pendingExplanation && (currentInput.includes('yes') || currentInput.includes('evet') || currentInput.includes('why') || currentInput.includes('neden'))) {
        aiResponse = pendingExplanation;
        setPendingExplanation(null);
      } else if (pendingExplanation && (currentInput.includes('no') || currentInput.includes('hayır'))) {
        aiResponse = "No problem! Feel free to try again or move to the next challenge when you're ready.";
        setPendingExplanation(null);
      } else if (currentInput.includes('hint') || currentInput.includes('ipucu')) {
        aiResponse = "Think about the standard library in C++. We are trying to print to the console. Which object handles that?";
      } else {
        aiResponse = "I'm here to help! If you've selected an answer in the IDE, let me know if you want to discuss the logic behind it.";
      }

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiResponse,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    }, 800);
  };

  return (
    <div className="h-full flex flex-col bg-[#0f172a] border-l border-slate-800 shadow-inner">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-800 bg-[#0f172a] flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-11 h-11 bg-emerald-500 rounded-2xl flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/10">
              <Bot size={22} strokeWidth={2} />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#0f172a] rounded-full" />
          </div>
          <div>
            <h3 className="font-bold text-white text-[15px] tracking-tight">AI Tutor</h3>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Socratic Mode</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-8 bg-[#0d1117]">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex gap-4 max-w-[90%]",
              msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
            )}
          >
            <div className={cn(
              "w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-white shadow-sm transition-transform hover:scale-105",
              msg.role === 'user' ? "bg-emerald-500 text-slate-950" : "bg-slate-800 border border-slate-700 !text-slate-200"
            )}>
              {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
            </div>
            <div className={cn(
              "p-5 rounded-2xl text-[14px] leading-[1.6] shadow-sm border",
              msg.role === 'user'
                ? "bg-emerald-500 text-slate-950 border-emerald-400 rounded-tr-none"
                : "bg-slate-800 text-slate-300 border-slate-700 rounded-tl-none"
            )}>
              {msg.content.split('\n').map((line, i) => (
                <p key={i} className={line ? 'mb-3 last:mb-0' : 'h-3'} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-bold">$1</strong>') }} />
              ))}
            </div>
          </div>
        ))}
        {isAiThinking && (
          <div className="flex gap-4 max-w-[90%] mr-auto">
            <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center bg-slate-800 border border-slate-700 text-slate-200">
              <Bot size={18} className="animate-pulse" />
            </div>
            <div className="p-5 rounded-2xl text-[14px] bg-slate-800 text-slate-300 border-slate-700 rounded-tl-none flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="italic text-xs text-slate-500">Thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-6 bg-[#0f172a] border-t border-slate-800">
        <div className="relative group">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type 'Yes' to see explanation or ask a question..."
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-5 pr-14 py-4 text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-slate-800 outline-none transition-all placeholder:text-slate-600 text-slate-200"
          />
          <button
            onClick={handleSend}
            className="absolute right-2 top-2 bottom-2 bg-emerald-500 text-slate-950 px-4 rounded-xl hover:bg-emerald-400 transition-all shadow-md active:scale-95 disabled:opacity-50"
            disabled={!input.trim()}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
});
