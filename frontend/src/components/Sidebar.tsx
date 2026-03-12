import React from 'react';
import { CheckCircle2, Circle, ChevronRight, LayoutDashboard, Code2, BarChart3, LogOut } from 'lucide-react';
import { motion } from 'motion/react';
import { Section, UserRole } from '../types';
import { cn } from '../lib/utils';

interface SidebarProps {
  sections: Section[];
  activeSectionId: string;
  onSectionSelect: (id: string) => void;
  onDashboardClick?: () => void;
  onProblemsClick?: () => void;
  onAnalyticsClick?: () => void;
  onPlaygroundClick?: () => void;
  onInstructorDashboardClick?: () => void;
  onLogout?: () => void;
  userRole?: UserRole;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  sections, 
  activeSectionId, 
  onSectionSelect,
  onDashboardClick,
  onProblemsClick,
  onAnalyticsClick,
  onPlaygroundClick,
  onInstructorDashboardClick,
  onLogout,
  userRole
}) => {
  const isInstructor = userRole === 'Instructor';

  return (
    <aside className="w-72 border-r border-slate-800 bg-[#0f172a] h-full flex flex-col fixed left-0 top-0 z-20 overflow-hidden">
      <div className="p-8">
        <h1 className="text-lg font-bold text-white flex items-center gap-3 tracking-tight">
          <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center text-slate-950 font-bold text-lg shadow-lg shadow-emerald-500/10">
            T
          </div>
          ThinkCode
        </h1>
      </div>

      <div className="px-4 mb-6 space-y-1">
        {!isInstructor ? (
          <>
            <button
              onClick={onDashboardClick}
              className={cn(
                "w-full flex items-center gap-3.5 p-3.5 rounded-xl text-sm font-medium transition-all group",
                activeSectionId === "" && !onAnalyticsClick ? "text-white bg-slate-800/30" : "text-slate-400 hover:text-white hover:bg-slate-800/30"
              )}
            >
              <LayoutDashboard size={18} className="group-hover:text-emerald-500 transition-colors" />
              <span>Dashboard</span>
            </button>
            <button
              onClick={onProblemsClick}
              className="w-full flex items-center gap-3.5 p-3.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/30 transition-all group"
            >
              <Code2 size={18} className="group-hover:text-emerald-500 transition-colors" />
              <span>Problems</span>
            </button>
            <button
              onClick={onAnalyticsClick}
              className={cn(
                "w-full flex items-center gap-3.5 p-3.5 rounded-xl text-sm font-medium transition-all group",
                activeSectionId === "analytics" ? "text-white bg-slate-800/30" : "text-slate-400 hover:text-white hover:bg-slate-800/30"
              )}
            >
              <BarChart3 size={18} className="group-hover:text-emerald-500 transition-colors" />
              <span>Analytics</span>
            </button>
            <button
              onClick={onPlaygroundClick}
              className={cn(
                "w-full flex items-center gap-3.5 p-3.5 rounded-xl text-sm font-medium transition-all group",
                activeSectionId === "playground" ? "text-white bg-slate-800/30" : "text-slate-400 hover:text-white hover:bg-slate-800/30"
              )}
            >
              <Code2 size={18} className="group-hover:text-emerald-500 transition-colors" />
              <span>Playground</span>
            </button>
          </>
        ) : (
          <button
            onClick={onInstructorDashboardClick}
            className={cn(
              "w-full flex items-center gap-3.5 p-3.5 rounded-xl text-sm font-medium transition-all group",
              activeSectionId === "instructor-dashboard" ? "text-white bg-slate-800/30" : "text-slate-400 hover:text-white hover:bg-slate-800/30"
            )}
          >
            <LayoutDashboard size={18} className="group-hover:text-emerald-500 transition-colors text-emerald-500" />
            <span className="text-emerald-500">Instructor Panel</span>
          </button>
        )}
      </div>
      
      {!isInstructor && (
        <div className="px-4 flex-1 flex flex-col min-h-0 mb-4">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] px-4 mb-4">
            Learning Path
          </div>
          <nav className="space-y-1 overflow-y-auto flex-1 pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}>
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => onSectionSelect(section.id)}
                className={cn(
                  "w-full flex items-center justify-between p-3.5 rounded-xl text-sm font-medium transition-all duration-200 group relative",
                  activeSectionId === section.id
                    ? "bg-slate-800/50 text-white"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                )}
              >
                {activeSectionId === section.id && (
                  <motion.div 
                    layoutId="sidebar-active"
                    className="absolute left-0 w-1 h-6 bg-emerald-500 rounded-r-full"
                  />
                )}
                <div className="flex items-center gap-3.5">
                  {section.isCompleted ? (
                    <CheckCircle2 size={18} className="text-emerald-500" strokeWidth={2.5} />
                  ) : (
                    <Circle size={18} className="text-slate-700" strokeWidth={2} />
                  )}
                  <span className={cn(
                    "transition-colors",
                    activeSectionId === section.id ? "font-semibold" : "font-medium"
                  )}>
                    {section.title}
                  </span>
                </div>
                <ChevronRight 
                  size={14} 
                  className={cn(
                    "transition-all duration-300",
                    activeSectionId === section.id ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
                  )} 
                />
              </button>
            ))}
          </nav>
        </div>
      )}

      <div className="mt-auto p-4 space-y-4">
        {!isInstructor && (
          <div className="bg-slate-900/50 rounded-2xl p-5 border border-slate-800">
            <div className="flex justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">
              <span>Progress</span>
              <span className="text-white">20%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: '20%' }}
                className="bg-emerald-500 h-full rounded-full"
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-3 leading-relaxed">
              Keep going! You're doing great on your C++ journey.
            </p>
          </div>
        )}

        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3.5 p-3.5 rounded-xl text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-all group"
        >
          <LogOut size={18} className="group-hover:text-red-400 transition-colors" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};
