/**
 * ChatQuestionInterface.tsx — Soru Çözme Chatbot Bileşeni.
 *
 * Değişiklikler:
 *  1. "@google/genai" import'u KALDIRILDI — Gemini API key güvenlik riski oluşturuyordu
 *  2. addExplanation / addErrorExplanation → backend tutor chat endpoint'ine yönlendirildi
 *  3. Tasarım ve ref yapısı (addFeedback, addMessage, addExplanation) tamamen KORUNDU
 *  4. OVERFLOW FIX: min-h-0 + flex-shrink-0 eklendi — chat artık sayfadan taşmıyor
 */

import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Send, Bot, User } from 'lucide-react';
import { Question, ChatMessage } from '../types';
import { cn } from '../lib/utils';
import { api } from '../api/client';

// ── Public ref interface — QuestionPage bu metodları çağırır ────────────────
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [pendingExplanation, setPendingExplanation] = useState<string | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [chatHistory, setChatHistory] = useState<{role: string; content: string}[]>([]);
  // scrollRef: yeni mesaj gelince en alta scroll yapar
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Dışarıdan çağrılabilen metodlar (QuestionPage ref üzerinden kullanır) ──
  useImperativeHandle(ref, () => ({
    // addFeedback: Cevap değerlendirme sonucunu chatbot'a ekle
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

    // addMessage: Doğrudan mesaj ekle (sistem bildirimi için)
    addMessage: (role: 'user' | 'assistant', content: string) => {
      const msg: ChatMessage = {
        id: Date.now().toString(),
        role,
        content,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, msg]);
    },

    // addExplanation: Kodu backend AI'a açıklat
    addExplanation: async (code: string) => {
      setIsAiThinking(true);
      try {
        const response = await api.post<{response: string; chat_history: any[]}>('/tutor/chat', {
          problem_id: question.id,
          new_message: `Please explain this code:\n\`\`\`cpp\n${code}\n\`\`\``,
          chat_history: chatHistory,
          student_code_or_answer: code,
        });
        const aiMsg: ChatMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          content: response.response || "I couldn't generate an explanation for this code.",
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, aiMsg]);
        setChatHistory(response.chat_history || []);
      } catch (error) {
        console.error("AI Explanation error:", error);
        const aiMsg: ChatMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          content: "I'm having trouble connecting to the AI tutor. Here's a tip: look at what this code section does step by step.",
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, aiMsg]);
      } finally {
        setIsAiThinking(false);
      }
    },

    // addErrorExplanation: Derleme hatasını backend AI'a açıklat
    addErrorExplanation: async (code: string, error: string) => {
      setIsAiThinking(true);
      try {
        const response = await api.post<{response: string; chat_history: any[]}>('/tutor/chat', {
          problem_id: question.id,
          new_message: `I got this compiler error. Can you explain what's wrong?\n\nError:\n${error}`,
          chat_history: chatHistory,
          student_code_or_answer: code,
        });
        const aiMsg: ChatMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          content: response.response || "I couldn't analyze this error.",
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, aiMsg]);
        setChatHistory(response.chat_history || []);
      } catch (error) {
        console.error("AI Error Explanation error:", error);
        const aiMsg: ChatMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          content: "Check your syntax carefully. Common issues include missing semicolons, mismatched braces, or undefined variables.",
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, aiMsg]);
      } finally {
        setIsAiThinking(false);
      }
    }
  }));

  // ── İlk yükleme mesajı ───────────────────────────────────────────────────────
  useEffect(() => {
    const initialMessages: ChatMessage[] = [
      {
        id: '1',
        role: 'assistant',
        content: `I've set up a coding exercise for you. \n\n**Goal:** ${question.description}\n\nLook at the code and select the correct option to fill the blank.`,
        timestamp: Date.now(),
      },
    ];
    setMessages(initialMessages);
    setChatHistory([]);
  }, [question]);

  // ── Scroll: yeni mesaj gelince en alta git ────────────────────────────────────
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // ── Kullanıcı mesajı gönder ─────────────────────────────────────────────────
  const handleSend = async () => {
    if (!input.trim() || isAiThinking) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    const currentInput = input.trim().toLowerCase();
    setInput('');
    setIsAiThinking(true);

    try {
      // "Yes/evet/why/neden" → pending explanation varsa onu göster
      if (pendingExplanation && (
        currentInput.includes('yes') || currentInput.includes('evet') ||
        currentInput.includes('why') || currentInput.includes('neden')
      )) {
        const aiMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: pendingExplanation,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, aiMsg]);
        setPendingExplanation(null);
        setIsAiThinking(false);
        return;
      }

      // Diğer tüm mesajlar → backend LangGraph tutor'una gönder
      const response = await api.post<{response: string; chat_history: any[]}>('/tutor/chat', {
        problem_id: question.id,
        new_message: input,
        chat_history: chatHistory,
        student_code_or_answer: null,
      });

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.response,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, aiMsg]);
      setChatHistory(response.chat_history || []);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm having trouble connecting right now. Try again in a moment, or think about the problem hint above.",
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsAiThinking(false);
    }
  };

  return (
    // OVERFLOW FIX: h-full + min-h-0 → FlexBox'ta child'lar parent'ı aşmaz, scroll düzgün çalışır
    <div className="h-full flex flex-col bg-[#0f172a] border-l border-slate-800 shadow-inner min-h-0">

      {/* Header — flex-shrink-0: büzülmez, her zaman görünür */}
      <div className="px-6 py-5 border-b border-slate-800 bg-[#0f172a] flex items-center justify-between flex-shrink-0">
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

      {/* Chat Alanı — min-h-0 sayesinde taşmadan scroll olur */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-8 bg-[#0d1117] min-h-0">
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
              {/* Markdown bold (**text**) ve newline desteği */}
              {msg.content.split('\n').map((line, i) => (
                <p key={i} className={line ? 'mb-3 last:mb-0' : 'h-3'} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-bold">$1</strong>') }} />
              ))}
            </div>
          </div>
        ))}

        {/* AI Thinking indicator — üç nokta animasyonu */}
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

      {/* Input Alanı — flex-shrink-0: büzülmez, her zaman altta görünür */}
      <div className="p-6 bg-[#0f172a] border-t border-slate-800 flex-shrink-0">
        <div className="relative group">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask a question or type 'Yes' to see explanation..."
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-5 pr-14 py-4 text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-slate-800 outline-none transition-all placeholder:text-slate-600 text-slate-200"
          />
          <button
            onClick={handleSend}
            className="absolute right-2 top-2 bottom-2 bg-emerald-500 text-slate-950 px-4 rounded-xl hover:bg-emerald-400 transition-all shadow-md active:scale-95 disabled:opacity-50"
            disabled={!input.trim() || isAiThinking}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
});
