import React, { useState, useRef } from 'react';

import { ChevronLeft, ArrowRight, BookOpen, ExternalLink, CheckCircle, XCircle, Shield, RotateCcw, RefreshCw } from 'lucide-react';

import { motion, AnimatePresence } from 'motion/react';

import { ChatQuestionInterface, ChatQuestionInterfaceRef } from '../components/ChatQuestionInterface';

import { CodePlayground } from '../components/CodePlayground';

import { Question, Resource } from '../types';

import { useSubmission } from '../hooks/useSubmission';

import { useHint } from '../hooks/useHint';

import type { FlowConfig } from '../api/flows';

interface QuestionPageProps {

  question: Question | null;

  classId?: string;

  onBack: () => void;

  onComplete: () => void;

  /** Submission sonrasi (dogru veya yanlis) hemen cagirilir — mastery refresh icin */

  onSubmission?: (isCorrect: boolean) => void;

  /** Mastery Gate: advance to the next question (increments masteryQuestionIndex in App.tsx). */

  onNextQuestion?: () => void;

  /** Mastery Gate: current question number (1-based, for display). */

  questionNumber?: number;

  /** Mastery Gate: total number of questions in the gate sequence. */

  questionsTotal?: number;

  // Flow-aware props

  flowPattern?: string;

  flowConfig?: FlowConfig;

  consecutiveCorrect?: number;

  /** Adaptive Branch: current phase — confirmation phase shows a banner. */

  adaptivePhase?: 'question_first' | 'intro_lesson' | 'advanced_lesson' | 'confirmation' | null;

}

export const QuestionPage: React.FC<QuestionPageProps> = ({

  question,

  classId = '',

  onBack,

  onComplete,

  onSubmission,

  onNextQuestion,

  questionNumber,

  questionsTotal,

  flowPattern = 'default',

  flowConfig = {},

  consecutiveCorrect = 0,

  adaptivePhase = null,

}) => {

  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

  const [code, setCode] = useState(question?.starterCode ?? '');

  const [output, setOutput] = useState('');

  const [isCompleted, setIsCompleted] = useState(false);

  // Socratic Retry state

  const [retryCount, setRetryCount] = useState(0);

  const [showSocraticHint, setShowSocraticHint] = useState(false);

  const [socraticHintText, setSocraticHintText] = useState('');

  const { submit, result: submissionResult, isSubmitting, reset: resetSubmission } = useSubmission();

  const { requestHint, isLoadingHint } = useHint();

  const chatRef = useRef<ChatQuestionInterfaceRef>(null);

  const isMasteryGate  = flowPattern === 'mastery_gate';

  const isSocraticRetry = flowPattern === 'socratic_retry';

  const masteryThreshold = flowConfig?.consecutive_correct ?? 3;

  const maxHints        = flowConfig?.max_hints ?? 2;

  const masteryGateUnlocked = !isMasteryGate || consecutiveCorrect >= masteryThreshold;

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

   */

  const handleRun = async () => {

    if (isSubmitting) return;

    setShowSocraticHint(false);

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

      onSubmission?.(isCorrect);

      if (isCorrect) {

        setOutput(`Checking...\n\n✓ CORRECT! Score: ${rawScore ?? 10} / 10 pts\n\n${feedback}`);

        chatRef.current?.addFeedback(true, feedback);

        setIsCompleted(true);

        setShowSocraticHint(false);

        setRetryCount(0);

      } else {

        if (isSocraticRetry && retryCount < maxHints) {

          const socraticQuestions = [

            'Which step do you think you got stuck on?',

            'Let\'s revisit the core concept. What do you think should happen here?',

            'Can you explain in your own words how you would approach the solution?',

          ];

          const hintText = socraticQuestions[retryCount % socraticQuestions.length];

          setSocraticHintText(hintText);

          setShowSocraticHint(true);

          setOutput(`Checking...\n\n✗ Not quite. Here's a hint...`);

          chatRef.current?.addFeedback(false, hintText);

          setRetryCount(prev => prev + 1);

        } else {

          setOutput(`Checking...\n\n✗ Incorrect. Score: ${rawScore ?? 0} / 10 pts\n\n${feedback}`);

          chatRef.current?.addFeedback(false, feedback);

          chatRef.current?.addErrorExplanation(

            question.type === 'Multiple Choice' ? `Selected: ${selectedOptionId}` : code,

            feedback

          );

          setShowSocraticHint(false);

        }

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

          onSubmission?.(true);

        } else {

          if (isSocraticRetry && retryCount < maxHints) {

            setSocraticHintText('Review your selection. Which option do you think is correct?');

            setShowSocraticHint(true);

            setOutput(`✗ Not quite. Try again!`);

            setRetryCount(prev => prev + 1);

          } else {

            setOutput(`✗ Incorrect. (offline)\n\n${question.explanation}`);

            chatRef.current?.addFeedback(false, question.explanation);

          }

          onSubmission?.(false);

        }

      } else {

        setOutput('Error: Could not submit. Please check your connection.');

      }

    }

  };

  const handleRetry = () => {

    setShowSocraticHint(false);

    setOutput('');

    resetSubmission();

    if (question.type === 'Multiple Choice') {

      setSelectedOptionId(null);

      setCode(question.starterCode ?? '');

    }

  };

  const handleExplain = () => {

    chatRef.current?.addMessage('user', 'Can you explain this code to me?');

    chatRef.current?.addExplanation(code);

  };

  const handleOptionSelect = (id: string) => {

    setSelectedOptionId(id);

    resetSubmission();

    setShowSocraticHint(false);

    const optionText = question.options?.find(o => o.id === id)?.text || '';

    let newCode = code;

    if (newCode.includes('_ANSWER_')) {

      newCode = newCode.replace('_ANSWER_', optionText);

    } else {

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

  const resultBorderClass = submissionResult === null

    ? ''

    : submissionResult.is_correct ? 'ring-2 ring-emerald-500/50' : 'ring-2 ring-red-500/50';

  return (

    <div className="h-screen flex flex-col bg-[#0f172a]">

      {/* Adaptive Branch: Confirmation Banner */}

      {adaptivePhase === 'confirmation' && (

        <motion.div

          initial={{ opacity: 0, y: -12 }}

          animate={{ opacity: 1, y: 0 }}

          className="bg-indigo-500/10 border-b border-indigo-500/25 px-10 py-3 flex items-center gap-3"

        >

          <div className="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">

            <CheckCircle size={14} className="text-indigo-400" />

          </div>

          <div>

            <span className="text-xs font-bold text-indigo-300">🎯 Final Check — Prove What You've Learned</span>

            <span className="text-xs text-slate-400 ml-2">You finished the lesson! Solve this question again to advance to the next topic.</span>

          </div>

        </motion.div>

      )}

      {/* Header */}

      <header className="h-20 border-b border-slate-800 flex items-center justify-between px-10 bg-[#0f172a] z-10">

        <div className="flex items-center gap-6">

          {adaptivePhase !== 'confirmation' && (

            <button

              onClick={onBack}

              className="group flex items-center gap-3 text-slate-500 hover:text-white font-bold text-xs uppercase tracking-widest transition-all"

            >

              <ChevronLeft size={18} className="transition-transform group-hover:-translate-x-1" />

              Back to Lesson

            </button>

          )}

          {adaptivePhase === 'confirmation' && (

            <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-widest">

              <CheckCircle size={14} />

              Confirmation Test

            </div>

          )}

          {/* Submission result badge */}

          {submissionResult && !showSocraticHint && (

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

          {/* Socratic Retry ipucu rozeti */}

          {showSocraticHint && (

            <motion.div

              initial={{ opacity: 0, scale: 0.8 }}

              animate={{ opacity: 1, scale: 1 }}

              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30"

            >

              <RotateCcw size={14} />

              Socratic Hint — {retryCount}/{maxHints}

            </motion.div>

          )}

          {/* Next Section / Mastery Gate: Next Question butonu */}

          {isCompleted && (

            masteryGateUnlocked ? (

              <motion.button

                initial={{ opacity: 0, x: -10 }}

                animate={{ opacity: 1, x: 0 }}

                onClick={onComplete}

                className="flex items-center gap-2 bg-emerald-500 text-slate-950 px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"

              >

                Next Section <ArrowRight size={14} />

              </motion.button>

            ) : isMasteryGate && onNextQuestion ? (

              <motion.button

                initial={{ opacity: 0, x: -10 }}

                animate={{ opacity: 1, x: 0 }}

                onClick={onNextQuestion}

                className="flex items-center gap-2 bg-purple-500/20 text-purple-300 border border-purple-500/40 px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-purple-500/30 transition-all active:scale-95"

              >

                <Shield size={14} />

                Next Question &rarr; ({consecutiveCorrect}/{masteryThreshold} ✓)

              </motion.button>

            ) : null

          )}

          {/* Socratic Retry: Tekrar Dene butonu */}

          {showSocraticHint && (

            <motion.button

              initial={{ opacity: 0, x: -10 }}

              animate={{ opacity: 1, x: 0 }}

              onClick={handleRetry}

              className="flex items-center gap-2 bg-blue-500/20 text-blue-300 border border-blue-500/30 px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-blue-500/30 transition-all"

            >

              <RefreshCw size={14} />

              Tekrar Dene

            </motion.button>

          )}

        </div>

        <div className="flex items-center gap-8">

          {/* Mastery Gate: question number (Q1, Q2, Q3) */}

          {isMasteryGate && (

            <motion.div

              initial={{ opacity: 0 }}

              animate={{ opacity: 1 }}

              className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-xl"

            >

              <Shield size={12} className="text-purple-400" />

              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Mastery Gate</span>

              {questionNumber && (

                <span className="text-[10px] text-purple-300 ml-1">Q{questionNumber}</span>

              )}

              <div className="flex gap-1 ml-1">

                {Array.from({ length: masteryThreshold }).map((_, i) => (

                  <span

                    key={i}

                    className={`w-2 h-2 rounded-full transition-all duration-300 ${

                      i < consecutiveCorrect

                        ? 'bg-purple-400 shadow-sm shadow-purple-400/60'

                        : 'bg-slate-700'

                    }`}

                  />

                ))}

              </div>

              <span className="text-[10px] font-bold text-purple-300">{consecutiveCorrect}/{masteryThreshold}</span>

            </motion.div>

          )}

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

                animate={{ width: isCompleted ? '100%' : isMasteryGate ? `${(consecutiveCorrect / masteryThreshold) * 100}%` : '50%' }}

                className={`h-full transition-all duration-1000 ${isMasteryGate ? 'bg-purple-500' : 'bg-emerald-500'}`}

              />

            </div>

          </div>

        </div>

      </header>

      {/* Socratic Hint Banner */}

      <AnimatePresence>

        {showSocraticHint && (

          <motion.div

            initial={{ opacity: 0, y: -10 }}

            animate={{ opacity: 1, y: 0 }}

            exit={{ opacity: 0, y: -10 }}

            className="border-b border-blue-500/20 bg-blue-500/5 px-10 py-4 flex items-start gap-4"

          >

            <div className="w-8 h-8 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0 mt-0.5">

              <RotateCcw size={16} className="text-blue-400" />

            </div>

            <div>

              <div className="text-sm font-bold text-blue-300 mb-1">Socratic Hint #{retryCount}</div>

              <div className="text-sm text-slate-300 leading-relaxed">{socraticHintText}</div>

              <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest">

                You have {maxHints - retryCount} attempt(s) left before the answer is revealed

              </div>

            </div>

          </motion.div>

        )}

      </AnimatePresence>

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

                {question.relatedResources.map((resource: Resource) => {
                  const isApiDownload = resource.url?.startsWith('/api/');
                  const handleResourceClick = async (e: React.MouseEvent) => {
                    if (!isApiDownload) return; // external URLs open normally
                    e.preventDefault();
                    const token = localStorage.getItem('access_token') ?? '';
                    try {
                      // Fetch the presigned redirect with auth header
                      const resp = await fetch(resource.url, {
                        headers: { Authorization: `Bearer ${token}` },
                        redirect: 'follow',
                      });
                      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                      // resp.url is the final presigned MinIO URL after the redirect
                      window.open(resp.url, '_blank', 'noopener,noreferrer');
                    } catch {
                      // Fallback: append token as query param (works for non-CORS environments)
                      window.open(`${resource.url}?token=${encodeURIComponent(token)}`, '_blank', 'noopener,noreferrer');
                    }
                  };

                  return (
                    <a
                      key={resource.id}
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={handleResourceClick}
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
                  );
                })}

              </div>

            </div>

          )}

        </div>

      </div>

    </div>

  );

};
