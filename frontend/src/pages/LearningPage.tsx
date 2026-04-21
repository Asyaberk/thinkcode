import React, { useState, useEffect } from 'react';
import { ChevronRight, Shield, RotateCcw, Clock, GitBranch, CheckCircle, FileText, Video, ExternalLink, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Sidebar } from '../components/Sidebar';
import { LessonContent } from '../components/LessonContent';
import { Section, Lesson, UserRole } from '../types';
import { cn } from '../lib/utils';
import { getTopicResources, TopicResource } from '../api/resources';

const API_BASE = '/api/v1';

interface LearningPageProps {
  sections: Section[];
  activeSectionId: string;
  onSectionSelect: (id: string) => void;
  onDashboardClick: () => void;
  onProblemsClick: () => void;
  onAnalyticsClick: () => void;
  onInstructorDashboardClick?: () => void;
  onLogout?: () => void;
  userRole?: UserRole;
  lesson: Lesson;
  onNext: () => void;
  onComplete?: () => void;  // Next Section (advanced_lesson'dan)
  // Flow-aware props
  flowPattern?: string;
  consecutiveCorrect?: number;
  masteryThreshold?: number;
  /** Adaptive Branch'e özel: hangi asamadayiz */
  adaptivePhase?: 'question_first' | 'intro_lesson' | 'advanced_lesson' | 'confirmation' | null;
}

// Pattern badge konfigürasyonları
const PATTERN_META: Record<string, { icon: any; label: string; color: string; bg: string; border: string }> = {
  mastery_gate: {
    icon: Shield,
    label: 'Mastery Gate',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
  },
  socratic_retry: {
    icon: RotateCcw,
    label: 'Socratic Retry',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
  spaced_retrieval: {
    icon: Clock,
    label: 'Spaced Retrieval',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
  adaptive_branch: {
    icon: GitBranch,
    label: 'Adaptive Branch',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
};

export const LearningPage: React.FC<LearningPageProps> = ({
  sections,
  activeSectionId,
  onSectionSelect,
  onDashboardClick,
  onProblemsClick,
  onAnalyticsClick,
  onInstructorDashboardClick,
  onLogout,
  userRole,
  lesson,
  onNext,
  onComplete,
  flowPattern = 'default',
  consecutiveCorrect = 0,
  masteryThreshold = 3,
  adaptivePhase = null,
}) => {
  const patternMeta = PATTERN_META[flowPattern];
  const isMasteryGate = flowPattern === 'mastery_gate';
  const isAdaptive   = flowPattern === 'adaptive_branch';
  const masteryAchieved = consecutiveCorrect >= masteryThreshold;

  // Kaynak materyalleri — activeSectionId (topic_id) değişince fetch yap
  const [resources, setResources] = useState<TopicResource[]>([]);
  useEffect(() => {
    if (!activeSectionId) return;
    getTopicResources(activeSectionId).then(setResources).catch(() => setResources([]));
  }, [activeSectionId]);

  // Kaynak simgesi
  const resourceIcon = (ft: string) => {
    if (ft === 'video') return <Video size={14} className="text-rose-400" />;
    if (ft === 'pdf')   return <FileText size={14} className="text-amber-400" />;
    return <ExternalLink size={14} className="text-sky-400" />;
  };
  const resourceLabel = (ft: string) => {
    if (ft === 'video') return 'Videoyu İzle';
    if (ft === 'pdf')   return 'PDF’i Aç';
    return 'Kaynağa Git';
  };
  const resourceColor = (ft: string) => {
    if (ft === 'video') return 'border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10 text-rose-300';
    if (ft === 'pdf')   return 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 text-amber-300';
    return 'border-sky-500/30 bg-sky-500/5 hover:bg-sky-500/10 text-sky-300';
  };
  const resourceHref = (r: TopicResource): string => {
    if (r.has_file && r.download_url) {
      const token = localStorage.getItem('access_token') ?? '';
      return `${API_BASE}${r.download_url}${token ? `?token=${token}` : ''}`;
    }
    return r.source_url ?? '#';
  };

  const lockedSectionIds = React.useMemo((): Set<string> => {
    if (isMasteryGate && !masteryAchieved) {
      // Tüm diğer section'lar kilitli — sadece aktif section açık
      return new Set(sections.map(s => s.id).filter(id => id !== activeSectionId));
    }
    // Diğer flow'larda section kilidi yok (Socratic Retry / Spaced Retrieval / Adaptive Branch)
    return new Set();
  }, [isMasteryGate, masteryAchieved, sections, activeSectionId]);

  return (
    <div className="flex h-screen bg-[#0f172a]">
      <Sidebar
        sections={sections}
        activeSectionId={activeSectionId}
        onSectionSelect={onSectionSelect}
        onDashboardClick={onDashboardClick}
        onProblemsClick={onProblemsClick}
        onAnalyticsClick={onAnalyticsClick}
        onInstructorDashboardClick={onInstructorDashboardClick}
        onLogout={onLogout}
        userRole={userRole}
        progressPercent={sections.length > 0 ? Math.round((sections.filter(s => s.isCompleted).length / sections.length) * 100) : 0}
        lockedSectionIds={lockedSectionIds}
        flowPattern={flowPattern}
      />

      <main className="flex-1 ml-72 overflow-y-auto relative">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-[#0f172a]/80 backdrop-blur-md border-b border-slate-800 px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
            <span>Curriculum</span>
            <ChevronRight size={10} />
            <span className="text-white">{lesson.title}</span>
          </div>

          {/* Flow Pattern Badge */}
          {patternMeta && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-widest',
                patternMeta.bg,
                patternMeta.border,
                patternMeta.color
              )}
            >
              <patternMeta.icon size={12} />
              {patternMeta.label}

              {/* Mastery Gate sayacı */}
              {isMasteryGate && (
                <span className="ml-1 flex items-center gap-1">
                  {Array.from({ length: masteryThreshold }).map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        'w-2 h-2 rounded-full transition-all',
                        i < consecutiveCorrect
                          ? 'bg-purple-400 shadow-sm shadow-purple-400/50'
                          : 'bg-slate-700'
                      )}
                    />
                  ))}
                  <span className="ml-1">{consecutiveCorrect}/{masteryThreshold}</span>
                </span>
              )}
            </motion.div>
          )}
        </header>

        {/* Mastery Gate bilgilendirme banner'ı */}
        {isMasteryGate && !masteryAchieved && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-8 mt-6 p-4 bg-purple-500/8 border border-purple-500/20 rounded-2xl flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center shrink-0">
              <Shield size={18} className="text-purple-400" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-purple-300 mb-0.5">Mastery Gate Aktif</div>
              <div className="text-xs text-slate-400 leading-relaxed">
                Bu konuyu tamamlamak için <span className="text-purple-300 font-bold">{masteryThreshold} soruyu art arda</span> doğru
                cevaplamalısın. Şu an: <span className="text-purple-300 font-bold">{consecutiveCorrect}/{masteryThreshold}</span>
              </div>
            </div>
            <div className="flex gap-1.5">
              {Array.from({ length: masteryThreshold }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold transition-all',
                    i < consecutiveCorrect
                      ? 'bg-purple-500/30 text-purple-300 border border-purple-500/40'
                      : 'bg-slate-800/60 text-slate-600 border border-slate-700/40'
                  )}
                >
                  {i < consecutiveCorrect ? <CheckCircle size={14} /> : i + 1}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Mastery Gate başarı banner'ı */}
        {isMasteryGate && masteryAchieved && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mx-8 mt-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-4"
          >
            <CheckCircle size={20} className="text-emerald-400 shrink-0" />
            <div>
              <div className="text-sm font-bold text-emerald-300">Mastery Gate Geçildi! 🎉</div>
              <div className="text-xs text-slate-400">{masteryThreshold} soruyu art arda doğru cevaplaştın. Bir sonraki konuya geçebilirsin.</div>
            </div>
          </motion.div>
        )}

        {/* Spaced Retrieval bildirim banner'ı */}
        {flowPattern === 'spaced_retrieval' && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-8 mt-6 p-4 bg-amber-500/8 border border-amber-500/20 rounded-2xl flex items-center gap-3"
          >
            <Clock size={16} className="text-amber-400 shrink-0" />
            <div className="text-xs text-slate-400">
              <span className="text-amber-300 font-bold">Spaced Retrieval</span> aktif.
              Bu konu için 1. gün, 3. gün ve 7. gün tekrar soruları planlandı.
            </div>
          </motion.div>
        )}

        {/* Adaptive Branch bildirim banner'ı */}
        {flowPattern === 'adaptive_branch' && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-8 mt-6 p-4 bg-emerald-500/8 border border-emerald-500/20 rounded-2xl flex items-center gap-3"
          >
            <GitBranch size={16} className="text-emerald-400 shrink-0" />
            <div className="text-xs text-slate-400">
              <span className="text-emerald-300 font-bold">Adaptive Branch</span> aktif.
              İlk sorular seviyeni belirleyecek ve içerik buna göre şekillenecek.
            </div>
          </motion.div>
        )}


        {/* Adaptive Branch bannerları */}
        {isAdaptive && adaptivePhase === 'question_first' && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-8 mt-6 p-4 bg-emerald-500/8 border border-emerald-500/20 rounded-2xl flex items-center gap-3"
          >
            <GitBranch size={16} className="text-emerald-400 shrink-0" />
            <div>
              <div className="text-sm font-bold text-emerald-300 mb-0.5">Adaptive Branch</div>
              <div className="text-xs text-slate-400">Önce bir soru çöz — seviyene göre içerik şekillenecek.</div>
            </div>
          </motion.div>
        )}
        {isAdaptive && adaptivePhase === 'intro_lesson' && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            className="mx-8 mt-6 p-4 bg-red-500/8 border border-red-500/20 rounded-2xl flex items-center gap-3"
          >
            <GitBranch size={16} className="text-red-400 shrink-0" />
            <div>
              <div className="text-sm font-bold text-red-300 mb-0.5">Konuyu Sıfırdan Öğrenelim</div>
              <div className="text-xs text-slate-400">Soruyu henüz çözemedin. Konuyu baştan anlatalım, ardından tekrar deneyeceksin.</div>
            </div>
          </motion.div>
        )}
        {isAdaptive && adaptivePhase === 'advanced_lesson' && (
          <motion.div
            key="advanced"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            className="mx-8 mt-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3"
          >
            <CheckCircle size={16} className="text-emerald-400 shrink-0" />
            <div>
              <div className="text-sm font-bold text-emerald-300 mb-0.5">Harika! İleri Seviyeye Geç</div>
              <div className="text-xs text-slate-400">Soruyu doğru cevaplatın. İleri seviye içeriği okuyabilirsin, ardından bir sonraki konuya geçeceksin.</div>
            </div>
          </motion.div>
        )}

        {/* Confirmation banner — lesson'dan sonra aynı soruyu onaylama */}
        {isAdaptive && adaptivePhase === 'confirmation' && (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mx-8 mt-6 p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl flex items-center gap-3"
          >
            <CheckCircle size={16} className="text-indigo-400 shrink-0" />
            <div>
              <div className="text-sm font-bold text-indigo-300 mb-0.5">Öğrendiklerini Test Et</div>
              <div className="text-xs text-slate-400">Dersi tamamladın! Şimdi aynı soruyu tekrar çöz ve öğrendiklerini kanıtla.</div>
            </div>
          </motion.div>
        )}

        <LessonContent
          lesson={lesson}
          onNext={onNext}
          adaptiveMode={
            isAdaptive
              ? adaptivePhase === 'intro_lesson' ? 'intro'
              : adaptivePhase === 'advanced_lesson' ? 'advanced'
              : 'hidden'
              : 'normal'
          }
        />

        {/* Kaynak Materyalleri — sadece kaynak varsa göster */}
        <AnimatePresence>
          {resources.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.3 }}
              className="mx-8 mb-10"
            >
              <div className="bg-[#1a2235] border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-slate-700/60 flex items-center justify-center">
                    <BookOpen size={14} className="text-slate-300" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Kaynak Materyalleri</h3>
                  <span className="text-[10px] text-slate-600 ml-1">Bu dersin çıktığı kaynaklar</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {resources.map(res => (
                    <a
                      key={res.resource_id}
                      href={resourceHref(res)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        'flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all',
                        resourceColor(res.file_type)
                      )}
                    >
                      {resourceIcon(res.file_type)}
                      <span className="max-w-[180px] truncate">{res.title}</span>
                      {res.week_name && (
                        <span className="text-[10px] opacity-60 font-normal">{res.week_name}</span>
                      )}
                      <span className="text-[10px] opacity-50 ml-1">→ {resourceLabel(res.file_type)}</span>
                    </a>
                  ))}
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
};
