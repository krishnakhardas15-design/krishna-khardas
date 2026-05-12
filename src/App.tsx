/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { UserProfile } from './types';
import Auth from './components/Auth';
import Navbar from './components/Navbar';
import DonorDashboard from './components/DonorDashboard';
import ReceiverFeed from './components/ReceiverFeed';
import { Loader2, Waves } from 'lucide-react';
import { Toaster } from 'sonner';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          setUser({ id: firebaseUser.uid, ...userDoc.data() } as UserProfile);
        } else {
          // User is logged in but profile doesn't exist yet (handled in Auth component)
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#eef2f3] relative overflow-hidden">
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-emerald-100 via-white to-blue-100"></div>
        <div className="absolute top-[-100px] left-[-100px] w-96 h-96 bg-emerald-300/30 rounded-full blur-[100px] animate-pulse"></div>
        <div className="relative z-10">
          <div className="w-16 h-16 border-4 border-white/40 border-t-emerald-600 rounded-full animate-spin backdrop-blur-sm" />
        </div>
        <p className="relative z-10 mt-6 text-emerald-900 font-bold tracking-widest uppercase text-xs animate-pulse">
          AnnSeva
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#eef2f3] relative overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-emerald-100 via-white to-blue-100"></div>
        <div className="absolute top-[-100px] left-[-100px] w-96 h-96 bg-emerald-300/30 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-50px] right-[100px] w-80 h-80 bg-blue-200/30 rounded-full blur-[100px]"></div>
        <div className="relative z-10 w-full px-4">
          <Auth onSuccess={(profile) => setUser(profile)} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#eef2f3] relative overflow-x-hidden">
      <div className="fixed inset-0 z-0 bg-gradient-to-br from-emerald-50 via-white to-blue-50"></div>
      <div className="fixed top-[-100px] left-[-100px] w-96 h-96 bg-emerald-200/20 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="fixed bottom-[-50px] right-[100px] w-80 h-80 bg-blue-100/20 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar user={user} />
        <Toaster position="top-right" richColors closeButton />
        
        <main className="max-w-4xl mx-auto px-4 py-8 pb-24 w-full">
          {/* Decorative Header (Dynamic per role) */}
          <div className="mb-12 text-center relative pt-4">
            <h1 className="text-4xl sm:text-5xl font-black text-slate-800 tracking-tight mb-3 drop-shadow-sm">
              {user.role === 'Donor' ? 'Share your surplus.' : 'Feed your community.'}
            </h1>
            <p className="text-slate-500 font-medium max-w-md mx-auto text-lg leading-relaxed">
              {user.role === 'Donor' 
                ? "Every portion donated is a meal saved from waste. Thank you for your generosity."
                : "Connecting surplus food with those who need it most. Together we bridge the gap."}
            </p>
          </div>

          <div className="backdrop-blur-sm">
            {user.role === 'Donor' ? (
              <DonorDashboard user={user} />
            ) : (
              <ReceiverFeed user={user} />
            )}
          </div>
        </main>
      </div>

      {/* Mobile Footer Status */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 sm:hidden">
        <div className="bg-white/60 backdrop-blur-md border border-white/40 px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Live updates active
          </span>
        </div>
      </div>
    </div>
  );
}
