/**
 * ProblemsPage.tsx — Problem Gezgini.
 *
 * Mock data KALDIRILDI. Artık backend'den gerçek problemler çekiliyor:
 *   - GET /api/v1/problems  → tüm yayınlanmış problemler
 * Tasarım ve filtre yapısı tamamen KORUNDU.
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Search,
  ChevronRight,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { UserRole } from '../types';
import { cn } from '../lib/utils';
import { Sidebar } from '../components/Sidebar';
import { getProblems, getSolvedProblemIds } from '../api/problems';
import type { ApiProblem } from '../types';

interface ProblemsPageProps {
  onProblemSelect: (questionId: string) => void;
  onDashboardClick: () => void;
  onLearningClick: () => void;
  onAnalyticsClick: () => void;
  onPlaygroundClick?: () => void;
  onInstructorDashboardClick?: () => void;
  onLogout?: () => void;
  userRole?: UserRole;
  sections: any[];
  classId?: string;  // Sınıfa göre filtreleme için
}

export const ProblemsPage: React.FC<ProblemsPageProps> = ({
  onProblemSelect,
  onDashboardClick,
  onLearningClick,
  onAnalyticsClick,
  onPlaygroundClick,
  onInstructorDashboardClick,
  onLogout,
  userRole,
  sections,
  classId,
}) => {
  // ── State ────────────────────────────────────────────────────────────────────
  const [problems, setProblems] = useState<ApiProblem[]>([]);
  const [solvedIds, setSolvedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('All');
  const [topicFilter, setTopicFilter] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All');

  // ── API'den problemleri çek ──────────────────────────────────────────────────
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [data, solved] = await Promise.all([
          getProblems(),
          getSolvedProblemIds().catch(() => new Set<string>()),
        ]);
        // Sınıf izolasyonu: sections'dan gelen topic_id'leri kullan
        // sections zaten class-filtered (useTopics hook'u sayesinde)
        const validTopicIds = sections.length > 0
          ? new Set(sections.map((s: any) => s.id))
          : null;  // null = filtre yok (e.g. instructor)
        const filtered = validTopicIds
          ? data.filter(p => validTopicIds.has(p.topic_id))
          : data;
        setProblems(filtered);
        setSolvedIds(solved);
      } catch (err) {
        console.error('Problemler yüklenemedi:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAll();
  }, [sections]);

  // ── Filtre seçenekleri (dinamik: API'den gelen problemlerden üret) ──────────
  // difficulty: backend'de lowercase ("easy","medium","hard"), frontend'de capitalize
  const uniqueTopicIds = [...new Set(problems.map(p => p.topic_id))];
  // Konu adı için topic_id kullanılıyor; gerçek ad için topics endpoint'i gerekir
  // Şimdilik problem_id'lerin başını kullan; sonraki sprint'te iyileştirilecek
  const difficulties = ['All', 'Easy', 'Medium', 'Hard'];
  const types = ['All', 'coding', 'multiple_choice', 'open_response'];

  // ── Filtrele ────────────────────────────────────────────────────────────────
  const filteredProblems = problems.filter(problem => {
    const matchesSearch = problem.title.toLowerCase().includes(searchQuery.toLowerCase());
    // API'den gelen difficulty lowercase; filtre capitalize — lowercase karşılaştır
    const matchesDifficulty = difficultyFilter === 'All' ||
      problem.difficulty.toLowerCase() === difficultyFilter.toLowerCase();
    const matchesType = typeFilter === 'All' || problem.type === typeFilter;
    return matchesSearch && matchesDifficulty && matchesType;
  });

  // ── Yükleme ekranı ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex h-screen bg-[#0f172a] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-slate-400">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Loading problems...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0f172a]">
      <Sidebar
        sections={sections}
        activeSectionId=""
        onSectionSelect={onLearningClick}
        onDashboardClick={onDashboardClick}
        onAnalyticsClick={onAnalyticsClick}
        onInstructorDashboardClick={onInstructorDashboardClick}
        onLogout={onLogout}
        userRole={userRole}
        progressPercent={sections.length > 0 ? Math.round((sections.filter(s => s.isCompleted).length / sections.length) * 100) : 0}
      />

      <main className="flex-1 ml-72 overflow-y-auto p-8 lg:p-12">
        <div className="max-w-6xl mx-auto">

          {/* Başlık */}
          <header className="mb-12">
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl font-bold text-white tracking-tight mb-4"
            >
              Problem <span className="text-emerald-500 italic font-serif">Explorer</span>
            </motion.h1>
            <p className="text-slate-400 font-medium">
              {problems.length} problems available — solve and track your progress.
            </p>
          </header>

          {/* Arama ve Filtreler */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 mb-8 shadow-xl">
            <div className="flex flex-col md:flex-row gap-6">

              {/* Arama Çubuğu */}
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  type="text"
                  placeholder="Search problems..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition-all"
                />
              </div>

              {/* Filtreler */}
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Difficulty</span>
                  <select
                    value={difficultyFilter}
                    onChange={(e) => setDifficultyFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
                  >
                    {difficulties.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Type</span>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
                  >
                    {types.map(t => {
                      // Okunabilir etiket: "multiple_choice" → "Multiple Choice"
                      const label = t === 'All' ? 'All' :
                        t.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
                      return <option key={t} value={t}>{label}</option>;
                    })}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Problem Tablosu */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/50 border-b border-slate-800">
                  <th className="px-8 py-5 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
                  <th className="px-8 py-5 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Problem Name</th>
                  <th className="px-8 py-5 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-center">Type</th>
                  <th className="px-8 py-5 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Difficulty</th>
                  <th className="px-8 py-5 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Points</th>
                  <th className="px-8 py-5 text-[11px] font-bold text-slate-500 uppercase tracking-widest"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredProblems.map((problem) => (
                  <tr
                    key={problem.id}
                    // problem.id backend UUID — QuestionPage bunu kullanarak problem detayı çeker
                    onClick={() => onProblemSelect(problem.id)}
                    className="group hover:bg-slate-800/30 transition-colors cursor-pointer"
                  >
                    {/* Status: solvedIds.has(problem.id) ise Solved, değilse Unsolved */}
                    <td className="px-8 py-5">
                      {solvedIds.has(problem.id) ? (
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 size={18} className="text-emerald-500" strokeWidth={2.5} />
                          <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider hidden lg:block">Solved</span>
                        </div>
                      ) : (
                        <Circle size={18} className="text-slate-700" />
                      )}
                    </td>

                    {/* Problem adı */}
                    <td className="px-8 py-5">
                      <div className={cn(
                        "font-bold transition-colors",
                        solvedIds.has(problem.id)
                          ? "text-slate-300 group-hover:text-emerald-400"
                          : "text-white group-hover:text-emerald-400"
                      )}>
                        {problem.title}
                      </div>
                    </td>


                    {/* Tür etiketi */}
                    <td className="px-8 py-5 text-center">
                      <span className="px-2 py-1 rounded-md bg-slate-800 text-[9px] font-bold text-slate-400 uppercase tracking-tighter border border-slate-700">
                        {/* Backend: "multiple_choice" → göster: "MCQ" gibi */}
                        {problem.type === 'multiple_choice' ? 'MCQ' :
                         problem.type === 'open_response' ? 'Open' :
                         problem.type.charAt(0).toUpperCase() + problem.type.slice(1)}
                      </span>
                    </td>

                    {/* Zorluk renk kodu */}
                    <td className="px-8 py-5">
                      <span className={cn(
                        "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                        problem.difficulty === 'easy' ? "bg-emerald-500/10 text-emerald-500" :
                        problem.difficulty === 'medium' ? "bg-amber-500/10 text-amber-500" :
                        "bg-rose-500/10 text-rose-500"
                      )}>
                        {/* İlk harf büyük yaparak göster */}
                        {problem.difficulty.charAt(0).toUpperCase() + problem.difficulty.slice(1)}
                      </span>
                    </td>

                    {/* Puan */}
                    <td className="px-8 py-5">
                      <span className="text-xs font-mono text-slate-500">{problem.points} pts</span>
                    </td>

                    {/* Ok ikonu */}
                    <td className="px-8 py-5 text-right">
                      <ChevronRight size={16} className="text-slate-700 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                    </td>
                  </tr>
                ))}

                {/* Sonuç yok */}
                {filteredProblems.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-8 py-20 text-center text-slate-500 italic">
                      No problems found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};
