import React, { useState } from 'react';
import { CheckCircle2, Circle, ChevronRight, ChevronDown, LayoutDashboard, Code2, BarChart3, LogOut, Layers, GitBranch, Lock, Users, BookOpen, AlertTriangle, Lightbulb, Target, TrendingUp, Activity } from 'lucide-react';
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
  onInstructorDashboardClick?: () => void;
  onCourseBuilderClick?: () => void;
  onFlowDesignerClick?: () => void;
  onEnrollmentManagementClick?: () => void;
  pendingEnrollmentsCount?: number;
  onSwitchCourse?: () => void;
  onLogout?: () => void;
  userRole?: UserRole;
  courseName?: string;
  progressPercent?: number;
  lockedSectionIds?: Set<string>;
  flowPattern?: string;
  /** Instructor: currently active analytics sub-view */
  activeAnalyticsView?: string;
  /** Instructor: callback when a sub-view is selected */
  onAnalyticsViewChange?: (view: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sections,
  activeSectionId,
  onSectionSelect,
  onDashboardClick,
  onProblemsClick,
  onAnalyticsClick,
  onInstructorDashboardClick,
  onCourseBuilderClick,
  onFlowDesignerClick,
  onEnrollmentManagementClick,
  pendingEnrollmentsCount = 0,
  onSwitchCourse,
  onLogout,
  userRole,
  courseName,
  progressPercent = 0,
  lockedSectionIds = new Set(),
  flowPattern,
  activeAnalyticsView = 'overview',
  onAnalyticsViewChange,
}) => {
  const isInstructor = userRole === 'Instructor';
  const [analyticsOpen, setAnalyticsOpen] = useState(
    ['topics','problems','students','hints','gaps'].includes(activeAnalyticsView)
  );

  // Compute from sections if progressPercent not passed
  const computed = sections.length > 0
    ? Math.round((sections.filter(s => s.isCompleted).length / sections.length) * 100)
    : 0;
  const progress = progressPercent > 0 ? progressPercent : computed;

  return (
    <aside className="w-72 border-r border-slate-800 bg-[#0b1222] flex flex-col fixed left-0 top-[180px] bottom-0 z-20 overflow-hidden">
      {/* Logo */}
      <div className="p-8 pb-6">
        <div className="flex items-center gap-3">
          <img
            src="/thinkcode_logo.png"
            alt="ThinkCode Logo"
            className="h-9 w-auto object-contain shrink-0"
            onError={(e) => {
              // fallback: "T" badge if logo file missing
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <div className="leading-none">
            <span className="text-[17px] font-light text-slate-300 tracking-tight">Think</span>
            <span className="text-[17px] font-bold text-emerald-400 tracking-tight">Code</span>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <div className="px-4 mb-6 space-y-1">
        {!isInstructor ? (
          <>
            <button
              onClick={onDashboardClick}
              className={cn(
                "w-full flex items-center gap-3.5 p-3.5 rounded-xl text-sm font-medium transition-all group",
                activeSectionId === "" && !onAnalyticsClick
                  ? "text-white bg-slate-800/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/30"
              )}
            >
              <LayoutDashboard size={18} className="group-hover:text-emerald-500 transition-colors" />
              <span>Menu</span>
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
                activeSectionId === "analytics"
                  ? "text-white bg-slate-800/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/30"
              )}
            >
              <BarChart3 size={18} className="group-hover:text-emerald-500 transition-colors" />
              <span>Analytics</span>
            </button>
          </>
        ) : (
          <>
            {/* ── Class Overview ─────────────────────────── */}
            <button
              onClick={onInstructorDashboardClick}
              className={cn(
                "w-full flex items-center gap-3 p-3.5 rounded-xl text-sm font-medium transition-all group",
                activeSectionId === 'instructor-dashboard' && activeAnalyticsView === 'overview'
                  ? "text-white bg-emerald-500/10 border border-emerald-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/30"
              )}
            >
              <LayoutDashboard size={16} className="shrink-0 group-hover:text-emerald-400 transition-colors" />
              <span>Class Overview</span>
            </button>

            {/* ── Class Analytics accordion ───────────────── */}
            <div className="space-y-0.5">
              <button
                onClick={() => setAnalyticsOpen(o => !o)}
                className={cn(
                  "w-full flex items-center gap-3 p-3.5 rounded-xl text-sm font-medium transition-all group",
                  ['topics','problems','students','hints','gaps'].includes(activeAnalyticsView)
                    ? "text-white bg-slate-800/40"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                )}
              >
                <BarChart3 size={16} className="shrink-0 group-hover:text-emerald-400 transition-colors" />
                <span className="flex-1 text-left">Class Analytics</span>
                {analyticsOpen
                  ? <ChevronDown size={14} className="text-slate-500" />
                  : <ChevronRight size={14} className="text-slate-500" />}
              </button>

              {analyticsOpen && (
                <div className="ml-4 pl-3 border-l border-slate-800 space-y-0.5 py-1">
                  {([
                    { id: 'topics',   icon: BookOpen,      label: 'Topic Analysis' },
                    { id: 'problems', icon: Target,        label: 'Problem Insights' },
                    { id: 'students', icon: Users,         label: 'Student Performance' },
                    { id: 'hints',    icon: Lightbulb,     label: 'Hint Analytics' },
                    { id: 'gaps',     icon: AlertTriangle, label: 'Knowledge Gaps' },
                  ] as const).map(({ id, icon: Icon, label }) => (
                    <button
                      key={id}
                      onClick={() => { onAnalyticsViewChange?.(id); }}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all group",
                        activeAnalyticsView === id
                          ? "text-emerald-400 bg-emerald-500/10"
                          : "text-slate-500 hover:text-slate-200 hover:bg-slate-800/30"
                      )}
                    >
                      <Icon size={14} className="shrink-0" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Course Builder ──────────────────────────── */}
            <button
              onClick={onCourseBuilderClick}
              className={cn(
                "w-full flex items-center gap-3 p-3.5 rounded-xl text-sm font-medium transition-all group",
                activeSectionId === 'course-builder'
                  ? "text-white bg-slate-800/40"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/30"
              )}
            >
              <Layers size={16} className="shrink-0 group-hover:text-emerald-400 transition-colors" />
              <span>Course Builder</span>
            </button>

            {/* ── Flow Designer ───────────────────────────── */}
            <button
              onClick={onFlowDesignerClick}
              className={cn(
                "w-full flex items-center gap-3 p-3.5 rounded-xl text-sm font-medium transition-all group",
                activeSectionId === 'flow-designer'
                  ? "text-white bg-slate-800/40"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/30"
              )}
            >
              <GitBranch size={16} className="shrink-0 group-hover:text-emerald-400 transition-colors" />
              <span>Flow Designer</span>
            </button>

            {/* ── Enrollments ────────────────────────────── */}
            <button
              onClick={onEnrollmentManagementClick}
              className={cn(
                "w-full flex items-center gap-3 p-3.5 rounded-xl text-sm font-medium transition-all group",
                activeSectionId === 'enrollment-management'
                  ? "text-white bg-slate-800/40"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/30"
              )}
            >
              <Users size={16} className="shrink-0 group-hover:text-emerald-400 transition-colors" />
              <span>Enrollments</span>
              {pendingEnrollmentsCount > 0 && (
                <span className="ml-auto min-w-[20px] h-5 px-1.5 bg-amber-500 text-slate-950 rounded-full text-[10px] font-black flex items-center justify-center">
                  {pendingEnrollmentsCount}
                </span>
              )}
            </button>
          </>
        )}
      </div>

      {/* Learning Path — only for students */}
      {!isInstructor && (
        <div className="px-4 flex-1 flex flex-col min-h-0 mb-4">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] px-4 mb-4">
            Learning Path
          </div>
          <nav className="space-y-0.5 overflow-y-auto flex-1 pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}>
            {(() => {
              const childrenOf = (pid: string) => sections.filter(s => s.parentId === pid);
              const rendered: React.ReactElement[] = [];

              sections.forEach((section) => {
                if (section.parentId) return; // children rendered below parent

                const children = childrenOf(section.id);
                const isRealParent = children.length > 0;
                const allChildrenDone = isRealParent && children.every(c => c.isCompleted);

                if (isRealParent) {
                  // Group header label
                  rendered.push(
                    <div key={`group-${section.id}`} className="pt-4 pb-1 px-4">
                      <div className="flex items-center gap-2">
                        <div className={`h-px flex-1 ${allChildrenDone ? 'bg-emerald-500/40' : 'bg-slate-800'}`} />
                        <span className={`text-[9px] font-bold uppercase tracking-[0.18em] whitespace-nowrap ${allChildrenDone ? 'text-emerald-500' : 'text-slate-500'}`}>
                          {section.title}
                        </span>
                        <div className={`h-px flex-1 ${allChildrenDone ? 'bg-emerald-500/40' : 'bg-slate-800'}`} />
                      </div>
                    </div>
                  );
                  children.forEach(child => {
                    const isLocked = lockedSectionIds.has(child.id);
                    rendered.push(
                      <button
                        key={child.id}
                        onClick={() => !isLocked && onSectionSelect(child.id)}
                        title={isLocked ? 'This section is locked — complete the current section first' : undefined}
                        className={cn(
                          "w-full flex items-center justify-between py-2 pl-6 pr-3 rounded-xl text-xs font-medium transition-all duration-200 group relative",
                          isLocked
                            ? "opacity-40 cursor-not-allowed"
                            : activeSectionId === child.id
                              ? "bg-slate-800/50 text-white"
                              : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                        )}
                      >
                        {activeSectionId === child.id && !isLocked && (
                          <motion.div
                            layoutId="sidebar-active"
                            className="absolute left-0 w-1 h-5 bg-emerald-500 rounded-r-full"
                          />
                        )}
                        <div className="flex items-center gap-2.5">
                          {isLocked ? (
                            <Lock size={14} className="text-slate-600 shrink-0" />
                          ) : child.isCompleted ? (
                            <CheckCircle2 size={14} className="text-emerald-500 shrink-0" strokeWidth={2.5} />
                          ) : (
                            <Circle size={14} className="text-slate-700 shrink-0" strokeWidth={2} />
                          )}
                          <span className={cn(
                            "transition-colors leading-tight",
                            activeSectionId === child.id ? "font-semibold text-white" : ""
                          )}>
                            {child.title}
                          </span>
                        </div>
                        {!isLocked && (
                          <ChevronRight
                            size={12}
                            className={cn(
                              "shrink-0 transition-all duration-300",
                              activeSectionId === child.id
                                ? "translate-x-0 opacity-100"
                                : "-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
                            )}
                          />
                        )}
                        {isLocked && <Lock size={10} className="text-slate-600 shrink-0" />}
                      </button>
                    );
                  });
                } else {
                  // Standalone (no children)
                  const isLocked = lockedSectionIds.has(section.id);
                  rendered.push(
                    <button
                      key={section.id}
                      onClick={() => !isLocked && onSectionSelect(section.id)}
                      title={isLocked ? 'This section is locked' : undefined}
                      className={cn(
                        "w-full flex items-center justify-between p-3.5 rounded-xl text-sm font-medium transition-all duration-200 group relative",
                        isLocked
                          ? "opacity-40 cursor-not-allowed"
                          : activeSectionId === section.id
                            ? "bg-slate-800/50 text-white"
                            : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                      )}
                    >
                      {activeSectionId === section.id && !isLocked && (
                        <motion.div
                          layoutId="sidebar-active"
                          className="absolute left-0 w-1 h-6 bg-emerald-500 rounded-r-full"
                        />
                      )}
                      <div className="flex items-center gap-3.5">
                        {isLocked ? (
                          <Lock size={18} className="text-slate-600" />
                        ) : section.isCompleted ? (
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
                      {!isLocked && (
                        <ChevronRight
                          size={14}
                          className={cn(
                            "transition-all duration-300",
                            activeSectionId === section.id
                              ? "translate-x-0 opacity-100"
                              : "-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
                          )}
                        />
                      )}
                    </button>
                  );
                }
              });

              return rendered;
            })()}
          </nav>
        </div>
      )}

      {/* Bottom: Progress (logout + switch moved to CourseBanner) */}
      <div className="mt-auto p-4 space-y-3">

        {/* Progress bar — students only */}
        {!isInstructor && (
          <div className="bg-slate-900/50 rounded-2xl p-5 border border-slate-800">
            <div className="flex justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">
              <span>Progress</span>
              <span className="text-white">{progress}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                className="bg-emerald-500 h-full rounded-full"
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-3 leading-relaxed">
              {progress > 0
                ? `${sections.filter(s => s.isCompleted).length} of ${sections.length} topics done.`
                : 'Start solving problems to track your progress.'}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
};
