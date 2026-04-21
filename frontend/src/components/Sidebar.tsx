import React from 'react';
import { CheckCircle2, Circle, ChevronRight, LayoutDashboard, Code2, BarChart3, LogOut, Layers, GitBranch, Lock } from 'lucide-react';
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
  onLogout?: () => void;
  userRole?: UserRole;
  /** Tamamlanan ders oranı 0-100 */
  progressPercent?: number;
  /** Flow'un kilitlediği section ID'leri — kilitli section'lar gri + lock ikonu gösterir */
  lockedSectionIds?: Set<string>;
  /** Aktif flow pattern — lock tooltip mesajı için */
  flowPattern?: string;
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
  onLogout,
  userRole,
  progressPercent = 0,
  lockedSectionIds = new Set(),
  flowPattern,
}) => {
  const isInstructor = userRole === 'Instructor';

  return (
    <aside className="w-72 border-r border-slate-800 bg-[#0b1222] h-full flex flex-col fixed left-0 top-0 z-20 overflow-hidden">
      <div className="p-8 pb-6">
        <div className="flex items-center gap-3">
          <img
            src="/thinkcode_logo.png"
            alt="ThinkCode Logo"
            className="h-9 w-auto object-contain shrink-0"
          />
          <div className="leading-none">
            <span className="text-[17px] font-light text-slate-300 tracking-tight">Think</span><span className="text-[17px] font-bold text-emerald-400 tracking-tight">Code</span>
          </div>
        </div>
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
          </>
        ) : (
          <>
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
            <button
              onClick={onCourseBuilderClick}
              className={cn(
                "w-full flex items-center gap-3.5 p-3.5 rounded-xl text-sm font-medium transition-all group",
                activeSectionId === "course-builder" ? "text-white bg-slate-800/30" : "text-slate-400 hover:text-white hover:bg-slate-800/30"
              )}
            >
              <Layers size={18} className="group-hover:text-emerald-500 transition-colors" />
              <span>Course Builder</span>
            </button>
            <button
              onClick={onFlowDesignerClick}
              className={cn(
                "w-full flex items-center gap-3.5 p-3.5 rounded-xl text-sm font-medium transition-all group",
                activeSectionId === "flow-designer" ? "text-white bg-slate-800/30" : "text-slate-400 hover:text-white hover:bg-slate-800/30"
              )}
            >
              <GitBranch size={18} className="group-hover:text-emerald-500 transition-colors" />
              <span>Flow Designer</span>
            </button>
          </>
        )}
      </div>
      
      {!isInstructor && (
        <div className="px-4 flex-1 flex flex-col min-h-0 mb-4">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] px-4 mb-4">
            Learning Path
          </div>
          <nav className="space-y-0.5 overflow-y-auto flex-1 pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}>
            {(() => {
              // parent'larin sirasina gore gruplama
              const parents = sections.filter(s => !s.parentId);
              const childrenOf = (pid: string) => sections.filter(s => s.parentId === pid);
              // parent'a bagli olmayan tek konular (Fundamentals, Dynamic Programming vs.)
              const orphans = sections.filter(s => !s.parentId && childrenOf(s.id).length === 0);
              // gercek parent'lar (alti olan)
              const realParents = sections.filter(s => !s.parentId && childrenOf(s.id).length > 0);

              // hepsini display_order'a gore siralayarak render et
              const rendered: React.ReactElement[] = [];
              let lastWasParent = false;

              sections.forEach((section) => {
                // child section'lar parent'in altinda render edilecek — burada atliyoruz
                if (section.parentId) return;

                const children = childrenOf(section.id);
                const isRealParent = children.length > 0;
                const allChildrenDone = isRealParent && children.every(c => c.isCompleted);

                if (isRealParent) {
                  // Grup ayiricisi: parent konu baslik etiket
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
                  // Yalnizca child'lar listelenir, parent başlık olarak gösterildi
                  const itemList = children;
                  itemList.forEach(child => {
                    const isLocked = lockedSectionIds.has(child.id);
                    rendered.push(
                      <button
                        key={child.id}
                        onClick={() => !isLocked && onSectionSelect(child.id)}
                        title={isLocked ? 'Bu bölüm kilitli — önce aktif bölümü tamamla' : undefined}
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
                              activeSectionId === child.id ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
                            )}
                          />
                        )}
                        {isLocked && <Lock size={10} className="text-slate-600 shrink-0" />}
                      </button>
                    );
                  });
                }
              });

              return rendered;
            })()}
          </nav>

        </div>
      )}

      <div className="mt-auto p-4 space-y-4">
        {!isInstructor && (
          <div className="bg-slate-900/50 rounded-2xl p-5 border border-slate-800">
            <div className="flex justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">
              <span>Progress</span>
              <span className="text-white">{Math.round(progressPercent)}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                className="bg-emerald-500 h-full rounded-full"
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-3 leading-relaxed">
              {progressPercent > 0
                ? `${sections.filter(s => s.isCompleted).length} of ${sections.length} topics done.`
                : 'Start solving problems to track your progress.'}
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
