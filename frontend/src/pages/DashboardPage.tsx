/**
 * DashboardPage.tsx — Öğrenci ana paneli.
 *
 * Mock data KALDIRILDI. Artık backend'den gerçek veriler çekiliyor:
 *   - GET /api/v1/analytics/me/dashboard  → profil, streak, mastery, weak topics
 *   - Tasarım ve bileşen yapısı tamamen KORUNDU — sadece veri kaynağı değişti.
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Flame,
  CheckCircle2,
  BookOpen,
  Brain,
  ChevronRight,
  Zap,
  Target,
  BarChart3,
  Users
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { Section, UserRole } from '../types';
import { cn } from '../lib/utils';
import { Sidebar } from '../components/Sidebar';
import { getMyDashboard, DashboardData, getMyStreak, StreakData, getClassDistribution, ClassDistributionBucket } from '../api/analytics';

// distributionData: artık static değil — component içinde state olarak yönetiliyor
// Bkz. useEffect içindeki getClassDistribution() çağrısı

interface DashboardPageProps {
  sections: Section[];
  onSectionSelect: (id: string) => void;
  onProblemsClick: () => void;
  onAnalyticsClick: () => void;
  onPlaygroundClick?: () => void;
  onInstructorDashboardClick?: () => void;
  onLogout?: () => void;
  userRole?: UserRole;
  /** Submission sonrası dashboard'u yenilemek için arttırılır */
  refreshKey?: number;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  sections,
  onSectionSelect,
  onProblemsClick,
  onAnalyticsClick,
  onPlaygroundClick,
  onInstructorDashboardClick,
  onLogout,
  userRole,
  refreshKey = 0,
}) => {
  // ── State: API verisi ────────────────────────────────────────────────────────
  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [streakData, setStreakData] = useState<StreakData>({ streak_days: 0, last_active: null });
  // distributionData: sınıf puan dağılımı — DB'den gelir
  const [distributionData, setDistributionData] = useState<ClassDistributionBucket[]>([]);
  const [isLoading, setIsLoading] = useState(true);


  // ── API'den dashboard verisini çek ──────────────────────────────────────────
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [dash, streak, dist] = await Promise.all([
          getMyDashboard(),
          getMyStreak().catch(() => ({ streak_days: 0, last_active: null })),
          getClassDistribution().catch(() => []),
        ]);
        setDashData(dash);
        setStreakData(streak);
        setDistributionData(dist);
      } catch (err) {
        console.error('Dashboard yüklenemedi:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAll();
  }, [refreshKey]);  // refreshKey degisince yeniden fetch yap (submission sonrasi)

  // ── Topic listesinden section tamamlama sayısı (sidebar ve dashboard için) ──
  const completedCount = sections.filter(s => s.isCompleted).length;
  const totalCount = sections.length;

  // ── API'den gelen verilerden türetilen değerler ─────────────────────────────
  // Eğer API veri dönemediyse güvenli varsayılan değerler kullan (NaN önleme)
  const overallMastery = dashData?.overall_mastery_score ?? 0;
  const progressPercent = Math.round(overallMastery);
  const problemsSolved = dashData?.total_problems_passed ?? 0;
  const totalAttempted = dashData?.total_problems_attempted ?? 0;
  const percentile = dashData?.percentile ?? 50;
  const rank = dashData?.rank ?? null;
  const totalStudents = dashData?.total_students_in_class ?? 0;
  const firstName = dashData?.user?.first_name ?? 'Developer';

  // Konu mastery listesi: API'den gelir, yoksa mock başlangıç değerleri
  const topicProgress = dashData?.all_topics?.map(t => ({
    name: t.topic_name,
    // 100 üzerinden normalize et
    progress: Math.round(t.mastery_score),
    color: t.mastery_score >= 70 ? 'bg-emerald-500' : t.mastery_score > 0 ? 'bg-blue-500' : 'bg-slate-700',
  })) ?? [
    { name: 'Fundamentals', progress: 0, color: 'bg-slate-700' },
    { name: 'Union-Find', progress: 0, color: 'bg-slate-700' },
    { name: 'Elementary Sorts', progress: 0, color: 'bg-slate-700' },
    { name: 'Mergesort', progress: 0, color: 'bg-slate-700' },
    { name: 'Binary Search Trees', progress: 0, color: 'bg-slate-700' },
  ];

  // Mini progress bar: solved/attempted oranından dinamik (7 segment)
  const progressBarSegments = (() => {
    if (!totalAttempted) return Array(7).fill(0);
    const ratio = Math.min(problemsSolved / totalAttempted, 1);
    const filled = Math.round(ratio * 7);
    return Array(7).fill(0).map((_, i) => i < filled ? 1 : 0);
  })();

  // Zayıf konular: API'nin weak_topics alanından gelir
  const weakTopics = dashData?.weak_topics?.map(t => ({
    name: t.topic_name,
    reason: `Score: ${Math.round(t.mastery_score)}% — ${t.problems_attempted} problems attempted`,
  })) ?? [];

  // "You are here" X pozisyonu:
  // percentile = PERCENT_RANK(ASC)*100 — kaçıncı dilimde olduğu (0=kötü, 100=iyi)
  // "Top X%" = 100 - percentile. Grafik 0%(sol)=en iyi, 100%(sağ)=en kötü okunursa:
  // Top 27% öğrenci → ok 27% konumunda (sola yakın = üst sıralarda)
  const youAreHerePercent = Math.max(2, Math.min(100 - percentile, 98));

  // ── Yükleme ekranı ──────────────────────────────────────────────────────────
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
        onLogout={onLogout}
        userRole={userRole}
        progressPercent={totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}
      />
      <div className="flex-1 ml-72 text-slate-200 p-8 lg:p-12">
        <div className="max-w-7xl mx-auto">

          {/* Header — kullanıcı ismi API'den dinamik */}
          <header className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <motion.h1
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-4xl font-bold text-white tracking-tight mb-2"
              >
                Welcome back, <span className="text-emerald-500 italic font-serif">{firstName}</span>.
              </motion.h1>
              <p className="text-slate-400 font-medium">Ready to continue your mastery journey?</p>
            </div>
            {/* Streak: DB'den — submission geçmişindeki ardışık günler */}
            <div className="flex items-center gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl px-6 py-3 flex items-center gap-3 shadow-xl">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
                  <Flame size={20} />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Streak</div>
                  <div className="text-lg font-bold text-white">
                    {streakData.streak_days > 0
                      ? `${streakData.streak_days} ${streakData.streak_days === 1 ? 'Day' : 'Days'}`
                      : 'Start Today!'}
                  </div>
                </div>
              </div>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Sol Kolon: İlerleme ve Konular */}
            <div className="lg:col-span-2 space-y-8">

              {/* Günlük İlerleme Kartı — API verisiyle */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-8 relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -mr-32 -mt-32 transition-opacity group-hover:opacity-100 opacity-50" />

                <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8">
                  {/* Genel Mastery Skoru */}
                  <div className="flex flex-col justify-between">
                    <div>
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <BarChart3 size={14} />
                        Overall Mastery
                      </div>
                      {/* progressPercent: overall_mastery_score'dan; artık NaN olmayacak */}
                      <div className="text-5xl font-bold text-white mb-2">{progressPercent}%</div>
                      <p className="text-slate-400 text-sm">
                        {dashData?.all_topics?.length ?? 0} topics tracked.
                      </p>
                    </div>
                    <div className="mt-6 h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        className="h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                      />
                    </div>
                  </div>

                  {/* Çözülen Problem Sayısı */}
                  <div className="bg-slate-950/50 rounded-2xl p-6 border border-slate-800/50">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Problems Solved</div>
                    <div className="flex items-end gap-2">
                      {/* Gerçek sayı: total_problems_passed */}
                      <div className="text-3xl font-bold text-white">{problemsSolved}</div>
                      <div className="text-emerald-500 text-xs font-bold mb-1">of {totalAttempted} attempts</div>
                    </div>
                    <div className="mt-4 flex gap-1">
                      {progressBarSegments.map((v, i) => (
                        <div key={i} className={cn("h-1 flex-1 rounded-full", v ? "bg-emerald-500" : "bg-slate-800")} />
                      ))}
                    </div>
                  </div>

                  {/* Aktif Konu (ilk tamamlanmamış section) */}
                  <div className="bg-slate-950/50 rounded-2xl p-6 border border-slate-800/50">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Current Topic</div>
                    <div className="text-lg font-bold text-white mb-1 truncate">
                      {sections.find(s => !s.isCompleted)?.title ?? 'All Done!'}
                    </div>
                    <div className="text-xs text-slate-500 font-medium mb-4">
                      {completedCount} of {totalCount} complete
                    </div>
                    <button
                      onClick={() => {
                        // İlk tamamlanmamış bölüme git
                        const next = sections.find(s => !s.isCompleted);
                        if (next) onSectionSelect(next.id);
                      }}
                      className="w-full bg-emerald-500 text-slate-950 py-2.5 rounded-xl text-xs font-bold hover:bg-emerald-400 transition-all flex items-center justify-center gap-2"
                    >
                      Resume <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>

              {/* Topic Mastery + AI Zayıf Konular */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                {/* Konu Mastery Listesi */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-slate-900 border border-slate-800 rounded-3xl p-8"
                >
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-8 flex items-center gap-2">
                    <Target size={14} />
                    Topic Mastery
                  </div>
                  <div className="space-y-6">
                    {/* En fazla 5 konu göster */}
                    {topicProgress.slice(0, 5).map((topic, i) => (
                      <div key={i}>
                        <div className="flex justify-between text-xs font-bold mb-2">
                          <span className="text-slate-300 truncate mr-2">{topic.name}</span>
                          <span className="text-slate-500 flex-shrink-0">{topic.progress}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${topic.progress}%` }}
                            className={cn("h-full", topic.color)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* AI Zayıf Konu Önerileri — Backend'den */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
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
                      // Veri yoksa teşvik mesajı
                      <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800/50 text-center">
                        <div className="text-slate-500 text-sm">Solve some problems to see AI insights!</div>
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Sağ Kolon: Sınıf, Öneri, Günlük Meydan Okuma */}
            <div className="space-y-8">

              {/* Sınıf Performansı — API'den percentile ve rank */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-8"
              >
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <Users size={14} />
                  Class Performance
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800/50">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Your Score</div>
                    {/* overallMastery: backend'den gelir, artık NaN değil */}
                    <div className="text-2xl font-bold text-emerald-500">{progressPercent}%</div>
                  </div>
                  <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800/50">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                      {rank ? 'Rank' : 'Students'}
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {rank ? `#${rank}` : totalStudents > 0 ? `${totalStudents}` : '—'}
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex justify-between items-end mb-2">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Percentile</div>
                    {/* percentile: backend'den gelir */}
                    <div className="text-sm font-bold text-white">Top {Math.round(100 - percentile)}%</div>
                  </div>
                  <div className="h-24 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={distributionData.length > 0 ? distributionData : [
                        // Yukleniyor veya bos: hafif bir bell curve goster
                        {bucket: 0, label:'0-10', count:2}, {bucket:10, label:'10-20', count:5},
                        {bucket:20, label:'20-30', count:12}, {bucket:30, label:'30-40', count:25},
                        {bucket:40, label:'40-50', count:40}, {bucket:50, label:'50-60', count:55},
                        {bucket:60, label:'60-70', count:45}, {bucket:70, label:'70-80', count:30},
                        {bucket:80, label:'80-90', count:15}, {bucket:90, label:'90-100', count:7},
                      ]}>
                        <defs>
                          <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="bucket" hide />
                        <Area
                          type="monotone"
                          dataKey="count"
                          stroke="#10b981"
                          fillOpacity={1}
                          fill="url(#colorScore)"
                          strokeWidth={2}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const d = payload[0].payload;
                              return (
                                <div className="bg-slate-900 border border-slate-800 p-2 rounded-lg text-[10px] font-bold">
                                  {d.label}: {d.count} students
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="relative mt-2">
                    {/* "You are here" — percentile pozisyonuna gore */}
                    <div
                      className="absolute -top-4 transform -translate-x-1/2 transition-all duration-500"
                      style={{ left: `${youAreHerePercent}%` }}
                    >
                      <span className="text-emerald-500 text-[10px] font-bold whitespace-nowrap">▼ You are here</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold text-slate-600">
                      <span>0%</span>
                      <span>100%</span>
                    </div>
                  </div>
                </div>
              </motion.div>


              {/* Devam Et Kartı */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-emerald-500 rounded-3xl p-8 text-slate-950 relative overflow-hidden shadow-2xl shadow-emerald-500/10"
              >
                <div className="absolute top-0 right-0 p-4 opacity-20">
                  <BookOpen size={80} />
                </div>
                <div className="relative z-10">
                  <div className="text-[10px] font-black uppercase tracking-widest mb-6 opacity-60">Next Recommended</div>
                  <h3 className="text-2xl font-bold mb-2 leading-tight">
                    {sections.find(s => !s.isCompleted)?.title ?? 'All Topics Complete!'}
                  </h3>
                  <p className="text-slate-950/70 text-sm font-medium mb-8">
                    Continue building your knowledge.
                  </p>
                  <button
                    onClick={() => {
                      const next = sections.find(s => !s.isCompleted);
                      if (next) onSectionSelect(next.id);
                    }}
                    className="bg-slate-950 text-white px-6 py-3 rounded-2xl font-bold text-xs hover:bg-slate-900 transition-all flex items-center gap-2 shadow-xl"
                  >
                    Start Lesson <ChevronRight size={14} />
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
