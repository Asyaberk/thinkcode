/**
 * CourseBanner.tsx — Full-width course identity banner.
 * 
 * Sits at the top of every in-course page (above sidebar+content layout).
 * Shows: course name + code on the left, Logout + Switch Course on the right.
 * The left side has a subtle gradient tied to the active course colour.
 */

import React from 'react';
import { motion } from 'motion/react';
import { LogOut, Layers, GraduationCap } from 'lucide-react';

interface CourseBannerProps {
  courseName: string;
  courseCode?: string;
  courseColor?: string;   // hex, e.g. "#10b981"
  thumbnail?: string;
  onLogout: () => void;
  onSwitchCourse?: () => void;
}

export const CourseBanner: React.FC<CourseBannerProps> = ({
  courseName,
  courseCode,
  courseColor = '#10b981',
  thumbnail,
  onLogout,
  onSwitchCourse,
}) => {
  // Derive a subtle tint from the course color for the gradient overlay
  const hex = courseColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height: '180px' }}
    >
      {/* Background: thumbnail or gradient mesh */}
      {thumbnail ? (
        <img
          src={thumbnail}
          alt={courseName}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'brightness(0.35) saturate(1.2)' }}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, rgba(${r},${g},${b},0.25) 0%, rgba(11,18,34,0.95) 60%)`,
          }}
        />
      )}

      {/* Dark overlay for text legibility */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0b1222]/90 via-[#0b1222]/70 to-[#0b1222]/40" />

      {/* Decorative glow orb */}
      <div
        className="absolute -left-10 top-1/2 -translate-y-1/2 w-56 h-56 rounded-full blur-3xl pointer-events-none"
        style={{ backgroundColor: `rgba(${r},${g},${b},0.15)` }}
      />

      {/* Content */}
      <div className="relative h-full flex items-center justify-between px-10">

        {/* Left — course identity */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-5"
        >
          {/* Icon badge */}
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border border-white/10 shadow-lg"
            style={{ backgroundColor: `rgba(${r},${g},${b},0.25)` }}
          >
            <GraduationCap size={26} style={{ color: courseColor }} />
          </div>

          <div>
            {courseCode && (
              <span
                className="inline-block px-3 py-0.5 rounded-full text-[9px] font-black tracking-[0.2em] uppercase border mb-2"
                style={{
                  color: courseColor,
                  borderColor: `rgba(${r},${g},${b},0.4)`,
                  backgroundColor: `rgba(${r},${g},${b},0.1)`,
                }}
              >
                {courseCode}
              </span>
            )}
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-tight">
              {courseName}
            </h1>
          </div>
        </motion.div>

        {/* Right — actions */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-3"
        >
          {onSwitchCourse && (
            <button
              onClick={onSwitchCourse}
              className="flex items-center gap-2 px-5 py-2.5 bg-white/8 border border-white/10 rounded-xl text-[11px] font-black uppercase tracking-widest text-slate-300 hover:bg-white/15 hover:text-white transition-all backdrop-blur-sm"
            >
              <Layers size={13} />
              Change Course
            </button>
          )}

          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-[11px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all backdrop-blur-sm"
          >
            <LogOut size={13} />
            Logout
          </button>
        </motion.div>
      </div>

      {/* Bottom accent line */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background: `linear-gradient(90deg, rgba(${r},${g},${b},0.6), transparent 60%)`,
        }}
      />
    </div>
  );
};
