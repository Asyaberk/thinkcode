import React from 'react';
import { Play, RotateCcw, Terminal, Brain } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from '../lib/utils';

interface CodePlaygroundProps {
  code: string;
  onCodeChange: (code: string) => void;
  onRun: () => void;
  onExplain?: () => void;
  output: string;
  description: string;
  options?: { id: string; text: string }[];
  selectedOptionId?: string | null;
  onOptionSelect?: (id: string) => void;
  type?: string;
}

export const CodePlayground: React.FC<CodePlaygroundProps> = ({ 
  code, 
  onCodeChange, 
  onRun, 
  onExplain,
  output,
  description,
  options,
  selectedOptionId,
  onOptionSelect,
  type
}) => {
  return (
    <div className="h-full flex flex-col bg-[#0d1117] text-slate-300 rounded-2xl overflow-hidden shadow-2xl border border-white/5">
      {/* Question Section (At the very top) */}
      <div className="px-6 py-5 bg-slate-100 border-b border-slate-200">
        <div className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          Question
        </div>
        <p className="text-slate-800 font-medium leading-relaxed">{description}</p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-[#161b22] border-b border-white/5">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
            <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-[#0d1117] rounded-md border border-white/5">
            <span className="text-[11px] font-mono text-slate-400">main.cpp</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={onExplain}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all border border-white/5"
          >
            <Brain size={14} className="text-emerald-500" />
            Explain Code
          </button>
          <button className="p-2 hover:bg-white/5 rounded-lg transition-colors text-slate-500 hover:text-slate-300">
            <RotateCcw size={16} />
          </button>
          <button
            onClick={onRun}
            className="flex items-center gap-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] active:scale-95"
          >
            <Play size={14} fill="currentColor" />
            Check Solution
          </button>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 relative font-mono text-[13px] overflow-auto p-6 leading-relaxed">
        {type === 'Open Response' ? (
          <textarea
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            placeholder="Type your explanation here..."
            className="w-full h-full bg-transparent text-slate-200 caret-emerald-500 outline-none resize-none selection:bg-emerald-500/20 placeholder:text-slate-700"
            spellCheck={true}
          />
        ) : (
          <>
            <textarea
              value={code}
              onChange={(e) => onCodeChange(e.target.value)}
              className="absolute inset-0 w-full h-full p-6 bg-transparent text-transparent caret-emerald-500 outline-none resize-none z-10 selection:bg-emerald-500/20"
              spellCheck={false}
            />
            <SyntaxHighlighter
              language="cpp"
              style={vscDarkPlus}
              customStyle={{
                background: 'transparent',
                padding: 0,
                margin: 0,
              }}
            >
              {code}
            </SyntaxHighlighter>
          </>
        )}
      </div>

      {/* Console Section */}
      <div className="h-48 bg-[#010409] border-t border-white/5 flex flex-col">
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-white/5 bg-[#0d1117]">
          <div className="flex items-center gap-2.5">
            <Terminal size={14} className="text-slate-500" />
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Command Line</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] font-bold text-emerald-500/70 uppercase tracking-widest">Compiler Ready</span>
          </div>
        </div>
        <div className="flex-1 p-5 font-mono text-[12px] overflow-auto leading-relaxed">
          {output ? (
            <div className="space-y-1">
              {output.split('\n').map((line, i) => (
                <div key={i} className={cn(
                  line.startsWith('Error') ? "text-red-400" : 
                  line.startsWith('Compiling') ? "text-slate-500 italic" : "text-emerald-400"
                )}>
                  {line.startsWith('>') ? <span className="text-slate-600 mr-2">➜</span> : null}
                  {line}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-600 italic gap-2">
              <Terminal size={20} strokeWidth={1.5} className="opacity-20" />
              <span>Awaiting execution...</span>
            </div>
          )}
        </div>
      </div>

      {/* Options Section (Now at bottom) */}
      {options && (
        <div className="px-6 py-5 bg-slate-100 border-t border-slate-200">
          <div className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-4">
            Answers
          </div>
          <div className="grid grid-cols-2 gap-3">
            {options.map((option) => (
              <button
                key={option.id}
                onClick={() => onOptionSelect?.(option.id)}
                className={cn(
                  "flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left group",
                  selectedOptionId === option.id
                    ? "bg-emerald-500 border-emerald-600 text-slate-950 shadow-lg shadow-emerald-500/20"
                    : "bg-slate-900 border-slate-800 text-slate-300 hover:border-emerald-500/50 hover:bg-slate-800"
                )}
              >
                <div className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black transition-colors",
                  selectedOptionId === option.id ? "bg-slate-950 text-emerald-400" : "bg-slate-800 text-slate-500 group-hover:text-emerald-400"
                )}>
                  {option.id.toUpperCase()}
                </div>
                <code className="text-[12px] font-mono font-bold">{option.text}</code>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
