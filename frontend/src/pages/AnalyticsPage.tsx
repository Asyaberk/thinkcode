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
// Gemini frontend çağrısı kaldırıldı — artık backend /analytics/me/ai-insight kullanılıyor
import { getMyAiInsight } from '../api/analytics';
import { api } from '../api/client';


interface AnalyticsPageProps {
  sections: Section[];
  onSectionSelect: (id: string) => void;
  onDashboardClick: () => void;
  onProblemsClick: () => void;
  onInstructorDashboardClick?: () => void;
  onLogout?: () => void;
  userRole?: UserRole;
}

// ── Statik fallback verisi — API yüklenene kadar gösterilir ────────────────

// Pasta grafik renk paleti (Hint Usage pie chart)
const COLORS = ['#10b981', '#3b82f6', '#f59e0b'];

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({
  sections,
  onSectionSelect,
  onDashboardClick,
  onProblemsClick,
  onInstructorDashboardClick,
  onLogout,
  userRole
}) => {
  // ── State — tasarım değişmedi, sadece data kaynağı backend'e taşındı ──────
  const [aiInsight, setAiInsight] = useState<string>("Analyzing your performance data...");
  const [isAnalyzing, setIsAnalyzing] = useState(true);

  // Grafik verileri — başlangıçta fallback default, sonra API ile güncellenir
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
  // Sınıf karşılaştırma verileri
  const [classAvgScore, setClassAvgScore] = useState<number | null>(null);
  const [topPerformerScore, setTopPerformerScore] = useState<number | null>(null);
  const [avgHintUsage, setAvgHintUsage] = useState<number | null>(null);
  // insight endpoint'inden gelen class standing verileri
  const [insightRank, setInsightRank] = useState<number | null>(null);
  const [insightPercentile, setInsightPercentile] = useState<number | null>(null);
  const [insightTotalStudents, setInsightTotalStudents] = useState<number>(0);

  // ── API'den veri çek — tasarım hiç değişmedi ─────────────────────────────
  useEffect(() => {
    const fetchAll = async () => {
      try {
        // 1. AI Insight (backend OpenAI)
        const insightResult = await getMyAiInsight();
        setAiInsight(
          insightResult.insight ||
          "Focus on graph algorithms — they show the most room for improvement. Strong foundation in sorting!"
        );
        // Class standing verileri insight endpoint'inden geldi
        if (insightResult.rank) setInsightRank(insightResult.rank);
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
        // 2. Dashboard: overall score, rank, class size, stat kart verileri
        const dashboard = await api.get<any>('/analytics/me/dashboard');
        setOverallScore(Math.round(parseFloat(dashboard.overall_mastery_score) || 0));
        setRank(dashboard.rank || null);
        setTotalStudents(dashboard.total_students_in_class || 0);
        setPercentile(dashboard.percentile != null ? parseFloat(dashboard.percentile) : null);
        setTotalSolved(dashboard.total_problems_passed || 0);
        setAvgTimeMinutes(parseFloat(dashboard.avg_time_minutes) || 0);
        setStreakDays(dashboard.streak_days || 0);
        // Sınıf karşılaştırma
        const cs = dashboard.class_stats;
        if (cs) {
          setClassAvgScore(cs.class_avg_score != null ? Math.round(cs.class_avg_score) : null);
          setTopPerformerScore(cs.top_performer_score != null ? Math.round(cs.top_performer_score) : null);
          setAvgHintUsage(cs.avg_hint_usage != null ? cs.avg_hint_usage : null);
        }
        // Sınıf zorluk analizi
        if (dashboard.class_difficulty && dashboard.class_difficulty.length > 0) {
          setClassDifficultyData(dashboard.class_difficulty);
        }

        // 3. Mastery → accuracyData (grafik için topic bazlı doğruluk)
        const masteryRows: any[] = dashboard.all_topics || [];
        if (masteryRows.length > 0) {
          const topicAccuracy = masteryRows
            .filter((r: any) => parseInt(r.problems_attempted) > 0)
            // slice(0,8) KALDIRILDI — tüm denenen konular gösterilir
            .map((r: any) => ({
              topic: r.topic_name as string,  // tam isim (yatay chart okunur)
              accuracy: Math.round(parseFloat(r.mastery_score) || 0),
            }))
            .sort((a: any, b: any) => b.accuracy - a.accuracy); // en yüksekten düşüğe
          // Tüm veriyi yaz — length'ten bağımsız (boş öğrencide [] olur, default göstermez)
          setAccuracyData(topicAccuracy);
        }


        // positionData: percentile'a göre konumu hesapla
        const pct = parseFloat(dashboard.percentile) || 0;
        const total = dashboard.total_students_in_class || 100;
        setPositionData([
          { name: 'Top 10%', students: Math.round(total * 0.1) },
          { name: 'Top 25%', students: Math.round(total * 0.25) },
          { name: 'Top 50%', students: Math.round(total * 0.5) },
          { name: 'Bottom 50%', students: Math.round(total * 0.5) },
        ]);

        // Hint usage — her zaman yaz
        const hs = dashboard.hint_stats;
        if (hs) {
          setHintUsageData([
            { name: 'Solved without hints', value: hs.no_hint || 0 },
            { name: 'Used 1 hint',          value: hs.one_hint || 0 },
            { name: 'Used 2+ hints',        value: hs.multi_hint || 0 },
          ]);
        }
      } catch (err) {
        console.error('Analytics dashboard fetch error:', err);
        // Fallback değerler zaten state'te
      }


      try {
        // 4. Weekly progress → codingTimeData (son 30 gunun gunluk aktivitesi)
        const progress = await api.get<any[]>('/analytics/me/progress');
        if (progress && progress.length > 0) {
          const timeData = progress.map((p: any) => {
            const d = new Date(p.day);
            const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return {
              date: dateLabel,
              total: parseInt(p.submissions_count) || 0,
              correct: parseInt(p.correct_count) || 0,
            };
          });
          setCodingTimeData(timeData);
        }
      } catch { /* fallback default values */ }

    };

    fetchAll();
  }, []);

  return (
    <div className="flex min-h-screen bg-[#0f172a]">
      <Sidebar 
        sections={sections}
        activeSectionId="analytics"
        onSectionSelect={onSectionSelect}
        onDashboardClick={onDashboardClick}
        onProblemsClick={onProblemsClick}
        onInstructorDashboardClick={onInstructorDashboardClick}
        onLogout={onLogout}
        userRole={userRole}
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
            <p className="text-slate-400 font-medium">Deep dive into your progress and performance.</p>
          </header>

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
                  <h3 className="font-bold text-white uppercase tracking-widest text-xs">Accuracy by Topic</h3>
                </div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Latest Attempt</div>
              </div>
              {/* Renk göstergesi */}
              <div className="flex items-center gap-4 mb-4">
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
                  ≥70% Great
                </span>
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />
                  50–69% OK
                </span>
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" />
                  &lt;50% Needs Work
                </span>
              </div>
              {/* Yatay bar chart: konu isimleri sol eksende, accuracy sağda */}
              {accuracyData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-600 gap-2">
                  <BarChart3 size={28} className="opacity-30" />
                  <p className="text-sm">No activity yet — solve some problems to see your accuracy.</p>
                </div>
              ) : (
              <div style={{ height: `${Math.max(260, accuracyData.length * 36)}px` }} className="w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={accuracyData}
                    layout="vertical"
                    margin={{ top: 4, right: 48, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      stroke="#475569"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v}%`}
                      ticks={[0, 25, 50, 75, 100]}
                    />
                    <YAxis
                      type="category"
                      dataKey="topic"
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={160}
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                      formatter={(value: number) => [`${value}%`, 'Accuracy']}
                    />
                    <Bar dataKey="accuracy" radius={[0, 4, 4, 0]} label={{ position: 'right', formatter: (v: number) => `${v}%`, fill: '#94a3b8', fontSize: 11 }}>
                      {accuracyData.map((entry: any, index: number) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            entry.accuracy >= 70 ? '#10b981'
                            : entry.accuracy >= 50 ? '#f59e0b'
                            : '#ef4444'
                          }
                          opacity={0.85}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
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
                    overallScore != null && classAvgScore != null && overallScore >= classAvgScore
                      ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {overallScore ?? '—'}
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-[10px] font-bold">
                    {overallScore != null && classAvgScore != null ? (
                      overallScore >= classAvgScore
                        ? <span className="text-emerald-400">+{overallScore - classAvgScore} above avg</span>
                        : <span className="text-red-400">{overallScore - classAvgScore} below avg</span>
                    ) : <span className="text-slate-400">your mastery score</span>}
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
                // Hangi kaynak daha güvenilir — insight > dashboard
                const usedPercentile = insightPercentile ?? percentile;
                const usedRank      = insightRank ?? rank;
                const usedTotal     = insightTotalStudents || totalStudents;

                // Boş öğrenci: hiç soru çözmemiş → ranking gösterme
                if (totalSolved === 0) {
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
