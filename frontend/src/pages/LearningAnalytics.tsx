import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { motion } from 'motion/react';
import { Brain, Clock, Target, Lightbulb, TrendingUp, Award } from 'lucide-react';

const accuracyData = [
  { topic: 'C++ Basics', accuracy: 85 },
  { topic: 'Pointers', accuracy: 45 },
  { topic: 'OOP', accuracy: 70 },
  { topic: 'STL', accuracy: 60 },
];

const timeSpentData = [
  { day: 'Mon', minutes: 45 },
  { day: 'Tue', minutes: 30 },
  { day: 'Wed', minutes: 60 },
  { day: 'Thu', minutes: 20 },
  { day: 'Fri', minutes: 90 },
  { day: 'Sat', minutes: 120 },
  { day: 'Sun', minutes: 45 },
];

const hintUsageData = [
  { name: 'No Hint', value: 65 },
  { name: 'Hint Level 1', value: 15 },
  { name: 'Hint Level 2', value: 10 },
  { name: 'Hint Level 3', value: 7 },
  { name: 'Hint Level 4', value: 3 },
];

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export const LearningAnalytics: React.FC = () => {
  return (
    <div className="p-8 bg-[#0f172a] min-h-screen text-white">
      <div className="max-w-7xl mx-auto">
        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Learning Analytics</h1>
          <p className="text-slate-400">Track your progress and identify areas for improvement.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Accuracy by Topic */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2 bg-slate-900/50 border border-slate-800 rounded-3xl p-8 shadow-xl"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Target className="text-emerald-500" size={24} />
              </div>
              <h2 className="text-xl font-semibold">Accuracy by Topic</h2>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={accuracyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="topic" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }}
                    itemStyle={{ color: '#10b981' }}
                  />
                  <Bar dataKey="accuracy" fill="#10b981" radius={[6, 6, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* AI Insight Panel */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border border-indigo-500/20 rounded-3xl p-8 shadow-xl backdrop-blur-sm relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Brain size={120} />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-indigo-500/20 rounded-lg">
                  <Brain className="text-indigo-400" size={24} />
                </div>
                <h2 className="text-xl font-semibold">AI Insights</h2>
              </div>
              <div className="space-y-6">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                  <p className="text-indigo-200 text-sm leading-relaxed">
                    "You seem to struggle with <span className="text-white font-bold">pointer concepts</span>. Your accuracy in this topic is 45%, which is below your average. Consider reviewing memory management and pointer arithmetic."
                  </p>
                </div>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                  <p className="text-emerald-200 text-sm leading-relaxed">
                    "Great job on <span className="text-white font-bold">C++ Basics</span>! You've maintained an 85% accuracy rate. You're ready to dive deeper into OOP."
                  </p>
                </div>
                <button className="w-full py-3 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl font-medium transition-colors shadow-lg shadow-indigo-500/20">
                  Generate New Analysis
                </button>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Time Spent Coding */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 shadow-xl"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Clock className="text-blue-500" size={24} />
              </div>
              <h2 className="text-xl font-semibold">Time Spent Coding</h2>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeSpentData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="day" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}m`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }}
                    itemStyle={{ color: '#3b82f6' }}
                  />
                  <Line type="monotone" dataKey="minutes" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Hint Usage */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 shadow-xl"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <Lightbulb className="text-amber-500" size={24} />
              </div>
              <h2 className="text-xl font-semibold">Hint Usage Distribution</h2>
            </div>
            <div className="flex flex-col md:flex-row items-center justify-around">
              <div className="h-[250px] w-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={hintUsageData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {hintUsageData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3 mt-6 md:mt-0">
                {hintUsageData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-sm text-slate-400">{entry.name}</span>
                    <span className="text-sm font-bold">{entry.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
