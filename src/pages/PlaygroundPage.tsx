import React, { useState, useRef, useEffect } from 'react';
import { Play, RotateCcw, Terminal, Bot, Send, User, Sparkles, Bug, Lightbulb, Code2, ChevronDown } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { motion, AnimatePresence } from 'motion/react';
import { Sidebar } from '../components/Sidebar';
import { cn } from '../lib/utils';
import { ChatMessage, Section, UserRole } from '../types';

interface PlaygroundPageProps {
  sections: Section[];
  onDashboardClick: () => void;
  onProblemsClick: () => void;
  onLearningClick: () => void;
  onAnalyticsClick: () => void;
  onInstructorDashboardClick?: () => void;
  onLogout?: () => void;
  userRole?: UserRole;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

const STARTER_CODE = {
  cpp: `#include <iostream>\n\nint main() {\n    std::cout << "Hello, ThinkCode!" << std::endl;\n    return 0;\n}`,
  python: `print("Hello, ThinkCode!")\n\n# Try writing some logic here\ndef greet(name):\n    return f"Welcome to the playground, {name}!"\n\nprint(greet("Explorer"))`,
  javascript: `console.log("Hello, ThinkCode!");\n\n// Try writing some logic here\nconst greet = (name) => {\n    return \`Welcome to the playground, \${name}!\`;\n};\n\nconsole.log(greet("Explorer"));`
};

type Language = 'cpp' | 'python' | 'javascript';

import { GoogleGenAI } from "@google/genai";

export const PlaygroundPage: React.FC<PlaygroundPageProps> = ({
  sections,
  onDashboardClick,
  onProblemsClick,
  onLearningClick,
  onAnalyticsClick,
  onInstructorDashboardClick,
  onLogout,
  userRole,
  isSidebarCollapsed,
  onToggleSidebar
}) => {
  const [language, setLanguage] = useState<Language>('cpp');
  const [code, setCode] = useState(STARTER_CODE.cpp);
  const [output, setOutput] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Welcome to the **ThinkCode Playground**! 🚀\n\nThis is your free space to experiment with code. You can switch between C++, Python, and JavaScript using the selector above.\n\nHow can I help you today? You can ask me to explain your code, suggest improvements, or help debug any issues.",
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    setCode(STARTER_CODE[lang]);
    setOutput('');
  };

  const handleRun = () => {
    setOutput(`> Compiling and executing ${language} code...\n\n`);
    setTimeout(() => {
      if (language === 'cpp') {
        setOutput(prev => prev + "Hello, ThinkCode!\n\n[Process completed with exit code 0]");
      } else if (language === 'python') {
        setOutput(prev => prev + "Hello, ThinkCode!\nWelcome to the playground, Explorer\n\n[Process completed with exit code 0]");
      } else {
        setOutput(prev => prev + "Hello, ThinkCode!\nWelcome to the playground, Explorer\n\n[Process completed with exit code 0]");
      }
    }, 600);
  };

  const handleReset = () => {
    setCode(STARTER_CODE[language]);
    setOutput('');
  };

  const handleSend = async (text?: string) => {
    const messageText = text || input;
    if (!messageText.trim() || isTyping) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    if (!text) setInput('');
    setIsTyping(true);

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not configured.");
      }
      const ai = new GoogleGenAI({ apiKey });

      const prompt = `
        You are a helpful coding assistant in a learning platform called ThinkCode.
        The user is currently using the ${language.toUpperCase()} playground.
        
        Current Code:
        \`\`\`${language}
        ${code}
        \`\`\`
        
        User Question/Request: ${messageText}
        
        Provide a helpful, concise response. Use markdown for formatting. If the user asks for code improvements or debugging, explain the changes clearly.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      const aiMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: response.text || "I'm sorry, I couldn't generate a response. Please try again.",
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error("Gemini API Error:", error);
      const errorMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: "I encountered an error while processing your request. Please check your connection and try again.",
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#0f172a]">
      <Sidebar
        sections={sections}
        activeSectionId="playground"
        onSectionSelect={onLearningClick}
        onDashboardClick={onDashboardClick}
        onProblemsClick={onProblemsClick}
        onAnalyticsClick={onAnalyticsClick}
        onPlaygroundClick={() => {}}
        onInstructorDashboardClick={onInstructorDashboardClick}
        onLogout={onLogout}
        userRole={userRole}
      />

      <main className={cn(
        "flex-1 flex flex-col overflow-hidden transition-all duration-300",
        isSidebarCollapsed ? "ml-20" : "ml-72"
      )}>
        {/* IDE Header */}
        <header className="h-16 border-b border-slate-800 bg-[#0f172a] flex items-center justify-between px-6 z-10">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl">
              <Code2 size={16} className="text-emerald-500" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">Playground</span>
            </div>
            
            <div className="h-6 w-px bg-slate-800" />
            
            <div className="relative group">
              <select 
                value={language}
                onChange={(e) => handleLanguageChange(e.target.value as Language)}
                className="appearance-none bg-slate-900 border border-slate-800 text-slate-300 text-xs font-bold py-1.5 pl-4 pr-10 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer hover:border-slate-700 transition-all"
              >
                <option value="cpp">C++ (GCC 11)</option>
                <option value="python">Python 3.10</option>
                <option value="javascript">JavaScript (Node.js)</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all text-xs font-bold"
            >
              <RotateCcw size={14} />
              Reset
            </button>
            <button
              onClick={handleRun}
              className="flex items-center gap-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-6 py-2 rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
            >
              <Play size={14} fill="currentColor" />
              Run Code
            </button>
          </div>
        </header>

        {/* IDE Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Editor & Console */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Editor */}
            <div className="flex-1 relative font-mono text-[14px] overflow-hidden bg-[#0d1117]">
              <div className="absolute top-0 left-0 w-12 h-full bg-[#161b22] border-r border-white/5 flex flex-col items-center py-4 text-slate-600 select-none">
                {Array.from({ length: 30 }).map((_, i) => (
                  <div key={i} className="h-6 flex items-center justify-center text-[11px]">{i + 1}</div>
                ))}
              </div>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="absolute inset-0 w-full h-full pl-16 pr-6 py-4 bg-transparent text-transparent caret-emerald-500 outline-none resize-none z-10 selection:bg-emerald-500/20"
                spellCheck={false}
              />
              <div className="absolute inset-0 pl-16 pr-6 py-4 pointer-events-none overflow-auto">
                <SyntaxHighlighter
                  language={language === 'cpp' ? 'cpp' : language}
                  style={vscDarkPlus}
                  customStyle={{
                    background: 'transparent',
                    padding: 0,
                    margin: 0,
                    fontSize: '14px',
                    lineHeight: '1.5rem'
                  }}
                >
                  {code}
                </SyntaxHighlighter>
              </div>
            </div>

            {/* Console */}
            <div className="h-64 bg-[#010409] border-t border-slate-800 flex flex-col">
              <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-800 bg-[#0d1117]">
                <div className="flex items-center gap-2.5">
                  <Terminal size={14} className="text-slate-500" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Output Console</span>
                </div>
                <button 
                  onClick={() => setOutput('')}
                  className="text-[9px] font-bold text-slate-500 hover:text-white uppercase tracking-widest transition-colors"
                >
                  Clear
                </button>
              </div>
              <div className="flex-1 p-5 font-mono text-[13px] overflow-auto leading-relaxed">
                {output ? (
                  <div className="space-y-1">
                    {output.split('\n').map((line, i) => (
                      <div key={i} className={cn(
                        line.includes('Error') ? "text-red-400" : 
                        line.includes('Running') ? "text-slate-500 italic" : "text-emerald-400"
                      )}>
                        {line}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-600 italic gap-2">
                    <Terminal size={20} strokeWidth={1.5} className="opacity-20" />
                    <span>Run your code to see the output here...</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AI Assistant Panel */}
          <div className="w-96 border-l border-slate-800 flex flex-col bg-[#0f172a]">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-slate-950">
                  <Bot size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">AI Assistant</h3>
                  <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">Online</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="p-4 grid grid-cols-1 gap-2 border-b border-slate-800 bg-slate-900/30">
              <button 
                onClick={() => handleSend("Explain my code")}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-emerald-500/50 hover:bg-slate-800 text-left transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all">
                  <Lightbulb size={16} />
                </div>
                <span className="text-xs font-medium text-slate-300">Explain Code</span>
              </button>
              <button 
                onClick={() => handleSend("Suggest improvements for my code")}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-emerald-500/50 hover:bg-slate-800 text-left transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                  <Sparkles size={16} />
                </div>
                <span className="text-xs font-medium text-slate-300">Suggest Improvements</span>
              </button>
              <button 
                onClick={() => handleSend("Debug my code")}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-emerald-500/50 hover:bg-slate-800 text-left transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 group-hover:bg-red-500 group-hover:text-white transition-all">
                  <Bug size={16} />
                </div>
                <span className="text-xs font-medium text-slate-300">Debug Code</span>
              </button>
            </div>

            {/* Chat Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-6 bg-[#0d1117]/50">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-3",
                    msg.role === 'user' ? "flex-row-reverse" : ""
                  )}
                >
                  <div className={cn(
                    "w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] font-bold",
                    msg.role === 'user' ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-400 border border-slate-700"
                  )}>
                    {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                  </div>
                  <div className={cn(
                    "p-3.5 rounded-2xl text-[13px] leading-relaxed",
                    msg.role === 'user'
                      ? "bg-emerald-500 text-slate-950 rounded-tr-none"
                      : "bg-slate-800 text-slate-300 border border-slate-700 rounded-tl-none"
                  )}>
                    {msg.content.split('\n').map((line, i) => (
                      <p key={i} className={line ? 'mb-2 last:mb-0' : 'h-2'} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-bold">$1</strong>').replace(/`(.*?)`/g, '<code class="bg-slate-950 px-1.5 py-0.5 rounded text-emerald-400 font-mono text-[12px]">$1</code>') }} />
                    ))}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 border border-slate-700 flex items-center justify-center">
                    <Bot size={14} />
                  </div>
                  <div className="bg-slate-800 border border-slate-700 p-4 rounded-2xl rounded-tl-none flex gap-1">
                    <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 bg-slate-500 rounded-full" />
                    <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-slate-500 rounded-full" />
                    <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-slate-500 rounded-full" />
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="p-4 bg-[#0f172a] border-t border-slate-800">
              <div className="relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask anything..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-4 pr-12 py-3 text-xs focus:ring-2 focus:ring-emerald-500 outline-none transition-all placeholder:text-slate-600 text-slate-200"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim()}
                  className="absolute right-1.5 top-1.5 bottom-1.5 bg-emerald-500 text-slate-950 px-3 rounded-lg hover:bg-emerald-400 transition-all disabled:opacity-50"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
