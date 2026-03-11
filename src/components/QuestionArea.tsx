import React from 'react';
import { Question } from '../types';
import { cn } from '../lib/utils';

interface QuestionAreaProps {
  question: Question;
  selectedOptionId: string | null;
  onOptionSelect: (id: string) => void;
  isCorrect?: boolean;
}

export const QuestionArea: React.FC<QuestionAreaProps> = ({
  question,
  selectedOptionId,
  onOptionSelect,
  isCorrect,
}) => {
  return (
    <div className="h-full flex flex-col p-8 overflow-y-auto">
      <div className="mb-8">
        <span className="text-brand-primary font-semibold text-sm tracking-wider uppercase">Practice</span>
        <h2 className="text-2xl font-bold mt-2 text-slate-900">{question.title}</h2>
      </div>

      <div className="bg-slate-100 rounded-2xl p-6 mb-8 border border-slate-200">
        <p className="text-slate-700 leading-relaxed">{question.description}</p>
      </div>

      <div className="space-y-3">
        {question.options.map((option) => (
          <button
            key={option.id}
            onClick={() => onOptionSelect(option.id)}
            className={cn(
              "w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all group",
              selectedOptionId === option.id
                ? isCorrect === true
                  ? "border-emerald-500 bg-emerald-50"
                  : isCorrect === false
                  ? "border-red-500 bg-red-50"
                  : "border-brand-primary bg-emerald-50"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            )}
          >
            <div
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm transition-colors",
                selectedOptionId === option.id
                  ? isCorrect === true
                    ? "bg-emerald-500 text-white"
                    : isCorrect === false
                    ? "bg-red-500 text-white"
                    : "bg-brand-primary text-white"
                  : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
              )}
            >
              {option.id.toUpperCase()}
            </div>
            <span className={cn(
              "font-medium",
              selectedOptionId === option.id ? "text-slate-900" : "text-slate-600"
            )}>
              {option.text}
            </span>
          </button>
        ))}
      </div>

      {isCorrect !== undefined && (
        <div className={cn(
          "mt-8 p-4 rounded-xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-2",
          isCorrect ? "bg-emerald-100 border-emerald-200 text-emerald-800" : "bg-red-100 border-red-200 text-red-800"
        )}>
          <span className="text-lg">{isCorrect ? '✨ Correct! Great job.' : '❌ Not quite. Try again or ask the AI for a hint!'}</span>
        </div>
      )}
    </div>
  );
};
