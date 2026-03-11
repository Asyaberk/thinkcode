import React, { useState } from 'react';
import { LogIn, UserPlus, Bot, Terminal } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

import { UserRole } from '../types';

interface LoginPageProps {
  onLogin: (role: UserRole) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>('Student');

  return (
    <div className="min-h-screen bg-[#0f172a] flex overflow-hidden">
      {/* Left Side: Form */}
      <div className="w-full lg:w-[45%] flex flex-col justify-center px-8 sm:px-16 lg:px-24 py-12 z-10 bg-[#0f172a]">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="max-w-md w-full mx-auto"
        >
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-slate-950 text-xl font-bold shadow-lg shadow-emerald-500/20">
              T
            </div>
            <span className="text-xl font-bold tracking-tight text-white">ThinkCode</span>
          </div>

          <div className="mb-10">
            <h1 className="text-4xl font-bold text-white tracking-tight mb-3">
              {isRegister ? 'Create an account' : 'Welcome back'}
            </h1>
            <p className="text-slate-400 font-medium">
              {isRegister 
                ? 'Join thousands of students learning C++ today.' 
                : 'Sign in to continue your learning journey.'}
            </p>
          </div>

          <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); onLogin(selectedRole); }}>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Email Address</label>
              <input
                type="email"
                placeholder="name@example.com"
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4 text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-slate-800 outline-none transition-all placeholder:text-slate-600 text-slate-200"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4 text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-slate-800 outline-none transition-all placeholder:text-slate-600 text-slate-200"
                required
              />
            </div>
            
            {!isRegister && (
              <div className="flex justify-end">
                <button type="button" className="text-xs font-bold text-slate-500 hover:text-white transition-colors">
                  Forgot password?
                </button>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Role</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedRole('Student')}
                  className={cn(
                    "py-3 rounded-xl text-xs font-bold border transition-all",
                    selectedRole === 'Student' 
                      ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" 
                      : "bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700"
                  )}
                >
                  Student
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRole('Instructor')}
                  className={cn(
                    "py-3 rounded-xl text-xs font-bold border transition-all",
                    selectedRole === 'Instructor' 
                      ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" 
                      : "bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700"
                  )}
                >
                  Instructor
                </button>
              </div>
            </div>

            <button
              type="submit"
              onClick={() => onLogin(selectedRole)}
              className="w-full bg-emerald-500 text-slate-950 py-4 rounded-2xl font-bold hover:bg-emerald-400 transition-all shadow-xl shadow-emerald-500/20 active:scale-[0.98] flex items-center justify-center gap-3"
            >
              {isRegister ? <UserPlus size={18} /> : <LogIn size={18} />}
              {isRegister ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div className="mt-10 text-center">
            <p className="text-sm text-slate-500 font-medium">
              {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                onClick={() => setIsRegister(!isRegister)}
                className="font-bold text-emerald-400 hover:text-emerald-300 hover:underline underline-offset-4"
              >
                {isRegister ? 'Sign in' : 'Register now'}
              </button>
            </p>
          </div>
        </motion.div>
      </div>

      {/* Right Side: Visual/Branding */}
      <div className="hidden lg:flex flex-1 bg-[#0d1117] relative items-center justify-center overflow-hidden">
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 max-w-lg text-center"
        >
          <div className="mb-8 inline-flex items-center gap-2 px-4 py-2 bg-slate-900 rounded-full shadow-sm border border-slate-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Platform Status: Online</span>
          </div>
          <h2 className="text-5xl font-bold text-white tracking-tight leading-tight mb-6">
            Master C++ with <span className="text-emerald-500 italic font-serif">precision</span> and <span className="text-slate-400">clarity</span>.
          </h2>
          <p className="text-slate-400 text-lg font-medium leading-relaxed mb-10">
            Our Socratic AI tutor guides you through complex concepts without giving away the answers.
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-800 text-left">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 mb-4">
                <Bot size={20} />
              </div>
              <h3 className="font-bold text-white mb-1">AI Guided</h3>
              <p className="text-xs text-slate-500 font-medium">Personalized hints for every problem.</p>
            </div>
            <div className="bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-800 text-left">
              <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 mb-4">
                <Terminal size={20} />
              </div>
              <h3 className="font-bold text-white mb-1">Interactive</h3>
              <p className="text-xs text-slate-500 font-medium">Real-time terminal and code execution.</p>
            </div>
          </div>
        </motion.div>

        {/* Decorative elements */}
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-emerald-500 rounded-full blur-[120px] opacity-10" />
        <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-emerald-500 rounded-full blur-[120px] opacity-10" />
      </div>
    </div>
  );
};
