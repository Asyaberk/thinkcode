/**
 *
 *   - GET /api/v1/analytics/me/dashboard  → profil, streak, mastery, weak topics
 *   - GET /api/v1/analytics/me/streak     → streak_days
 *
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Flame,
  Check,
  CheckCircle2,
  BookOpen,
  Brain,
  ChevronRight,
  Zap,
  Users,
  Clock,
  RotateCcw,
  ArrowRight,
} from 'lucide-react';
import { Section, UserRole } from '../types';
import { cn } from '../lib/utils';
import { Sidebar } from '../components/Sidebar';
import { getMyDashboard, DashboardData, getMyStreak, StreakData } from '../api/analytics';

interface DashboardPageProps {
  sections: Section[];
  onSectionSelect: (id: string) => void;
  onProblemsClick: () => void;
  onAnalyticsClick: () => void;
  onPlaygroundClick?: () => void;
  onInstructorDashboardClick?: () => void;
  onLogout?: () => void;
  onSwitchCourse?: () => void;
  courseName?: string;
  userRole?: UserRole;
  /** Incremented after each submission to trigger a dashboard refresh. */
  refreshKey?: number;
  /** The student's active class ID. */
  classId?: string;
  /** Spaced review items due today for the student. */
  dueReviews?: import('../api/flows').SpacedReviewItem[];
  /** Spaced Review sorusuna git */
  onReviewStart?: (problemId: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  sections,
  onSectionSelect,
  onProblemsClick,
  onAnalyticsClick,
  onPlaygroundClick,
  onInstructorDashboardClick,
  onLogout,
  onSwitchCourse,
  userRole,
  refreshKey = 0,
  classId,
  dueReviews = [],
  onReviewStart,
  courseName,
}) => {
  // ── State ────────────────────────────────────────────────────────────────────
  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [streakData, setStreakData] = useState<StreakData>({ streak_days: 0, last_active: null });
  const [isLoading, setIsLoading] = useState(true);

  // ── API ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [dash, streak] = await Promise.all([
          getMyDashboard(classId),
          getMyStreak().catch(() => ({ streak_days: 0, last_active: null })),
        ]);
        setDashData(dash);
        setStreakData(streak);
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAll();
  }, [refreshKey, classId]);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const completedCount  = sections.filter(s => s.isCompleted).length;
  const totalCount      = sections.length;
  const overallMastery  = dashData?.overall_mastery_score ?? 0;
  const progressPercent = Math.round(overallMastery);
  const percentile      = dashData?.percentile ?? 50;
  const rank            = dashData?.rank ?? null;
  const totalStudents   = dashData?.total_students_in_class ?? 0;
  const firstName       = dashData?.user?.first_name ?? '';
  const lastName        = dashData?.user?.last_name ?? '';
  const fullName        = lastName ? `${firstName} ${lastName}` : firstName;
  const nextSection     = sections.find(s => !s.isCompleted);
  const streakDays      = streakData.streak_days ?? 0;
  const dayLetters      = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const weakTopics = dashData?.weak_topics?.map(t => ({
    name:   t.topic_name,
    reason: `Score: ${Math.round(t.mastery_score)}% — ${t.problems_attempted} problems attempted`,
  })) ?? [];

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-[#0f172a] items-center justify-center">
        <div className="text-slate-400 flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Loading your dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0f172a]">
      <Sidebar
        sections={sections}
        activeSectionId=""
        onSectionSelect={onSectionSelect}
        onDashboardClick={() => {}}
        onProblemsClick={onProblemsClick}
        onAnalyticsClick={onAnalyticsClick}
        onInstructorDashboardClick={onInstructorDashboardClick}
        onSwitchCourse={onSwitchCourse}
        onLogout={onLogout}
        userRole={userRole}
        courseName={courseName}
        progressPercent={totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}
      />

      <div className="flex-1 ml-72 text-slate-200 p-8 lg:p-12">
        <div className="max-w-7xl mx-auto">

          {/* ── Header ───────────────────────────────────────────────────────── */}
          <header className="mb-12 flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div>
              {/* Course code badge */}
              {(dashData?.class_code || courseName) && (
                <div className="flex items-center gap-3 mb-4">
                  {dashData?.class_code && (
                    <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-[10px] font-bold tracking-widest uppercase border border-emerald-500/20">
                      {dashData.class_code}
                    </span>
                  )}
                  {dashData?.class_name && (
                    <span className="text-slate-500 text-xs font-medium">{dashData.class_name}</span>
                  )}
                </div>
              )}
              <motion.h1
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-4xl font-bold text-white tracking-tight mb-2"
              >
                {courseName || dashData?.class_name || 'Dashboard'}
              </motion.h1>
              {fullName && (
                <p className="text-slate-400 font-medium">Welcome back, {fullName}!</p>
              )}
            </div>

            {/* Progress ring */}
            <div className="flex items-center gap-4">
              <div className="bg-[#1e293b]/50 border border-slate-800 rounded-2xl px-6 py-4 flex items-center gap-4 shadow-xl">
                <div className="text-right">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Current Progress</div>
                  <div className="text-2xl font-black text-white">{progressPercent}%</div>
                </div>
                <div className="w-12 h-12 rounded-full flex items-center justify-center p-1 relative">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 44 44">
                    <circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" strokeWidth="4" className="text-slate-800" />
                    <circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" strokeWidth="4" className="text-emerald-500"
                      strokeDasharray={113} strokeDashoffset={113 - (113 * progressPercent) / 100}
                    />
                  </svg>
                </div>
              </div>
            </div>
          </header>

          {/* ── Spaced Review Banner ─────────────────────────────────────────── */}
          {dueReviews.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 p-5 bg-amber-500/8 border border-amber-500/25 rounded-2xl flex items-center gap-5"
            >
              <div className="w-12 h-12 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                <RotateCcw size={20} className="text-amber-400" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-amber-300 mb-0.5 flex items-center gap-2">
                  <Clock size={13} className="text-amber-400" />
                  Spaced Review Due Today!
                </div>
                <div className="text-xs text-slate-400">
                  {dueReviews.length === 1
                    ? `"${dueReviews[0].topic_name ?? 'Konu'}" konusundan 1 tekrar sorunuz var.`
                    : `${dueReviews.length} konudan toplam ${dueReviews.length} tekrar sorunuz var.`}
                </div>
              </div>
              <button
                onClick={() => onReviewStart?.(dueReviews[0].problem_id)}
                className="px-5 py-2.5 bg-amber-500 text-slate-950 text-xs font-bold rounded-xl hover:bg-amber-400 transition-all shrink-0 flex items-center gap-2"
              >
                Start Review <ChevronRight size={12} />
              </button>
            </motion.div>
          )}

          {/* ── Main Grid ────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* ── Left Column ── */}
            <div className="lg:col-span-2 space-y-8">

              {/* Learning Path */}
              <div className="bg-[#1e293b]/30 border border-slate-800 rounded-3xl p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <BookOpen size={20} className="text-emerald-500" />
                    Learning Path
                  </h2>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    {completedCount}/{totalCount} Completed
                  </span>
                </div>

                <div className="space-y-4">
                  {sections.length > 0 ? (
                    sections.map((section, index) => (
                      <div
                        key={section.id}
                        onClick={() => onSectionSelect(section.id)}
                        className={cn(
                          "group flex items-center justify-between p-5 rounded-2xl border transition-all cursor-pointer",
                          section.isCompleted
                            ? "bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40"
                            : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center border font-bold text-sm transition-all",
                            section.isCompleted
                              ? "bg-emerald-500 border-emerald-400 text-slate-950"
                              : "bg-slate-800 border-slate-700 text-slate-400 group-hover:border-emerald-500/50 group-hover:text-emerald-400"
                          )}>
                            {section.isCompleted ? <CheckCircle2 size={20} /> : index + 1}
                          </div>
                          <div>
                            <h3 className={cn("font-bold text-sm mb-0.5", section.isCompleted ? "text-slate-200" : "text-slate-400 group-hover:text-white")}>
                              {section.title}
                            </h3>
                            <p className="text-[11px] text-slate-500">
                              {section.isCompleted ? 'Review Chapter' : 'Next Chapter'}
                            </p>
                          </div>
                        </div>
                        <ChevronRight size={18} className="text-slate-700 group-hover:text-emerald-500 transition-colors" />
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 px-6 border-2 border-dashed border-slate-800 rounded-3xl bg-slate-950/20">
                      <BookOpen size={48} className="mx-auto text-slate-700 mb-4 opacity-50" />
                      <p className="text-slate-500 font-bold tracking-tight">No content has been published for this course yet.</p>
                      <p className="text-[10px] text-slate-600 uppercase tracking-widest mt-2">Check back soon for updates</p>
                    </div>
                  )}
                </div>
              </div>

              {/* AI Weak Topics */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-8"
              >
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-8 flex items-center gap-2">
                  <Brain size={14} />
                  AI Insights: Weak Topics
                </div>
                <div className="space-y-4">
                  {weakTopics.length > 0 ? weakTopics.slice(0, 3).map((topic, i) => (
                    <div key={i} className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800/50 group hover:border-emerald-500/30 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-bold text-white text-sm">{topic.name}</div>
                        <Zap size={14} className="text-emerald-500" />
                      </div>
                      <div className="text-[11px] text-slate-500 leading-relaxed">{topic.reason}</div>
                      <button
                        onClick={onProblemsClick}
                        className="mt-3 text-[10px] font-bold text-emerald-500 uppercase tracking-widest hover:text-emerald-400 transition-colors flex items-center gap-1"
                      >
                        Practice Now <ChevronRight size={10} />
                      </button>
                    </div>
                  )) : (
                    <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800/50 text-center">
                      <div className="text-slate-500 text-sm">Solve some problems to see AI insights!</div>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>

            {/* ── Right Column ── */}
            <div className="space-y-8">

              {/* Streak Card */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-[#1e293b]/30 border border-slate-800 rounded-3xl p-8 relative overflow-hidden"
              >
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-orange-500/10 blur-3xl rounded-full" />
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center text-orange-500 border border-orange-500/20">
                    <Flame size={24} fill="currentColor" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Mastery Streak</div>
                    <div className="text-2xl font-black text-white">
                      {streakDays > 0 ? `${streakDays} ${streakDays === 1 ? 'Day' : 'Days'}` : 'Start Today!'}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-end gap-1 px-1">
                  {dayLetters.map((day, i) => {
                    const active = i < Math.min(streakDays, 7);
                    return (
                      <div key={`${day}-${i}`} className="flex flex-col items-center gap-2">
                        <div className={cn(
                          "w-7 h-10 rounded-lg flex items-center justify-center border transition-all",
                          active
                            ? "bg-orange-500 border-orange-400 text-slate-950"
                            : "bg-slate-800 border-slate-700 text-slate-500"
                        )}>
                          {active
                            ? <Check size={14} strokeWidth={4} />
                            : <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />}
                        </div>
                        <span className="text-[8px] font-bold text-slate-500">{day}</span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>

              {/* Class Performance */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-[#1e293b]/30 border border-slate-800 rounded-3xl p-8"
              >
                <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-wider flex items-center gap-2">
                  <Users size={16} className="text-slate-400" />
                  Class Performance
                </h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-2xl">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Your Score</div>
                    <div className="text-2xl font-bold text-emerald-500">{progressPercent}%</div>
                  </div>
                  <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-2xl">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                      {rank ? 'Rank' : 'Students'}
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {rank ? `#${rank}` : totalStudents > 0 ? totalStudents : '—'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-slate-900/50 border border-slate-800 rounded-2xl">
                  <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center text-slate-400">
                    <Zap size={16} />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Percentile</div>
                    <div className="text-sm font-black text-white">Top {Math.round(100 - percentile)}%</div>
                  </div>
                </div>
              </motion.div>

              {/* Continue Learning CTA */}
              {nextSection && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-emerald-500 rounded-3xl p-8 text-slate-950 shadow-2xl shadow-emerald-500/20"
                >
                  <div className="text-[10px] font-black uppercase tracking-widest mb-6 opacity-60">Continue Learning</div>
                  <h3 className="text-2xl font-bold mb-2 leading-tight">{nextSection.title}</h3>
                  <p className="text-slate-950/70 text-sm font-medium mb-8">Ready to tackle the next topic in your curriculum?</p>
                  <button
                    onClick={() => onSectionSelect(nextSection.id)}
                    className="w-full bg-slate-950 text-white py-4 rounded-2xl font-bold text-xs hover:bg-slate-900 transition-all flex items-center justify-center gap-2 shadow-xl"
                  >
                    Resume Study <ArrowRight size={14} />
                  </button>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
