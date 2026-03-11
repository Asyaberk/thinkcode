import React from 'react';
import { motion } from 'motion/react';
import { Award, Lock, Trophy, Star, Zap, Code, Flame, BookOpen } from 'lucide-react';
import { cn } from '../lib/utils';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  isUnlocked: boolean;
  unlockedAt?: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

const Brain = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.54Z"/>
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.54Z"/>
  </svg>
);

const achievements: Achievement[] = [
  {
    id: 'first-problem',
    title: 'First Problem Solved',
    description: 'You took your first step into the world of C++.',
    icon: <Zap size={32} />,
    isUnlocked: true,
    unlockedAt: '2024-03-01',
    rarity: 'common'
  },
  {
    id: '10-problems',
    title: '10 Problems Solved',
    description: 'A solid foundation is being built.',
    icon: <Star size={32} />,
    isUnlocked: true,
    unlockedAt: '2024-03-05',
    rarity: 'common'
  },
  {
    id: '50-problems',
    title: '50 Problems Solved',
    description: 'You are becoming a true problem solver.',
    icon: <Trophy size={32} />,
    isUnlocked: false,
    rarity: 'rare'
  },
  {
    id: 'no-hint',
    title: 'No Hint Used',
    description: 'Solved a complex problem without any assistance.',
    icon: <Brain size={32} />,
    isUnlocked: true,
    unlockedAt: '2024-03-08',
    rarity: 'epic'
  },
  {
    id: '7-day-streak',
    title: '7 Day Learning Streak',
    description: 'Consistency is the key to mastery.',
    icon: <Flame size={32} />,
    isUnlocked: false,
    rarity: 'rare'
  },
  {
    id: 'pointer-master',
    title: 'Pointer Master',
    description: 'Successfully completed all pointer-related challenges.',
    icon: <Code size={32} />,
    isUnlocked: false,
    rarity: 'legendary'
  }
];

const rarityStyles = {
  common: 'from-slate-500/20 to-slate-600/20 border-slate-500/30 text-slate-400',
  rare: 'from-blue-500/20 to-indigo-600/20 border-blue-500/30 text-blue-400',
  epic: 'from-purple-500/20 to-pink-600/20 border-purple-500/30 text-purple-400',
  legendary: 'from-amber-500/20 to-orange-600/20 border-amber-500/30 text-amber-400'
};

const rarityIconStyles = {
  common: 'bg-slate-500/10 text-slate-400',
  rare: 'bg-blue-500/10 text-blue-400',
  epic: 'bg-purple-500/10 text-purple-400',
  legendary: 'bg-amber-500/10 text-amber-400'
};

export const Achievements: React.FC = () => {
  return (
    <div className="p-8 bg-[#0f172a] min-h-screen text-white">
      <div className="max-w-7xl mx-auto">
        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-3">Achievements</h1>
            <p className="text-slate-400 text-lg">Your journey of mastery, one milestone at a time.</p>
          </div>
          <div className="flex items-center gap-6 bg-slate-900/50 border border-slate-800 rounded-2xl p-4 px-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-500">3/6</div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Unlocked</div>
            </div>
            <div className="w-px h-10 bg-slate-800" />
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-500">1250</div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total XP</div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {achievements.map((achievement, index) => (
            <motion.div
              key={achievement.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                "relative group overflow-hidden rounded-3xl border p-8 transition-all duration-500",
                achievement.isUnlocked 
                  ? cn("bg-gradient-to-br shadow-2xl", rarityStyles[achievement.rarity])
                  : "bg-slate-900/40 border-slate-800/50 grayscale opacity-60"
              )}
            >
              {/* Glow Effect */}
              {achievement.isUnlocked && (
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-white/5 blur-[100px] rounded-full group-hover:bg-white/10 transition-colors" />
              )}

              <div className="relative z-10">
                <div className="flex items-start justify-between mb-6">
                  <motion.div 
                    animate={achievement.isUnlocked ? { 
                      y: [0, -5, 0],
                      rotate: [0, 5, -5, 0]
                    } : {}}
                    transition={{ 
                      duration: 4, 
                      repeat: Infinity, 
                      ease: "easeInOut" 
                    }}
                    className={cn(
                      "p-4 rounded-2xl shadow-inner",
                      achievement.isUnlocked ? rarityIconStyles[achievement.rarity] : "bg-slate-800 text-slate-600"
                    )}
                  >
                    {achievement.isUnlocked ? achievement.icon : <Lock size={32} />}
                  </motion.div>
                  
                  {achievement.isUnlocked && (
                    <div className={cn(
                      "text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full border",
                      rarityStyles[achievement.rarity]
                    )}>
                      {achievement.rarity}
                    </div>
                  )}
                </div>

                <h3 className={cn(
                  "text-xl font-bold mb-2",
                  achievement.isUnlocked ? "text-white" : "text-slate-500"
                )}>
                  {achievement.title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  {achievement.description}
                </p>

                {achievement.isUnlocked ? (
                  <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
                    <Award size={14} className="text-emerald-500" />
                    Unlocked on {new Date(achievement.unlockedAt!).toLocaleDateString()}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-[11px] font-medium text-slate-600 italic">
                    <Lock size={14} />
                    Locked
                  </div>
                )}
              </div>

              {/* Progress Bar for locked ones (optional) */}
              {!achievement.isUnlocked && (
                <div className="mt-6">
                  <div className="flex justify-between text-[10px] font-bold text-slate-600 uppercase mb-2">
                    <span>Progress</span>
                    <span>40%</span>
                  </div>
                  <div className="w-full bg-slate-800/50 rounded-full h-1 overflow-hidden">
                    <div className="bg-slate-700 h-full w-[40%]" />
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};
