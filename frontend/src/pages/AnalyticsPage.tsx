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
import { GoogleGenAI } from "@google/genai";

interface AnalyticsPageProps {
  sections: Section[];
  onSectionSelect: (id: string) => void;
  onDashboardClick: () => void;
  onProblemsClick: () => void;
  onPlaygroundClick?: () => void;
  onInstructorDashboardClick?: () => void;
  onLogout?: () => void;
  userRole?: UserRole;
}

const accuracyData = [
  { topic: 'C++ Basics', accuracy: 95 },
  { topic: 'Pointers', accuracy: 62 },
  { topic: 'OOP', accuracy: 84 },
  { topic: 'STL', accuracy: 78 },
];

const codingTimeData = [
  { day: 'Mon', minutes: 45 },
  { day: 'Tue', minutes: 80 },
  { day: 'Wed', minutes: 30 },
  { day: 'Thu', minutes: 120 },
  { day: 'Fri', minutes: 95 },
  { day: 'Sat', minutes: 150 },
  { day: 'Sun', minutes: 60 },
];

const hintUsageData = [
  { name: 'Solved without hints', value: 65 },
  { name: 'Used 1 hint', value: 25 },
  { name: 'Used 2+ hints', value: 10 },
];

const COLORS = ['#10b981', '#3b82f6', '#f59e0b'];

const classDifficultyData = [
  { question: 'Pointer Arithmetic', failRate: 65, topic: 'Pointers' },
  { question: 'Virtual Functions', failRate: 48, topic: 'OOP' },
  { question: 'STL Map Iterators', failRate: 42, topic: 'STL' },
  { question: 'Memory Leaks', failRate: 38, topic: 'Pointers' },
];

const positionData = [
  { name: 'Top 10%', students: 15 },
  { name: 'Top 25%', students: 45 },
  { name: 'Top 50%', students: 80 },
  { name: 'Bottom 50%', students: 60 },
];

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({
  sections,
  onSectionSelect,
  onDashboardClick,
  onProblemsClick,
  onPlaygroundClick,
  onInstructorDashboardClick,
  onLogout,
  userRole
}) => {
  const [aiInsight, setAiInsight] = useState<string>("Analyzing your performance data...");
  const [isAnalyzing, setIsAnalyzing] = useState(true);

  useEffect(() => {
    const fetchInsight = async () => {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const prompt = `
          Analyze the following student performance data for a C++ course and provide a concise, encouraging recommendation (max 3 sentences).
          
          Data:
          - Accuracy by Topic: C++ Basics (95%), Pointers (62%), OOP (84%), STL (78%)
          - Coding Activity: High on weekends, moderate on weekdays.
          - Hint Usage: 35% of problems require at least one hint.
          
          Provide an insight similar to: "You seem to struggle with pointer concepts. Consider reviewing memory management."
        `;
        
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
        });
        
        setAiInsight(response.text || "You're doing great! Keep focusing on Pointers to improve your overall mastery.");
      } catch (error) {
        console.error("AI Insight error:", error);
        setAiInsight("You seem to struggle with pointer concepts. Consider reviewing memory management and pointer arithmetic to strengthen your foundation.");
      } finally {
        setIsAnalyzing(false);
      }
    };

    fetchInsight();
  }, []);

  return (
    <div className="flex min-h-screen bg-[#0f172a]">
      <Sidebar 
        sections={sections}
        activeSectionId="analytics"
        onSectionSelect={onSectionSelect}
        onDashboardClick={onDashboardClick}
        onProblemsClick={onProblemsClick}
        onPlaygroundClick={onPlaygroundClick}
        onInstructorDashboardClick={onInstructorDashboardClick}
        onLogout={onLogout}
        userRole={userRole}
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
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
                  <Brain size={20} />
                </div>
                <h2 className="text-lg font-bold text-white uppercase tracking-wider">AI Performance Insight</h2>
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
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-500">
                    <BarChart3 size={18} />
                  </div>
                  <h3 className="font-bold text-white uppercase tracking-widest text-xs">Accuracy by Topic</h3>
                </div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Last 30 Days</div>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={accuracyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis 
                      dataKey="topic" 
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
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                      itemStyle={{ color: '#10b981' }}
                    />
                    <Bar dataKey="accuracy" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Time Spent Coding */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-8"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-500">
                    <Clock size={18} />
                  </div>
                  <h3 className="font-bold text-white uppercase tracking-widest text-xs">Time Spent Coding</h3>
                </div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Minutes / Day</div>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={codingTimeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis 
                      dataKey="day" 
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
                    <Line 
                      type="monotone" 
                      dataKey="minutes" 
                      stroke="#10b981" 
                      strokeWidth={3} 
                      dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
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
                <div className="p-6 bg-slate-950/50 rounded-2xl border border-slate-800/50">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Total Solved</div>
                  <div className="text-3xl font-bold text-white">124</div>
                  <div className="mt-2 flex items-center gap-1 text-emerald-500 text-[10px] font-bold">
                    <TrendingUp size={12} />
                    +15% this week
                  </div>
                </div>
                <div className="p-6 bg-slate-950/50 rounded-2xl border border-slate-800/50">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Avg. Time</div>
                  <div className="text-3xl font-bold text-white">12m</div>
                  <div className="mt-2 flex items-center gap-1 text-emerald-500 text-[10px] font-bold">
                    <TrendingUp size={12} />
                    -2m from avg
                  </div>
                </div>
                <div className="p-6 bg-slate-950/50 rounded-2xl border border-slate-800/50">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Mastery Score</div>
                  <div className="text-3xl font-bold text-white">820</div>
                  <div className="mt-2 flex items-center gap-1 text-blue-500 text-[10px] font-bold">
                    Top 5% of users
                  </div>
                </div>
                <div className="p-6 bg-slate-950/50 rounded-2xl border border-slate-800/50">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Streak</div>
                  <div className="text-3xl font-bold text-white">4d</div>
                  <div className="mt-2 flex items-center gap-1 text-amber-500 text-[10px] font-bold">
                    Keep it up!
                  </div>
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
                        <div className="text-4xl font-bold text-white mb-1">Top 28%</div>
                        <div className="text-sm text-slate-400 font-medium">You are performing better than 72% of the class.</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-1">Rank</div>
                        <div className="text-xl font-bold text-white">#42 / 150</div>
                      </div>
                    </div>
                    
                    <div className="h-4 w-full bg-slate-950 rounded-full overflow-hidden flex">
                      <div className="h-full bg-emerald-500/20 border-r border-emerald-500/30" style={{ width: '10%' }} />
                      <div className="h-full bg-emerald-500/40 border-r border-emerald-500/30" style={{ width: '15%' }} />
                      <div className="h-full bg-emerald-500 relative" style={{ width: '3%' }}>
                        <div className="absolute -top-1 -bottom-1 left-1/2 w-1 bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
                      </div>
                      <div className="h-full bg-slate-800" style={{ width: '72%' }} />
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

                <div className="w-full md:w-64 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={positionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="students"
                      >
                        {positionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 1 ? '#10b981' : '#1e293b'} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="text-center mt-2">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Class Distribution</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};
