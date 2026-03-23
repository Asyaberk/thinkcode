import React, { useState, useRef } from 'react';
import { ChevronLeft, ArrowRight, BookOpen, ExternalLink, CheckCircle, XCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { ChatQuestionInterface, ChatQuestionInterfaceRef } from '../components/ChatQuestionInterface';
import { CodePlayground } from '../components/CodePlayground';
import { Question, Resource } from '../types';
import { useSubmission } from '../hooks/useSubmission';
import { useHint } from '../hooks/useHint';

interface QuestionPageProps {
  question: Question | null;
  classId?: string;
  onBack: () => void;
  onComplete: () => void;
  /** Submission sonrasi (dogru veya yanlis) hemen cagirilir — mastery refresh icin */
  onSubmission?: (isCorrect: boolean) => void;
}

export const QuestionPage: React.FC<QuestionPageProps> = ({
  question,
  classId = '',
  onBack,
  onComplete,
  onSubmission,
}) => {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [code, setCode] = useState(question?.starterCode ?? '');
  const [output, setOutput] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);
  // Submission ve hint hook'lari — DB ile senkron
  const { submit, result: submissionResult, isSubmitting, reset: resetSubmission } = useSubmission();
  const { requestHint, hintCount, isLoadingHint } = useHint();
  const chatRef = useRef<ChatQuestionInterfaceRef>(null);

  // Soru yuklenmemisse loading ekrani goster
  if (!question) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{background: '#0d1117'}}>
        <div style={{color: '#00ff88', textAlign: 'center'}}>
          <div style={{fontSize: '2rem', marginBottom: '1rem'}}>⏳</div>
          <p style={{color: '#8b949e'}}>Loading question...</p>
        </div>
      </div>
    );
  }

  /**
   * handleRun — Check Solution butonuna basilinca calisir.
   * MCQ: selected_option_id backend'e gonderilir, backend dogru/yanlis hesaplar.
   * Coding: submitted_code gonderilir.
   * Open Response: submitted_answer gonderilir.
   * Her turde submitAnswer() API cagrisi yapilir → mastery DB'ye kaydedilir.
   */
  const handleRun = async () => {
    if (isSubmitting) return;

    if (question.type === 'Open Response' && code.trim().length < 20) {
      setOutput('Error: Too short. Please provide a more detailed explanation.');
      chatRef.current?.addFeedback(false, 'Expand your answer with more detail.');
      return;
    }
    if (question.type === 'Multiple Choice' && !selectedOptionId) {
      setOutput('Please select an answer option first.');
      return;
    }

    setOutput('Checking...');
    resetSubmission();

    try {
      // useSubmission hook — class_id artik optional (backend enrollment'dan alir)
      const result = await submit({
        problem_id: question.problemId || question.id,
        class_id: classId || undefined,
        selected_option_id: question.type === 'Multiple Choice' ? selectedOptionId ?? undefined : undefined,
        submitted_code: question.type === 'Coding' ? code : undefined,
        submitted_answer: question.type === 'Open Response' ? code : undefined,
        time_spent_seconds: 0,
      });

      const isCorrect = result.is_correct ?? false;
      const feedback = result.feedback
        || (isCorrect ? question.explanation : `Not quite. ${question.explanation}`);
      const rawScore = result.score;

      // Submission tamamlandi — hem dogru hem yanlis durumda mastery'i guncelle
      onSubmission?.(isCorrect);

      if (isCorrect) {
        setOutput(`Checking...\n\n✓ CORRECT! Score: ${rawScore ?? 10} / 10 pts\n\n${feedback}`);
        chatRef.current?.addFeedback(true, feedback);
        setIsCompleted(true);
      } else {
        setOutput(`Checking...\n\n✗ Incorrect. Score: ${rawScore ?? 0} / 10 pts\n\n${feedback}`);
        chatRef.current?.addFeedback(false, feedback);
        chatRef.current?.addErrorExplanation(
          question.type === 'Multiple Choice' ? `Selected: ${selectedOptionId}` : code,
          feedback
        );
      }
    } catch (err) {
      // API hatasi: offline MCQ fallback
      console.error('Submission error:', err);
      if (question.type === 'Multiple Choice') {
        const isCorrect = selectedOptionId === question.correctOptionId;
        if (isCorrect) {
          setOutput(`✓ CORRECT! (offline)\n\n${question.explanation}`);
          chatRef.current?.addFeedback(true, question.explanation);
          setIsCompleted(true);
        } else {
          setOutput(`✗ Incorrect. (offline)\n\n${question.explanation}`);
          chatRef.current?.addFeedback(false, question.explanation);
        }
      } else {
        setOutput('Error: Could not submit. Please check your connection.');
      }
    }
  };

  const handleExplain = () => {
    chatRef.current?.addMessage('user', 'Can you explain this code to me?');
    chatRef.current?.addExplanation(code);
  };

  /**
   * handleOptionSelect — MCQ sikti secildiginde calisir.
   * _ANSWER_ placeholder'ini secilen sikin metniyle doldurur.
   * Placeholder yoksa onceki secenegi degistirir, o da yoksa Answer: satirini gunceller.
   */
  const handleOptionSelect = (id: string) => {
    setSelectedOptionId(id);
    resetSubmission(); // Onceki submission sonucunu temizle (useSubmission hook)
    const optionText = question.options?.find(o => o.id === id)?.text || '';

    let newCode = code;
    if (newCode.includes('_ANSWER_')) {
      // _ANSWER_ placeholder yerine secilen metni yaz
      newCode = newCode.replace('_ANSWER_', optionText);
    } else {
      // Onceden secilmis sik var mi? Onu degistir
      const existingOption = question.options?.find(o => newCode.includes(o.text));
      if (existingOption) {
        newCode = newCode.replace(existingOption.text, optionText);
      } else if (/Answer: .+/.test(newCode)) {
        newCode = newCode.replace(/Answer: .+/, `Answer: ${optionText}`);
      } else {
        newCode += `\nAnswer: ${optionText}`;
      }
    }
    setCode(newCode);
    setOutput('');
  };

  // Submission sonucuna gore sol panelin border rengi (useSubmission hook'undan gelir)
  const resultBorderClass = submissionResult === null
    ? ''
    : submissionResult.is_correct ? 'ring-2 ring-emerald-500/50' : 'ring-2 ring-red-500/50';

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

          {/* Dogru/Yanlis rozeti — submission sonrasi belirir */}
          {submissionResult && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold ${
                submissionResult.is_correct
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-red-500/10 text-red-400 border border-red-500/30'
              }`}
            >
              {submissionResult.is_correct
                ? <><CheckCircle size={14} /> Correct! +{submissionResult.score ?? 10} pts</>
                : <><XCircle size={14} /> Incorrect — try again</>
              }
            </motion.div>
          )}

          {/* Next Section butonu sadece dogru cevap sonrasi goster */}
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
            <div className="text-sm font-bold text-white">{question.title}</div>
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

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sol: Kod Editoru + MCQ Siklari */}
        <div className={`w-1/2 bg-slate-900 p-6 flex flex-col ${resultBorderClass} transition-all`}>
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
            isSubmitting={isSubmitting}
          />
        </div>

        {/* Sag: AI Tutor Chat */}
        <div className="w-1/2 flex flex-col">
          <div className="flex-1 overflow-hidden">
            <ChatQuestionInterface ref={chatRef} question={question} />
          </div>

          {/* Ilgili kaynaklar */}
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