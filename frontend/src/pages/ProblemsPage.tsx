import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Search, 
  Filter, 
  ChevronRight, 
  CheckCircle2, 
  Circle,
  Code2,
  LayoutDashboard,
  BookOpen
} from 'lucide-react';
import { Problem, UserRole } from '../types';
import { problems as mockProblems } from '../mockData';
import { cn } from '../lib/utils';
import { Sidebar } from '../components/Sidebar';

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
  sections
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('All');
  const [topicFilter, setTopicFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All');

  const filteredProblems = mockProblems.filter(problem => {
    const matchesSearch = problem.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDifficulty = difficultyFilter === 'All' || problem.difficulty === difficultyFilter;
    const matchesTopic = topicFilter === 'All' || problem.topic === topicFilter;
    const matchesStatus = statusFilter === 'All' || problem.status === statusFilter;
    const matchesType = typeFilter === 'All' || problem.type === typeFilter;
    return matchesSearch && matchesDifficulty && matchesTopic && matchesStatus && matchesType;
  });

  const difficulties = ['All', 'Easy', 'Medium', 'Hard'];
  const topics = ['All', 'Arrays', 'Pointers', 'STL', 'OOP'];
  const statuses = ['All', 'Solved', 'Unsolved'];
  const types = ['All', 'Coding', 'Multiple Choice', 'Open Response', 'Conceptual'];

  return (
    <div className="flex h-screen bg-[#0f172a]">
      <Sidebar 
        sections={sections}
        activeSectionId=""
        onSectionSelect={onLearningClick}
        onDashboardClick={onDashboardClick}
        onAnalyticsClick={onAnalyticsClick}
        onPlaygroundClick={onPlaygroundClick}
        onInstructorDashboardClick={onInstructorDashboardClick}
        onLogout={onLogout}
        userRole={userRole}
      />

      <main className="flex-1 ml-72 overflow-y-auto p-8 lg:p-12">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <header className="mb-12">
            <motion.h1 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl font-bold text-white tracking-tight mb-4"
            >
              Problem <span className="text-emerald-500 italic font-serif">Explorer</span>
            </motion.h1>
            <p className="text-slate-400 font-medium">Master C++ by solving real-world coding challenges.</p>
          </header>

          {/* Search & Filters */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 mb-8 shadow-xl">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Search Bar */}
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

              {/* Filters */}
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
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Topic</span>
                  <select 
                    value={topicFilter}
                    onChange={(e) => setTopicFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
                  >
                    {topics.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</span>
                  <select 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
                  >
                    {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Type</span>
                  <select 
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
                  >
                    {types.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Problems Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/50 border-b border-slate-800">
                  <th className="px-8 py-5 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
                  <th className="px-8 py-5 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Problem Name</th>
                  <th className="px-8 py-5 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-center">Type</th>
                  <th className="px-8 py-5 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Difficulty</th>
                  <th className="px-8 py-5 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Topic</th>
                  <th className="px-8 py-5 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Attempts</th>
                  <th className="px-8 py-5 text-[11px] font-bold text-slate-500 uppercase tracking-widest"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredProblems.map((problem) => (
                  <tr 
                    key={problem.id}
                    onClick={() => onProblemSelect(problem.questionId)}
                    className="group hover:bg-slate-800/30 transition-colors cursor-pointer"
                  >
                    <td className="px-8 py-5">
                      {problem.status === 'Solved' ? (
                        <CheckCircle2 size={18} className="text-emerald-500" />
                      ) : (
                        <Circle size={18} className="text-slate-700" />
                      )}
                    </td>
                    <td className="px-8 py-5">
                      <div className="font-bold text-white group-hover:text-emerald-400 transition-colors">
                        {problem.title}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <span className="px-2 py-1 rounded-md bg-slate-800 text-[9px] font-bold text-slate-400 uppercase tracking-tighter border border-slate-700">
                        {problem.type}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <span className={cn(
                        "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                        problem.difficulty === 'Easy' ? "bg-emerald-500/10 text-emerald-500" :
                        problem.difficulty === 'Medium' ? "bg-amber-500/10 text-amber-500" :
                        "bg-rose-500/10 text-rose-500"
                      )}>
                        {problem.difficulty}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-xs font-medium text-slate-400">{problem.topic}</span>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-xs font-mono text-slate-500">{problem.attempts}</span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <ChevronRight size={16} className="text-slate-700 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                    </td>
                  </tr>
                ))}
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
