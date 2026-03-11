import React, { useState, useRef } from 'react';
import { ChevronLeft, ArrowRight, BookOpen, ExternalLink } from 'lucide-react';
import { motion } from 'motion/react';
import { ChatQuestionInterface, ChatQuestionInterfaceRef } from '../components/ChatQuestionInterface';
import { CodePlayground } from '../components/CodePlayground';
import { Question, Resource } from '../types';

interface QuestionPageProps {
  question: Question;
  onBack: () => void;
  onComplete: () => void;
}

export const QuestionPage: React.FC<QuestionPageProps> = ({ question, onBack, onComplete }) => {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [code, setCode] = useState(question.starterCode);
  const [output, setOutput] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);
  const chatRef = useRef<ChatQuestionInterfaceRef>(null);

  const handleRun = () => {
    if (question.type === 'Open Response') {
      if (code.trim().length > 20) {
        setOutput('Analyzing response...\n\n[SUCCESS] Response recorded. AI tutor will provide feedback shortly.');
        chatRef.current?.addFeedback(true, "Great explanation! You've captured the core concepts.");
        setIsCompleted(true);
      } else {
        setOutput('Error: Response too short. Please provide a more detailed explanation.');
        chatRef.current?.addFeedback(false, "Try to expand on your answer. Think about the time complexity and memory usage.");
      }
      return;
    }

    // Basic validation: check if the user's code contains the correct snippet
    // In a real app, this would be a server-side compilation/test
    const correctSnippet = question.options.find(o => o.id === question.correctOptionId)?.text || '';
    const isCorrect = code.includes(correctSnippet) && code.includes('std::cout');
    
    if (isCorrect) {
      setOutput('Compiling...\nRunning...\n\nHello World\n\n[SUCCESS] Code executed correctly!');
      chatRef.current?.addFeedback(true, question.explanation);
      setIsCompleted(true);
    } else {
      const errorMsg = 'Compiling...\nError: Compilation failed or output mismatch. Ensure you are using the correct standard output syntax.';
      setOutput(errorMsg);
      chatRef.current?.addFeedback(false, question.explanation);
      
      // AI Error Explanation
      chatRef.current?.addErrorExplanation(code, errorMsg);
    }
  };

  const handleExplain = () => {
    chatRef.current?.addMessage('user', 'Can you explain this code to me?');
    chatRef.current?.addExplanation(code);
  };

  const handleOptionSelect = (id: string) => {
    setSelectedOptionId(id);
    const optionText = question.options.find(o => o.id === id)?.text || '';
    
    let newCode = code;
    // Try to find if any existing option text is already in the code
    const existingOption = question.options.find(o => code.includes(o.text));
    
    if (code.includes('_____')) {
      newCode = code.replace('_____', optionText);
    } else if (existingOption) {
      // Replace the old option with the new one
      newCode = code.replace(existingOption.text, optionText);
    } else {
      // If neither blank nor option found (user might have deleted it), 
      // we don't force a change to avoid destroying user's manual work,
      // but we could optionally append or just let them type.
    }
    
    setCode(newCode);
    setOutput('');
  };

  return (
    <div className="h-screen flex flex-col bg-[#0f172a]">
      {/* Header */}
      <header className="h-20 border-b border-slate-800 flex items-center justify-between px-10 bg-[#0f172a] z-10">
        <div className="flex items-center gap-6">
          <button
            onClick={onBack}
            className="group flex items-center gap-3 text-slate-500 hover:text-white font-bold text-xs uppercase tracking-widest transition-all"
          >
            <ChevronLeft size={18} className="transition-transform group-hover:-translate-x-1" />
            Back to Lesson
          </button>
          
          {isCompleted && (
            <motion.button
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={onComplete}
              className="flex items-center gap-2 bg-emerald-500 text-slate-950 px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
            >
              Next Section
              <ArrowRight size={14} />
            </motion.button>
          )}
        </div>

        <div className="flex items-center gap-8">
          <div className="flex flex-col items-end">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-1">
              Current Challenge
            </div>
            <div className="text-sm font-bold text-white">
              {question.title}
            </div>
          </div>
          <div className="h-10 w-px bg-slate-800" />
          <div className="flex items-center gap-4">
            <div className="h-1.5 w-32 bg-slate-800 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: isCompleted ? '100%' : '50%' }}
                className="h-full bg-emerald-500 transition-all duration-1000" 
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content: Integrated Playground & Chat */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Code Playground with Options */}
        <div className="w-1/2 bg-slate-900 p-6 flex flex-col">
          <CodePlayground
            code={code}
            onCodeChange={setCode}
            onRun={handleRun}
            onExplain={handleExplain}
            output={output}
            description={question.description}
            options={question.options}
            selectedOptionId={selectedOptionId}
            onOptionSelect={handleOptionSelect}
            type={question.type}
          />
        </div>

        {/* Right: Chat Interface for Feedback & Explanation */}
        <div className="w-1/2 flex flex-col">
          <div className="flex-1 overflow-hidden">
            <ChatQuestionInterface
              ref={chatRef}
              question={question}
            />
          </div>

          {/* Related Resources Section */}
          {question.relatedResources && question.relatedResources.length > 0 && (
            <div className="h-48 border-t border-slate-800 bg-slate-950 p-6 overflow-y-auto">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen size={14} className="text-emerald-500" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Related Learning Materials</span>
              </div>
              <div className="space-y-2">
                {question.relatedResources.map((resource: Resource) => (
                  <a
                    key={resource.id}
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-xl hover:border-emerald-500/30 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        {resource.type}
                      </div>
                      <span className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">{resource.title}</span>
                    </div>
                    <ExternalLink size={12} className="text-slate-600 group-hover:text-emerald-500 transition-colors" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
