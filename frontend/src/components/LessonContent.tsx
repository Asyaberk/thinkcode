import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ArrowRight, FileText, Video, Link as LinkIcon, Presentation, Zap, BookOpen } from 'lucide-react';
import { motion } from 'motion/react';
import { Lesson, Resource } from '../types';
import { cn } from '../lib/utils';

export type AdaptiveMode = 'normal' | 'hidden' | 'intro' | 'advanced';

interface LessonContentProps {
  lesson: Lesson;
  onNext: () => void;
  /**
   * Adaptive Branch modları:
   * - 'normal': normal ders (Start Practice butonu)
   * - 'hidden': ders gösterilmez, sadece "Begin Assessment" (question_first)
   * - 'intro': giriş seviyesi ders + "Try Again" butonu
   * - 'advanced': ileri seviye ders + "Next Section" butonu
   */
  adaptiveMode?: AdaptiveMode;
}

export const LessonContent: React.FC<LessonContentProps> = ({
  lesson,
  onNext,
  adaptiveMode = 'normal',
}) => {
  const isHidden   = adaptiveMode === 'hidden';
  const isIntro    = adaptiveMode === 'intro';
  const isAdvanced = adaptiveMode === 'advanced';

  // question_first: sadece "Begin Assessment" butonu göster
  if (isHidden) {
    return (
      <div className="max-w-4xl mx-auto py-24 px-8 flex flex-col items-center justify-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
            <Zap size={36} className="text-emerald-400" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-white mb-3">{lesson.title}</h2>
            <p className="text-slate-400 text-base max-w-lg mx-auto leading-relaxed">
              Bu konuda bilgini ölçeceğiz. Soruyu cevapla — sonuç ne olursa olsun ders içeriği sana göre şekillenecek.
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onNext}
            className="flex items-center gap-3 bg-emerald-500 text-slate-950 px-10 py-4 rounded-2xl font-bold text-base hover:bg-emerald-400 transition-all shadow-xl shadow-emerald-500/20 mx-auto"
          >
            <Zap size={18} />
            Begin Assessment
            <ArrowRight size={18} />
          </motion.button>
        </motion.div>
      </div>
    );
  }

  const ctaLabel = isIntro ? 'Try the Question Again' : isAdvanced ? 'Next Section →' : 'Start Practice';
  const ctaColor = isAdvanced
    ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-emerald-500/20'
    : 'bg-indigo-500 text-white hover:bg-indigo-400 shadow-indigo-500/20';

  return (
    <div className="max-w-4xl mx-auto py-16 px-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12"
      >
        <div className="flex items-center gap-2 mb-4">
          <span className={cn(
            'px-2.5 py-1 font-bold text-[10px] tracking-widest uppercase rounded-md border',
            isIntro
              ? 'bg-red-500/10 text-red-400 border-red-500/20'
              : isAdvanced
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
          )}>
            {isIntro ? 'Intro Level' : isAdvanced ? 'Advanced' : 'Module 01'}
          </span>
          <div className="h-px w-8 bg-slate-800" />
          <span className="text-slate-500 font-medium text-xs uppercase tracking-widest">
            {isIntro ? 'Başlangıç Seviyesi' : isAdvanced ? 'İleri Seviye' : 'Core Syntax'}
          </span>
        </div>
        <h1 className="text-5xl font-bold text-white tracking-tight leading-[1.1]">
          {lesson.title}
        </h1>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="markdown-body prose prose-invert max-w-none"
      >
        <ReactMarkdown
          components={{
            code({ node, inline, className, children, ...props }: any) {
              const match = /language-(\w+)/.exec(className || '');
              return !inline && match ? (
                <div className="group relative">
                  <div className="absolute top-3 right-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                    {match[1]}
                  </div>
                  <SyntaxHighlighter
                    style={vscDarkPlus}
                    language={match[1]}
                    PreTag="div"
                    className="!rounded-2xl !my-8 !p-6 shadow-2xl border border-white/5"
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                </div>
              ) : (
                <code className={cn("bg-slate-800 px-1.5 py-0.5 rounded text-sm font-medium text-emerald-400", className)} {...props}>
                  {children}
                </code>
              );
            },
          }}
        >
          {lesson.content}
        </ReactMarkdown>
      </motion.div>

      {/* Resources Section */}
      {lesson.resources && lesson.resources.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-16 p-8 bg-slate-900/50 border border-slate-800 rounded-3xl"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <FileText size={16} className="text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">Learning Resources</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lesson.resources.map((resource: Resource) => (
              <a
                key={resource.id}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-4 p-4 bg-slate-950 border border-slate-800 rounded-2xl hover:border-emerald-500/30 hover:bg-slate-900 transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center border border-slate-800 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/20 transition-all">
                  {resource.type === 'PDF'    && <FileText size={18} className="text-rose-400" />}
                  {resource.type === 'Video'  && <Video size={18} className="text-blue-400" />}
                  {resource.type === 'Link'   && <LinkIcon size={18} className="text-emerald-400" />}
                  {resource.type === 'Slides' && <Presentation size={18} className="text-amber-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                    {resource.title}
                  </div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                    {resource.type} • {resource.description}
                  </div>
                </div>
                <ArrowRight size={14} className="text-slate-700 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
              </a>
            ))}
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-20 pt-10 border-t border-slate-800 flex items-center justify-between"
      >
        <div className="text-sm text-slate-500 font-medium">
          {isIntro
            ? 'Konuyu anladın mı? Aynı soruyu tekrar dene!'
            : isAdvanced
            ? 'İleri seviye içeriği tamamladın. Bir sonraki konuya geçmeye hazırsın.'
            : 'Ready to test your knowledge?'}
        </div>
        <button
          onClick={onNext}
          className={cn(
            'group flex items-center gap-3 px-10 py-4 rounded-2xl font-bold hover:scale-[1.02] transition-all shadow-lg active:scale-95',
            ctaColor
          )}
        >
          {isIntro && <BookOpen size={18} />}
          {ctaLabel}
          <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
        </button>
      </motion.div>
    </div>
  );
};
