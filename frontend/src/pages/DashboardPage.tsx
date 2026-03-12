import React from 'react';
import { motion } from 'motion/react';
import { 
  Flame, 
  CheckCircle2, 
  BookOpen, 
  Brain, 
  Trophy, 
  ChevronRight, 
  Terminal,
  Zap,
  Target,
  BarChart3,
  Users
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { Section, UserRole } from '../types';
import { cn } from '../lib/utils';
import { Sidebar } from '../components/Sidebar';

interface DashboardPageProps {
  sections: Section[];
  onSectionSelect: (id: string) => void;
  onProblemsClick: () => void;
  onAnalyticsClick: () => void;
  onPlaygroundClick?: () => void;
  onInstructorDashboardClick?: () => void;
  onLogout?: () => void;
  userRole?: UserRole;
}

const distributionData = [
  { score: 0, count: 5 },
  { score: 20, count: 15 },
  { score: 40, count: 45 },
  { score: 60, count: 80 },
  { score: 74, count: 60 }, // Student position
  { score: 80, count: 30 },
  { score: 100, count: 10 },
];

export const DashboardPage: React.FC<DashboardPageProps> = ({ 
  sections, 
  onSectionSelect,
  onProblemsClick,
  onAnalyticsClick,
  onPlaygroundClick,
  onInstructorDashboardClick,
  onLogout,
  userRole
}) => {
  const completedCount = sections.filter(s => s.isCompleted).length;
  const totalCount = sections.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  const topicProgress = [
    { name: 'C++ Basics', progress: 100, color: 'bg-emerald-500' },
    { name: 'Pointers & Memory', progress: 45, color: 'bg-emerald-500' },
    { name: 'Classes & OOP', progress: 0, color: 'bg-slate-700' },
    { name: 'STL Containers', progress: 0, color: 'bg-slate-700' },
    { name: 'Templates', progress: 0, color: 'bg-slate-700' },
  ];

  const weakTopics = [
    { name: 'Pointer Arithmetic', reason: 'Struggled with 3 consecutive questions' },
    { name: 'Memory Management', reason: 'High response time in last practice' },
  ];

  return (
    <div className="flex min-h-screen bg-[#0f172a]">
      <Sidebar 
        sections={sections}
        activeSectionId=""
        onSectionSelect={onSectionSelect}
        onDashboardClick={() => {}}
        onProblemsClick={onProblemsClick}
        onAnalyticsClick={onAnalyticsClick}
        onPlaygroundClick={onPlaygroundClick}
        onInstructorDashboardClick={onInstructorDashboardClick}
        onLogout={onLogout}
        userRole={userRole}
      />
      <div className="flex-1 ml-72 text-slate-200 p-8 lg:p-12">
        <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <motion.h1 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl font-bold text-white tracking-tight mb-2"
            >
              Welcome back, <span className="text-emerald-500 italic font-serif">Developer</span>.
            </motion.h1>
            <p className="text-slate-400 font-medium">Ready to continue your C++ mastery?</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl px-6 py-3 flex items-center gap-3 shadow-xl">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
                <Flame size={20} />
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Streak</div>
                <div className="text-lg font-bold text-white">4 Days</div>
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Progress & Topics */}
          <div className="lg:col-span-2 space-y-8">
            {/* Daily Progress Card */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-8 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -mr-32 -mt-32 transition-opacity group-hover:opacity-100 opacity-50" />
              
              <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="flex flex-col justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <BarChart3 size={14} />
                      Overall Progress
                    </div>
                    <div className="text-5xl font-bold text-white mb-2">{progressPercent}%</div>
                    <p className="text-slate-400 text-sm">You've mastered {completedCount} of {totalCount} topics.</p>
                  </div>
                  <div className="mt-6 h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercent}%` }}
                      className="h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                    />
                  </div>
                </div>

                <div className="bg-slate-950/50 rounded-2xl p-6 border border-slate-800/50">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Problems Solved</div>
                  <div className="flex items-end gap-2">
                    <div className="text-3xl font-bold text-white">124</div>
                    <div className="text-emerald-500 text-xs font-bold mb-1">+12 today</div>
                  </div>
                  <div className="mt-4 flex gap-1">
                    {[1,1,1,1,0,0,0].map((v, i) => (
                      <div key={i} className={cn("h-1 flex-1 rounded-full", v ? "bg-emerald-500" : "bg-slate-800")} />
                    ))}
                  </div>
                </div>

                <div className="bg-slate-950/50 rounded-2xl p-6 border border-slate-800/50">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Current Topic</div>
                  <div className="text-lg font-bold text-white mb-1 truncate">Pointers & Memory</div>
                  <div className="text-xs text-slate-500 font-medium mb-4">Section 2 of 5</div>
                  <button 
                    onClick={() => onSectionSelect('cpp-pointers')}
                    className="w-full bg-emerald-500 text-slate-950 py-2.5 rounded-xl text-xs font-bold hover:bg-emerald-400 transition-all flex items-center justify-center gap-2"
                  >
                    Resume <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Learning Progress Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                  {topicProgress.map((topic, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-xs font-bold mb-2">
                        <span className="text-slate-300">{topic.name}</span>
                        <span className="text-slate-500">{topic.progress}%</span>
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
                  {weakTopics.map((topic, i) => (
                    <div key={i} className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800/50 group hover:border-emerald-500/30 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-bold text-white text-sm">{topic.name}</div>
                        <Zap size={14} className="text-emerald-500" />
                      </div>
                      <div className="text-[11px] text-slate-500 leading-relaxed">{topic.reason}</div>
                      <button className="mt-3 text-[10px] font-bold text-emerald-500 uppercase tracking-widest hover:text-emerald-400 transition-colors flex items-center gap-1">
                        Practice Now <ChevronRight size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>

          {/* Right Column: Cards */}
          <div className="space-y-8">
            {/* Class Performance Card */}
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
                  <div className="text-2xl font-bold text-emerald-500">74%</div>
                </div>
                <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800/50">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Class Avg</div>
                  <div className="text-2xl font-bold text-white">65%</div>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex justify-between items-end mb-2">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Percentile</div>
                  <div className="text-sm font-bold text-white">Top 28%</div>
                </div>
                <div className="h-24 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={distributionData}>
                      <defs>
                        <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
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
                            return (
                              <div className="bg-slate-900 border border-slate-800 p-2 rounded-lg text-[10px] font-bold">
                                Score: {payload[0].payload.score}%
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-between text-[10px] font-bold text-slate-600 mt-2">
                  <span>0%</span>
                  <span className="text-emerald-500">You are here</span>
                  <span>100%</span>
                </div>
              </div>
            </motion.div>

            {/* Continue Learning Card */}
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
                <h3 className="text-2xl font-bold mb-2 leading-tight">Memory Layout in C++</h3>
                <p className="text-slate-950/70 text-sm font-medium mb-8">Learn about Stack vs Heap memory management.</p>
                <button 
                  onClick={() => onSectionSelect('cpp-pointers')}
                  className="bg-slate-950 text-white px-6 py-3 rounded-2xl font-bold text-xs hover:bg-slate-900 transition-all flex items-center gap-2 shadow-xl"
                >
                  Start Lesson <ChevronRight size={14} />
                </button>
              </div>
            </motion.div>

            {/* Daily Challenge Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Daily Challenge</div>
                <div className="px-2 py-1 bg-amber-500/10 text-amber-500 rounded text-[10px] font-bold uppercase tracking-widest">Medium</div>
              </div>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center text-white">
                  <Terminal size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-white">Recursive Fibonacci</h4>
                  <p className="text-xs text-slate-500">Master recursion and optimization.</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-950/50 rounded-2xl border border-slate-800/50 mb-6">
                <div className="flex items-center gap-2">
                  <Trophy size={14} className="text-amber-500" />
                  <span className="text-xs font-bold text-white">50 XP</span>
                </div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">2.4k Solved</div>
              </div>
              <button className="w-full bg-slate-800 text-white py-3 rounded-2xl font-bold text-xs hover:bg-slate-700 transition-all">
                Accept Challenge
              </button>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};
