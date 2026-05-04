import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface Course {
  id: string;
  name: string;
  role: string;
}

interface CourseSelectorProps {
  courses: Course[];
  activeCourseId: string;
  onCourseChange: (courseId: string) => void;
  className?: string;
}

export const CourseSelector: React.FC<CourseSelectorProps> = ({
  courses,
  activeCourseId,
  onCourseChange,
  className
}) => {
  return (
    <div className={cn("flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar", className)}>
      {courses.map((course) => {
        const isActive = course.id === activeCourseId;
        return (
          <button
            key={course.id}
            onClick={() => onCourseChange(course.id)}
            className={cn(
              "relative px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap",
              isActive 
                ? "text-slate-950" 
                : "text-slate-400 hover:text-slate-200 bg-slate-800/50 hover:bg-slate-800"
            )}
          >
            {isActive && (
              <motion.div
                layoutId="active-course"
                className="absolute inset-0 bg-[#00e5a0] rounded-full"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative z-10">{course.name}</span>
          </button>
        );
      })}
    </div>
  );
};
