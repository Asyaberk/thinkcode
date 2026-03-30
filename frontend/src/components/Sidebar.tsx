import React from 'react';
import { CheckCircle2, Circle, ChevronRight, LayoutDashboard, Code2, BarChart3, LogOut, Layers } from 'lucide-react';
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
  onContentBuilderClick?: () => void;
  onLogout?: () => void;
  userRole?: UserRole;
  /** Tamamlanan ders oranı 0-100 (isCompleted olan section sayısından hesapla) */
  progressPercent?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sections,
  activeSectionId,
  onSectionSelect,
  onDashboardClick,
  onProblemsClick,
  onAnalyticsClick,
  onInstructorDashboardClick,
  onContentBuilderClick,
  onLogout,
  userRole,
  progressPercent = 0,   // varsayilan 0
}) => {
  const isInstructor = userRole === 'Instructor';

  return (
    <aside className="w-72 border-r border-slate-800 bg-[#0f172a] h-full flex flex-col fixed left-0 top-0 z-20 overflow-hidden">
      <div className="p-8 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center text-slate-950 font-black text-base shadow-lg shadow-emerald-500/20 shrink-0">
            T
          </div>
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
              onClick={onContentBuilderClick}
              className={cn(
                "w-full flex items-center gap-3.5 p-3.5 rounded-xl text-sm font-medium transition-all group",
                activeSectionId === "content-builder" ? "text-white bg-slate-800/30" : "text-slate-400 hover:text-white hover:bg-slate-800/30"
              )}
            >
              <Layers size={18} className="group-hover:text-emerald-500 transition-colors" />
              <span>Content Builder</span>
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
                  // Yalnizca "Fundamentals" parent'i kendi dersini de goster
                  const itemList = section.title === 'Fundamentals' ? [section, ...children] : children;
                  itemList.forEach(child => {
                    rendered.push(
                      <button
                        key={child.id}
                        onClick={() => onSectionSelect(child.id)}
                        className={cn(
                          "w-full flex items-center justify-between py-2 pl-6 pr-3 rounded-xl text-xs font-medium transition-all duration-200 group relative",
                          activeSectionId === child.id
                            ? "bg-slate-800/50 text-white"
                            : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                        )}
                      >
                        {activeSectionId === child.id && (
                          <motion.div
                            layoutId="sidebar-active"
                            className="absolute left-0 w-1 h-5 bg-emerald-500 rounded-r-full"
                          />
                        )}
                        <div className="flex items-center gap-2.5">
                          {child.isCompleted ? (
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
                        <ChevronRight
                          size={12}
                          className={cn(
                            "shrink-0 transition-all duration-300",
                            activeSectionId === child.id ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
                          )}
                        />
                      </button>
                    );
                  });
                  lastWasParent = true;
                } else {
                  // Tek basina duran konu (Fundamentals, Dynamic Programming vs.)
                  rendered.push(
                    <button
                      key={section.id}
                      onClick={() => onSectionSelect(section.id)}
                      className={cn(
                        "w-full flex items-center justify-between p-3 rounded-xl text-sm font-medium transition-all duration-200 group relative",
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
                      <div className="flex items-center gap-3">
                        {section.isCompleted ? (
                          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" strokeWidth={2.5} />
                        ) : (
                          <Circle size={16} className="text-slate-700 shrink-0" strokeWidth={2} />
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
                          "shrink-0 transition-all duration-300",
                          activeSectionId === section.id ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
                        )}
                      />
                    </button>
                  );
                  lastWasParent = false;
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
