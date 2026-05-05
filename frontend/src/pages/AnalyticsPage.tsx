import React, { useState, useEffect } from 'react';

import { motion } from 'motion/react';

import { 

  BarChart, 

  Bar, 

  XAxis, 

  YAxis, 

  CartesianGrid, 

  Tooltip, 

  ResponsiveContainer, 

  LineChart, 

  Line, 

  AreaChart,

  Area,

  PieChart, 

  Pie, 

  Cell,

  Legend

} from 'recharts';

import { 

  BarChart3, 

  Clock, 

  HelpCircle, 

  Brain, 

  TrendingUp, 

  ChevronRight,

  Sparkles,

  Users,

  AlertTriangle,

  Trophy

} from 'lucide-react';

import { Sidebar } from '../components/Sidebar';

import { Section, UserRole } from '../types';

import { cn } from '../lib/utils';

// AI insight is called via api.get directly (to pass class_id)

import { api } from '../api/client';

interface AnalyticsPageProps {

  sections: Section[];

  onSectionSelect: (id: string) => void;

  onDashboardClick: () => void;

  onProblemsClick: () => void;

  onInstructorDashboardClick?: () => void;

  onLogout?: () => void;

  onSwitchCourse?: () => void;

  courseName?: string;

  userRole?: UserRole;

  /** Active class UUID — drives all analytics API calls with ?class_id=. */
  activeCourseId?: string;

}

// Pasta grafik renk paleti (Hint Usage pie chart)

const COLORS = ['#10b981', '#3b82f6', '#f59e0b'];

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({

  sections,

  onSectionSelect,

  onDashboardClick,

  onProblemsClick,

  onInstructorDashboardClick,

  onLogout,

  onSwitchCourse,

  courseName,

  userRole,

  activeCourseId,

}) => {

  const [aiInsight, setAiInsight] = useState<string>("Analyzing your performance data...");

  const [isAnalyzing, setIsAnalyzing] = useState(true);

  const [allTopics, setAllTopics] = useState<any[]>([]);

  const [accuracyData, setAccuracyData] = useState<{topic:string;accuracy:number}[]>([]);

  const [codingTimeData, setCodingTimeData] = useState<{date:string;total:number;correct:number}[]>([]);

  const [hintUsageData, setHintUsageData] = useState<{name:string;value:number}[]>([]);

  const [classDifficultyData, setClassDifficultyData] = useState<any[]>([]);

  const [positionData, setPositionData] = useState<{name:string;students:number}[]>([]);

  const [overallScore, setOverallScore] = useState<number | null>(null);

  const [rank, setRank] = useState<number | null>(null);

  const [totalStudents, setTotalStudents] = useState<number>(0);

  const [percentile, setPercentile] = useState<number | null>(null);

  const [totalSolved, setTotalSolved] = useState<number>(0);

  const [avgTimeMinutes, setAvgTimeMinutes] = useState<number>(0);

  const [streakDays, setStreakDays] = useState<number>(0);

  const [classAvgScore, setClassAvgScore] = useState<number | null>(null);

  const [topPerformerScore, setTopPerformerScore] = useState<number | null>(null);

  const [avgHintUsage, setAvgHintUsage] = useState<number | null>(null);

  // class standing
  const [insightRank, setInsightRank] = useState<number | null>(null);

  const [insightPercentile, setInsightPercentile] = useState<number | null>(null);

  const [insightTotalStudents, setInsightTotalStudents] = useState<number>(0);

  const [classCode, setClassCode] = useState<string | undefined>(undefined);

  const [classNameStr, setClassNameStr] = useState<string | undefined>(undefined);

  useEffect(() => {

    const fetchAll = async () => {

      // Build the class_id query string once
      const classQs = activeCourseId ? `?class_id=${activeCourseId}` : '';

      try {

        // 1. AI Insight — pass class_id so rank/percentile are course-specific
        const insightResult = await api.get<any>(`/analytics/me/ai-insight${classQs}`);

        setAiInsight(
          insightResult.insight ||
          "Focus on graph algorithms — they show the most room for improvement. Strong foundation in sorting!"
        );

        if (insightResult.rank != null) setInsightRank(insightResult.rank);
        if (insightResult.percentile != null) setInsightPercentile(insightResult.percentile);
        if (insightResult.total_students) setInsightTotalStudents(insightResult.total_students);

      } catch {

        setAiInsight(
          "You're making great progress! Focus on graph theory and dynamic programming for the biggest gains."
        );

      } finally {

        setIsAnalyzing(false);

      }

      try {

        // 2. Dashboard — filtered by activeCourseId
        const dashboard = await api.get<any>(`/analytics/me/dashboard${classQs}`);

        setOverallScore(Math.round(Number(dashboard.overall_mastery_score) || 0));
        // Prefer dashboard rank (always computed); fall back to insight rank
        const dashRank = dashboard.rank != null ? Number(dashboard.rank) : null;
        setRank(dashRank);
        if (dashRank != null) setInsightRank(dashRank);
        const dashTotal = dashboard.total_students_in_class || 0;
        setTotalStudents(dashTotal);
        if (dashTotal > 0) setInsightTotalStudents(dashTotal);
        const dashPct = dashboard.percentile != null ? Number(dashboard.percentile) : null;
        setPercentile(dashPct);
        if (dashPct != null) setInsightPercentile(dashPct);
        setTotalSolved(dashboard.total_problems_passed || 0);
        setAvgTimeMinutes(parseFloat(dashboard.avg_time_minutes) || 0);
        setStreakDays(dashboard.streak_days || 0);

        const cs = dashboard.class_stats;
        if (cs) {
          setClassAvgScore(cs.class_avg_score != null ? Math.round(cs.class_avg_score) : null);
          setTopPerformerScore(cs.top_performer_score != null ? Math.round(cs.top_performer_score) : null);
          setAvgHintUsage(cs.avg_hint_usage != null ? cs.avg_hint_usage : null);
        }

        if (dashboard.class_code) setClassCode(dashboard.class_code);
        if (dashboard.class_name) setClassNameStr(dashboard.class_name);

        if (dashboard.class_difficulty && dashboard.class_difficulty.length > 0) {
          setClassDifficultyData(dashboard.class_difficulty);
        }

        const masteryRows: any[] = dashboard.all_topics || [];

        // Store ALL topics (including not-started ones with null mastery)
        setAllTopics(masteryRows);

        if (masteryRows.length > 0) {
          // Include ALL topics — null mastery = not started (show as 0 in chart)
          const topicAccuracy = masteryRows
            .map((r: any) => ({
              topic: (r.topic_name as string).length > 18
                ? (r.topic_name as string).slice(0, 16) + '…'
                : r.topic_name as string,
              fullName: r.topic_name as string,
              accuracy: r.mastery_score != null ? Math.round(Number(r.mastery_score)) : -1,
              attempted: Number(r.problems_attempted) || 0,
            }))
            .sort((a: any, b: any) => {
              // Attempted topics first, sorted by accuracy desc
              if (a.attempted > 0 && b.attempted === 0) return -1;
              if (a.attempted === 0 && b.attempted > 0) return 1;
              return b.accuracy - a.accuracy;
            });
          setAccuracyData(topicAccuracy);
        }

        const total = dashboard.total_students_in_class || 100;
        setPositionData([
          { name: 'Top 10%',    students: Math.round(total * 0.1) },
          { name: 'Top 25%',   students: Math.round(total * 0.25) },
          { name: 'Top 50%',   students: Math.round(total * 0.5) },
          { name: 'Bottom 50%',students: Math.round(total * 0.5) },
        ]);

        const hs = dashboard.hint_stats;
        if (hs) {
          setHintUsageData([
            { name: 'Solved without hints', value: hs.no_hint    || 0 },
            { name: 'Used 1 hint',          value: hs.one_hint   || 0 },
            { name: 'Used 2+ hints',        value: hs.multi_hint || 0 },
          ]);
        }

      } catch (err) {

        console.error('Analytics dashboard fetch error:', err);

      }

      try {

        // 3. Daily activity (last 30 days)
        const progress = await api.get<any[]>(`/analytics/me/progress${classQs}`);

        if (progress && progress.length > 0) {
          const timeData = progress.map((p: any) => {
            const d = new Date(p.day);
            const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return {
              date: dateLabel,
              total:   parseInt(p.submissions_count) || 0,
              correct: parseInt(p.correct_count)      || 0,
            };
          });
          setCodingTimeData(timeData);
        }

      } catch { /* fallback — chart stays empty */ }

    };

    fetchAll();

  // Re-fetch whenever the active course changes
  }, [activeCourseId]);

  return (

    <div className="flex min-h-screen bg-[#0f172a]">

      <Sidebar 

        sections={sections}

        activeSectionId="analytics"

        onSectionSelect={onSectionSelect}

        onDashboardClick={onDashboardClick}

        onProblemsClick={onProblemsClick}

        onInstructorDashboardClick={onInstructorDashboardClick}

        onSwitchCourse={onSwitchCourse}

        onLogout={onLogout}

        userRole={userRole}

        courseName={courseName}

        progressPercent={sections.length > 0 ? Math.round((sections.filter(s => s.isCompleted).length / sections.length) * 100) : 0}

      />

      

      <div className="flex-1 ml-72 text-slate-200 p-8 lg:p-12">

        <div className="max-w-7xl mx-auto">

          {/* Header */}

          <header className="mb-12">

            <motion.h1 

              initial={{ opacity: 0, y: -20 }}

              animate={{ opacity: 1, y: 0 }}

              className="text-4xl font-bold text-white tracking-tight mb-2"

            >

              Learning <span className="text-emerald-500 italic font-serif">Analytics</span>

            </motion.h1>

            <div className="flex items-center gap-3">

              <p className="text-slate-400 font-medium">Deep dive into your progress and performance.</p>

              {classCode && (

                <motion.div

                  initial={{ opacity: 0, x: 10 }}

                  animate={{ opacity: 1, x: 0 }}

                  className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs font-bold text-emerald-400"

                >

                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />

                  {classCode}{classNameStr ? ` · ${classNameStr}` : ''}

                </motion.div>

              )}

            </div>

          </header>

          {/* ── Hero Stats Row ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {/* Mastery Score */}
            <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.05 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-1 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none rounded-2xl"/>
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Your Mastery</div>
              <div className="text-3xl font-black text-white mt-1">
                {overallScore != null && overallScore > 0 ? `${Math.round(overallScore)}%` : '—'}
              </div>
              <div className="text-[10px] text-emerald-500 font-semibold">
                {overallScore != null && overallScore > 0 ? 'overall score' : 'no data yet'}
              </div>
            </motion.div>

            {/* Class Rank */}
            <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-1 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none rounded-2xl"/>
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Class Rank</div>
              <div className="text-3xl font-black text-white mt-1">
                {(insightRank ?? rank) != null ? `#${insightRank ?? rank}` : '—'}
              </div>
              <div className="text-[10px] text-slate-400 font-semibold">
                of {(insightTotalStudents || totalStudents) > 0 ? `${insightTotalStudents || totalStudents} students` : '—'}
              </div>
            </motion.div>

            {/* Percentile */}
            <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.15 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-1 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent pointer-events-none rounded-2xl"/>
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Percentile</div>
              <div className="text-3xl font-black text-white mt-1">
                {(insightPercentile ?? percentile) != null
                  ? `Top ${Math.round(100 - (insightPercentile ?? percentile ?? 50))}%`
                  : '—'}
              </div>
              <div className={`text-[10px] font-semibold ${(insightPercentile ?? percentile ?? 0) >= 70 ? 'text-emerald-400' : (insightPercentile ?? percentile ?? 0) >= 40 ? 'text-amber-400' : 'text-slate-400'}`}>
                {(insightPercentile ?? percentile) != null
                  ? (insightPercentile ?? percentile ?? 0) >= 70 ? 'excellent standing'
                  : (insightPercentile ?? percentile ?? 0) >= 40 ? 'good standing'
                  : 'keep practicing'
                  : 'no ranking yet'}
              </div>
            </motion.div>

            {/* Problems Solved */}
            <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-1 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none rounded-2xl"/>
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Solved</div>
              <div className="text-3xl font-black text-white mt-1">{totalSolved}</div>
              <div className="text-[10px] text-slate-400 font-semibold">
                {streakDays > 0 ? `${streakDays}-day streak 🔥` : 'problems passed'}
              </div>
            </motion.div>
          </div>

          {/* AI Insight Panel */}

          <motion.div

            initial={{ opacity: 0, y: 20 }}

            animate={{ opacity: 1, y: 0 }}

            className="mb-12 bg-slate-900 border border-emerald-500/20 rounded-3xl p-8 relative overflow-hidden group"

          >

            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">

              <Sparkles size={120} className="text-emerald-500" />

            </div>

            <div className="relative z-10">

              <div className="flex items-center justify-between gap-3 mb-4">

                <div className="flex items-center gap-3">

                  <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">

                    <Brain size={20} />

                  </div>

                  <h2 className="text-lg font-bold text-white uppercase tracking-wider">AI Performance Insight</h2>

                </div>

                {/* Class standing badge — backend'den gelir */}

                {insightRank && insightPercentile != null && (

                  <div className="flex items-center gap-3">

                    <div className="flex flex-col items-end">

                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Class Standing</span>

                      <span className="text-sm font-bold text-white">

                        #{insightRank}

                        <span className="text-slate-400 font-normal text-xs"> of {insightTotalStudents}</span>

                      </span>

                    </div>

                    <div className={cn(

                      "px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest",

                      insightPercentile >= 70

                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"

                        : insightPercentile >= 40

                        ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"

                        : "bg-rose-500/15 text-rose-400 border border-rose-500/30"

                    )}>

                      Top {Math.round(100 - insightPercentile)}%

                    </div>

                  </div>

                )}

              </div>

              <div className="bg-slate-950/50 rounded-2xl p-6 border border-slate-800/50">

                {isAnalyzing ? (

                  <div className="flex items-center gap-3 text-slate-400 italic">

                    <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />

                    AI is analyzing your patterns...

                  </div>

                ) : (

                  <p className="text-slate-300 leading-relaxed text-lg">

                    "{aiInsight}"

                  </p>

                )}

              </div>

            </div>

          </motion.div>

          {/* Charts Grid */}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* Accuracy by Topic */}

            <motion.div 

              initial={{ opacity: 0, scale: 0.95 }}

              animate={{ opacity: 1, scale: 1 }}

              transition={{ delay: 0.1 }}

              className="bg-slate-900 border border-slate-800 rounded-3xl p-8"

            >

              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-500">
                    <BarChart3 size={18} />
                  </div>
                  <h3 className="font-bold text-white uppercase tracking-widest text-xs">Topic Mastery Breakdown</h3>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/>≥70% Mastered</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"/>50–69% OK</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block"/>{'<'}50% Needs Work</span>
                </div>
              </div>

              {allTopics.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-slate-600 gap-2">
                  <BarChart3 size={28} className="opacity-30" />
                  <p className="text-sm">Select a course to see topic analysis.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                  {allTopics.map((t: any, i: number) => {
                    const score = t.mastery_score != null ? Math.round(Number(t.mastery_score)) : null;
                    const attempted = Number(t.problems_attempted) || 0;
                    const passed = Number(t.problems_passed) || 0;
                    const notStarted = attempted === 0;
                    const barColor = score == null || notStarted ? '#334155'
                      : score >= 70 ? '#10b981'
                      : score >= 50 ? '#f59e0b'
                      : '#ef4444';
                    const badgeText = notStarted ? 'Not Started'
                      : score != null && score >= 70 ? 'Mastered'
                      : score != null && score >= 50 ? 'In Progress'
                      : 'Needs Work';
                    const badgeCls = notStarted
                      ? 'bg-slate-800 text-slate-500'
                      : score != null && score >= 70 ? 'bg-emerald-500/15 text-emerald-400'
                      : score != null && score >= 50 ? 'bg-amber-500/15 text-amber-400'
                      : 'bg-rose-500/15 text-rose-400';
                    return (
                      <div key={t.topic_id || i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/60 hover:bg-slate-800/60 transition-colors group">
                        <div className="w-6 h-6 rounded-md bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-500 shrink-0">{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-semibold text-slate-200 truncate">{t.topic_name}</span>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${badgeCls}`}>{badgeText}</span>
                              <span className="text-[11px] font-black text-white w-8 text-right">{notStarted ? '—' : `${score}%`}</span>
                            </div>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-slate-800">
                            <div
                              className="h-1.5 rounded-full transition-all duration-700"
                              style={{ width: notStarted ? '0%' : `${score}%`, backgroundColor: barColor }}
                            />
                          </div>
                          {!notStarted && (
                            <div className="text-[9px] text-slate-600 mt-1">{passed}/{attempted} problems passed</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </motion.div>

            {/* Daily Activity (eskiden: Time Spent Coding) */}

            <motion.div 

              initial={{ opacity: 0, scale: 0.95 }}

              animate={{ opacity: 1, scale: 1 }}

              transition={{ delay: 0.2 }}

              className="bg-slate-900 border border-slate-800 rounded-3xl p-8"

            >

              <div className="flex items-center justify-between mb-4">

                <div className="flex items-center gap-3">

                  <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-500">

                    <Clock size={18} />

                  </div>

                  <h3 className="font-bold text-white uppercase tracking-widest text-xs">Daily Activity</h3>

                </div>

                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Last 30 Days</div>

              </div>

              {/* Legend */}

              <div className="flex items-center gap-5 mb-4">

                <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">

                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/40 inline-block border border-emerald-500" />

                  Total Attempts

                </span>

                <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">

                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />

                  Correct

                </span>

              </div>

              {codingTimeData.length === 0 ? (

                <div className="flex flex-col items-center justify-center h-48 text-slate-600 gap-2">

                  <TrendingUp size={28} className="opacity-30" />

                  <p className="text-sm">No activity yet — your daily progress will appear here.</p>

                </div>

              ) : (

              <div className="h-[280px] w-full">

                <ResponsiveContainer width="100%" height="100%">

                  <AreaChart data={codingTimeData} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>

                    <defs>

                      <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">

                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>

                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>

                      </linearGradient>

                      <linearGradient id="gradCorrect" x1="0" y1="0" x2="0" y2="1">

                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.5}/>

                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.05}/>

                      </linearGradient>

                    </defs>

                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />

                    <XAxis

                      dataKey="date"

                      stroke="#64748b"

                      fontSize={10}

                      tickLine={false}

                      axisLine={false}

                      interval="preserveStartEnd"

                    />

                    <YAxis

                      stroke="#64748b"

                      fontSize={10}

                      tickLine={false}

                      axisLine={false}

                      allowDecimals={false}

                      tickFormatter={(v) => `${v}p`}

                    />

                    <Tooltip

                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}

                      formatter={(value: number, name: string) => [

                        `${value} problem${value !== 1 ? 's' : ''}`,

                        name === 'total' ? 'Attempted' : 'Correct',

                      ]}

                      labelStyle={{ color: '#94a3b8', fontSize: 11 }}

                    />

                    <Area

                      type="monotone"

                      dataKey="total"

                      stroke="#10b981"

                      strokeWidth={1.5}

                      strokeDasharray="4 3"

                      fill="url(#gradTotal)"

                      dot={false}

                    />

                    <Area

                      type="monotone"

                      dataKey="correct"

                      stroke="#10b981"

                      strokeWidth={2.5}

                      fill="url(#gradCorrect)"

                      dot={{ fill: '#10b981', strokeWidth: 0, r: 3 }}

                      activeDot={{ r: 5, strokeWidth: 0 }}

                    />

                  </AreaChart>

                </ResponsiveContainer>

              </div>

              )}

            </motion.div>

            {/* Hint Usage */}

            <motion.div 

              initial={{ opacity: 0, scale: 0.95 }}

              animate={{ opacity: 1, scale: 1 }}

              transition={{ delay: 0.3 }}

              className="bg-slate-900 border border-slate-800 rounded-3xl p-8"

            >

              <div className="flex items-center justify-between mb-8">

                <div className="flex items-center gap-3">

                  <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center text-amber-500">

                    <HelpCircle size={18} />

                  </div>

                  <h3 className="font-bold text-white uppercase tracking-widest text-xs">Hint Usage</h3>

                </div>

              </div>

              <div className="h-[300px] w-full flex items-center justify-center">

                <ResponsiveContainer width="100%" height="100%">

                  <PieChart>

                    <Pie

                      data={hintUsageData}

                      cx="50%"

                      cy="50%"

                      innerRadius={60}

                      outerRadius={100}

                      paddingAngle={5}

                      dataKey="value"

                    >

                      {hintUsageData.map((entry, index) => (

                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />

                      ))}

                    </Pie>

                    <Tooltip 

                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}

                      formatter={(value: number, name: string) => [`${value} problem${value !== 1 ? 's' : ''}`, name]}

                    />

                    <Legend verticalAlign="bottom" height={36} />

                  </PieChart>

                </ResponsiveContainer>

              </div>

            </motion.div>

            {/* Summary Stats */}

            <motion.div 

              initial={{ opacity: 0, scale: 0.95 }}

              animate={{ opacity: 1, scale: 1 }}

              transition={{ delay: 0.4 }}

              className="bg-slate-900 border border-slate-800 rounded-3xl p-8 flex flex-col justify-center"

            >

              <div className="grid grid-cols-2 gap-6">

                {/* CLASS AVG SCORE */}

                <div className="p-6 bg-slate-950/50 rounded-2xl border border-slate-800/50">

                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Class Avg Score</div>

                  <div className="text-3xl font-bold text-white">

                    {classAvgScore != null ? classAvgScore : '—'}

                  </div>

                  <div className="mt-2 text-[10px] font-bold text-slate-400">class average mastery</div>

                </div>

                {/* TOP PERFORMER */}

                <div className="p-6 bg-slate-950/50 rounded-2xl border border-slate-800/50">

                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Top Performer</div>

                  <div className="text-3xl font-bold text-amber-400">

                    {topPerformerScore != null ? topPerformerScore : '—'}

                  </div>

                  <div className="mt-2 text-[10px] font-bold text-slate-400">best score in class</div>

                </div>

                {/* YOUR SCORE */}

                <div className="p-6 bg-slate-950/50 rounded-2xl border border-slate-800/50">

                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Your Score</div>

                  <div className={`text-3xl font-bold ${
                    overallScore != null && overallScore > 0 && classAvgScore != null && overallScore >= classAvgScore
                      ? 'text-emerald-400'
                      : overallScore != null && overallScore > 0
                      ? 'text-red-400'
                      : 'text-slate-500'
                  }`}>
                    {overallScore != null && overallScore > 0 ? `${Math.round(overallScore)}%` : '—'}
                  </div>

                  <div className="mt-2 flex items-center gap-1 text-[10px] font-bold">
                    {overallScore != null && overallScore > 0 && classAvgScore != null ? (
                      overallScore >= classAvgScore
                        ? <span className="text-emerald-400">+{Math.round(overallScore - classAvgScore)}% above avg</span>
                        : <span className="text-red-400">{Math.round(overallScore - classAvgScore)}% below avg</span>
                    ) : <span className="text-slate-500">no submissions yet</span>}
                  </div>

                </div>

                {/* AVG HINT USAGE */}

                <div className="p-6 bg-slate-950/50 rounded-2xl border border-slate-800/50">

                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Avg Hint Usage</div>

                  <div className="text-3xl font-bold text-blue-400">

                    {avgHintUsage != null ? avgHintUsage : '—'}

                  </div>

                  <div className="mt-2 text-[10px] font-bold text-slate-400">avg hints per student</div>

                </div>

              </div>

            </motion.div>

            {/* Class Difficulty Analysis */}

            <motion.div 

              initial={{ opacity: 0, y: 20 }}

              animate={{ opacity: 1, y: 0 }}

              transition={{ delay: 0.5 }}

              className="bg-slate-900 border border-slate-800 rounded-3xl p-8 lg:col-span-2"

            >

              <div className="flex items-center justify-between mb-8">

                <div className="flex items-center gap-3">

                  <div className="w-8 h-8 bg-rose-500/10 rounded-lg flex items-center justify-center text-rose-500">

                    <AlertTriangle size={18} />

                  </div>

                  <h3 className="font-bold text-white uppercase tracking-widest text-xs">Class Difficulty Analysis</h3>

                </div>

                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Questions most students failed</div>

              </div>

              

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                {classDifficultyData.map((item, i) => (

                  <div key={i} className="p-5 bg-slate-950 border border-slate-800 rounded-2xl hover:border-rose-500/30 transition-all group">

                    <div className="flex items-center justify-between mb-3">

                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{item.topic}</span>

                      <span className="text-xs font-bold text-rose-500">{item.failRate}% Fail</span>

                    </div>

                    <div className="text-sm font-bold text-white group-hover:text-rose-400 transition-colors mb-4">{item.question}</div>

                    <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">

                      <div className="h-full bg-rose-500" style={{ width: `${item.failRate}%` }} />

                    </div>

                  </div>

                ))}

              </div>

            </motion.div>

            {/* Your Position in Class */}

            <motion.div 

              initial={{ opacity: 0, y: 20 }}

              animate={{ opacity: 1, y: 0 }}

              transition={{ delay: 0.6 }}

              className="bg-slate-900 border border-slate-800 rounded-3xl p-8 lg:col-span-2"

            >

              {(() => {

                const usedPercentile = insightPercentile ?? percentile;
                const usedRank      = insightRank ?? rank;
                const usedTotal     = insightTotalStudents || totalStudents;

                // Show "no ranking" only when we have NO rank data at all
                if (usedRank == null && usedPercentile == null) {

                  return (
                    <div>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-500">
                          <Trophy size={18} />
                        </div>
                        <h3 className="font-bold text-white uppercase tracking-widest text-xs">Your Position in Class</h3>
                      </div>
                      <div className="flex flex-col items-center justify-center h-32 text-slate-600 gap-2">
                        <Trophy size={28} className="opacity-30" />
                        <p className="text-sm">No ranking yet — solve problems to earn your place.</p>
                      </div>
                    </div>
                  );

                }

                const safePercentile = usedPercentile ?? 0;

                const topPercent    = Math.max(1, Math.min(99, Math.round(100 - safePercentile)));

                const beforeLight   = Math.max(0, (topPercent - 3) * 0.65);

                const beforeMedium  = Math.max(0, (topPercent - 3) * 0.35);

                const after         = Math.max(0, 100 - topPercent);

                const pieData = [

                  { name: 'Students ahead',   students: Math.max(0, (usedRank ?? 1) - 1) },

                  { name: 'You',               students: 1 },

                  { name: 'Students you beat', students: Math.max(0, usedTotal - (usedRank ?? 1)) },

                ];

                return (

                  <div className="flex flex-col md:flex-row gap-12 items-center">

                    <div className="flex-1 w-full">

                      <div className="flex items-center gap-3 mb-8">

                        <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-500">

                          <Trophy size={18} />

                        </div>

                        <h3 className="font-bold text-white uppercase tracking-widest text-xs">Your Position in Class</h3>

                      </div>

                      <div className="space-y-6">

                        <div className="flex items-end justify-between">

                          <div>

                            <div className="text-4xl font-bold text-white mb-1">

                              Top {topPercent}%

                            </div>

                            <div className="text-sm text-slate-400 font-medium">

                              You are performing better than {Math.round(safePercentile)}% of the class.

                            </div>

                          </div>

                          <div className="text-right">

                            <div className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-1">Rank</div>

                            <div className="text-xl font-bold text-white">

                              {usedRank != null ? `#${usedRank}` : '—'} / {usedTotal || '—'}

                            </div>

                          </div>

                        </div>

                        {/* Progress bar */}

                        <div className="h-4 w-full bg-slate-950 rounded-full overflow-hidden flex">

                          <div className="h-full bg-emerald-500/20 border-r border-emerald-500/30" style={{ width: `${beforeLight}%` }} />

                          <div className="h-full bg-emerald-500/40 border-r border-emerald-500/30" style={{ width: `${beforeMedium}%` }} />

                          <div className="h-full bg-emerald-500 relative" style={{ width: '3%' }}>

                            <div className="absolute -top-1 -bottom-1 left-1/2 w-1 bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]" />

                          </div>

                          <div className="h-full bg-slate-800" style={{ width: `${after}%` }} />

                        </div>

                        <div className="flex justify-between text-[9px] font-bold text-slate-500 uppercase tracking-widest">

                          <span>Top 0%</span>

                          <span>Top 25%</span>

                          <span>Top 50%</span>

                          <span>Top 75%</span>

                          <span>100%</span>

                        </div>

                      </div>

                    </div>

                    {/* Pie chart — Ahead / You / Below */}

                    <div className="w-full md:w-64 h-64">

                      <ResponsiveContainer width="100%" height="100%">

                        <PieChart>

                          <Pie

                            data={pieData}

                            cx="50%"

                            cy="50%"

                            innerRadius={60}

                            outerRadius={80}

                            paddingAngle={3}

                            dataKey="students"

                          >

                            <Cell fill="#1e293b" />

                            <Cell fill="#10b981" />

                            <Cell fill="#334155" />

                          </Pie>

                          <Tooltip

                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}

                            formatter={(value: number, name: string) => [`${value} students`, name]}

                          />

                        </PieChart>

                      </ResponsiveContainer>

                      <div className="text-center -mt-2 space-y-1">

                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Class Distribution</div>

                        <div className="flex items-center justify-center gap-3 text-[9px] text-slate-400">

                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-700 inline-block" />Ahead</span>

                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />You</span>

                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-600 inline-block" />Below</span>

                        </div>

                      </div>

                    </div>

                  </div>

                );

              })()}

            </motion.div>

          </div>

        </div>

      </div>

    </div>

  );

};

