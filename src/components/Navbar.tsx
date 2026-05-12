import React from 'react';
import { LogOut, User, Utensils, Heart } from 'lucide-react';
import { auth } from '../lib/firebase';
import { UserProfile } from '../types';

interface NavbarProps {
  user: UserProfile;
}

export default function Navbar({ user }: NavbarProps) {
  const handleLogout = () => auth.signOut();

  return (
    <nav className="h-20 px-8 flex items-center justify-between backdrop-blur-md bg-white/40 border-b border-white/40 sticky top-0 z-50">
      <div className="max-w-4xl mx-auto w-full flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-600/20">
            <Utensils className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-emerald-900 drop-shadow-sm">AnnSeva</span>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-sm font-bold text-gray-900">{user.full_name}</span>
            <span className="text-[10px] uppercase tracking-widest text-emerald-600 font-bold">{user.role}</span>
          </div>
          
          <div className="flex items-center gap-2 bg-white/50 backdrop-blur-md p-1 rounded-full border border-white/50 shadow-sm">
            <div className="w-9 h-9 rounded-full border-2 border-emerald-600 p-0.5 bg-white shadow-sm overflow-hidden">
              <img 
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.full_name}`} 
                className="w-full h-full rounded-full" 
                alt="User" 
              />
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 hover:bg-white/40 rounded-full transition-all group"
              title="Logout"
            >
              <LogOut className="w-4 h-4 text-slate-400 group-hover:text-red-500 transition-colors" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
