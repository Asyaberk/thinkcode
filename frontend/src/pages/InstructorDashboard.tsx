import React from 'react';
import { Sidebar } from '../components/Sidebar';
import { cn } from '../lib/utils';
import { Section, UserRole } from '../types';
import { instructorData } from '../mockData';
import { 
  Users, 
  TrendingUp, 
  Target, 
  AlertCircle, 
  BarChart, 
  ChevronRight, 
  Search,
  MessageSquare,
  ArrowUpRight
} from 'lucide-react';
import { 
  BarChart as ReBarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

interface InstructorDashboardProps {
  sections: Section[];
  onDashboardClick: () => void;
  onProblemsClick: () => void;
  onAnalyticsClick: () => void;
  onPlaygroundClick?: () => void;
  onSectionSelect: (id: string) => void;
  onInstructorDashboardClick?: () => void;
  onLogout?: () => void;
  userRole?: UserRole;
}

export const InstructorDashboard: React.FC<InstructorDashboardProps> = ({
  sections,
  onDashboardClick,
  onProblemsClick,
  onAnalyticsClick,
  onPlaygroundClick,
  onSectionSelect,
  onInstructorDashboardClick,
  onLogout,
  userRole
}) => {
  const { classOverview, knowledgeGaps, difficultQuestions, openResponseStats, students } = instructorData;

  return (
    <div className="flex h-screen bg-[#0f172a] text-slate-200 overflow-hidden">
      <Sidebar 
        sections={sections}
        activeSectionId="instructor-dashboard"
        onSectionSelect={onSectionSelect}
        onDashboardClick={onDashboardClick}
        onProblemsClick={onProblemsClick}
        onAnalyticsClick={onAnalyticsClick}
        onPlaygroundClick={onPlaygroundClick}
        onInstructorDashboardClick={onInstructorDashboardClick}
        onLogout={onLogout}
        userRole={userRole}
      />

      <main className="flex-1 overflow-y-auto ml-72">
        <div className="p-8 max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Instructor Dashboard</h1>
              <p className="text-slate-400">Class Performance & Learning Analytics for Algorithms 101</p>
            </div>
            <div className="flex gap-3">
              <div className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-xl flex items-center gap-2">
                <Users size={18} className="text-emerald-500" />
                <span className="text-sm font-medium">{classOverview.totalStudents} Students</span>
              </div>
              <button className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-500/20">
                Generate Report
              </button>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <TrendingUp size={80} />
              </div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">Average Score</p>
              <h2 className="text-4xl font-bold text-white mb-2">{classOverview.averageScore}%</h2>
              <div className="flex items-center gap-2 text-emerald-500 text-xs font-bold">
                <ArrowUpRight size={14} />
                <span>+2.4% from last week</span>
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Target size={80} />
              </div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">Median Score</p>
              <h2 className="text-4xl font-bold text-white mb-2">{classOverview.medianScore}%</h2>
              <p className="text-slate-400 text-xs">Consistent with course average</p>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <MessageSquare size={80} />
              </div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">Open Response Avg</p>
              <h2 className="text-4xl font-bold text-white mb-2">{openResponseStats.averageScore}%</h2>
              <p className="text-slate-400 text-xs">Based on 124 graded answers</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Score Distribution */}
            <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-3xl flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
                    <BarChart size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-white">Student Distribution</h3>
                </div>
              </div>
              
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ReBarChart data={classOverview.distribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis 
                      dataKey="range" 
                      stroke="#64748b" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <YAxis 
                      stroke="#64748b" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                      itemStyle={{ color: '#10b981' }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {classOverview.distribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 2 ? '#10b981' : '#3b82f6'} fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </ReBarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-center text-slate-500 text-xs mt-4 italic">
                Most students are performing in the 70-85% range.
              </p>
            </div>

            {/* Knowledge Gaps */}
            <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-3xl">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500">
                  <AlertCircle size={20} />
                </div>
                <h3 className="text-lg font-bold text-white">Knowledge Gaps</h3>
              </div>
              
              <div className="space-y-6">
                {knowledgeGaps.map((gap, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-slate-300">{gap.topic}</span>
                      <span className="font-bold text-amber-500">{gap.incorrectRate}% incorrect</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-amber-500 h-full rounded-full transition-all duration-1000"
                        style={{ width: `${gap.incorrectRate}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Most Difficult Questions */}
            <div className="lg:col-span-1 bg-slate-900/50 border border-slate-800 p-8 rounded-3xl">
              <h3 className="text-lg font-bold text-white mb-6">Most Difficult Questions</h3>
              <div className="space-y-4">
                {difficultQuestions.map((q, i) => (
                  <div key={i} className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-2xl flex items-center justify-between group hover:border-emerald-500/30 transition-all">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-200">{q.title}</span>
                      <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mt-1">Fail Rate: {q.failRate}%</span>
                    </div>
                    <ChevronRight size={16} className="text-slate-600 group-hover:text-emerald-500 transition-colors" />
                  </div>
                ))}
              </div>
            </div>

            {/* AI Grading Feedback Summary */}
            <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800 p-8 rounded-3xl flex flex-col">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-500">
                  <Target size={20} />
                </div>
                <h3 className="text-lg font-bold text-white">AI Grading Feedback Summary</h3>
              </div>
              <div className="flex-1 bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6 relative">
                <div className="absolute top-4 right-4 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded uppercase tracking-widest">
                  AI Generated
                </div>
                <p className="text-slate-300 leading-relaxed italic">
                  "{openResponseStats.aiFeedbackSummary}"
                </p>
                <div className="mt-6 pt-6 border-t border-slate-700/50 flex items-center gap-4">
                  <div className="flex -space-x-2">
                    {[1,2,3].map(i => (
                      <div key={i} className="w-8 h-8 rounded-full border-2 border-slate-900 bg-slate-700 flex items-center justify-center text-[10px] font-bold">
                        S{i}
                      </div>
                    ))}
                  </div>
                  <span className="text-xs text-slate-500">Reviewing 12 recent submissions...</span>
                </div>
              </div>
            </div>
          </div>

          {/* Student List */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden">
            <div className="p-8 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Student Performance List</h3>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input 
                  type="text" 
                  placeholder="Search students..." 
                  className="bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-800/30 text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em]">
                    <th className="px-8 py-4">Name</th>
                    <th className="px-8 py-4">Avg Score</th>
                    <th className="px-8 py-4">Percentile</th>
                    <th className="px-8 py-4">Attempted</th>
                    <th className="px-8 py-4">Weak Topic</th>
                    <th className="px-8 py-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {students.map((student, i) => (
                    <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-8 py-5">
                        <span className="text-sm font-bold text-white">{student.name}</span>
                      </td>
                      <td className="px-8 py-5">
                        <span className={cn(
                          "text-sm font-bold",
                          student.averageScore >= 80 ? "text-emerald-500" : 
                          student.averageScore >= 60 ? "text-blue-500" : "text-amber-500"
                        )}>
                          {student.averageScore}%
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <span className="text-xs font-medium text-slate-400">Top {100 - student.percentile}%</span>
                      </td>
                      <td className="px-8 py-5">
                        <span className="text-xs font-medium text-slate-400">{student.questionsAttempted} Questions</span>
                      </td>
                      <td className="px-8 py-5">
                        <span className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-[10px] font-bold text-slate-300">
                          {student.weakTopic}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <button className="text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors">
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
