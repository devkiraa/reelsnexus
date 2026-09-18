'use client';

import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { PlaySquare, Sparkles, ShieldCheck, Zap, ArrowRight, Loader2 } from 'lucide-react';

export function LoginPage() {
  const { loginWithGoogle } = useAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleGoogleLogin = () => {
    setIsRedirecting(true);
    loginWithGoogle();
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center bg-gray-50 px-4 py-12 relative overflow-hidden">
      {/* Subtle Background Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-50 pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-100 rounded-full blur-3xl opacity-50 pointer-events-none" />

      <div className="max-w-md w-full relative z-10">
        {/* Brand Card */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-xl shadow-gray-200/50 p-8 sm:p-10 text-center">
          {/* Logo Badge */}
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-600/30">
            <PlaySquare className="w-8 h-8 text-white" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            Reel<span className="text-blue-600">Nexus</span>
          </h1>
          <p className="text-gray-500 text-sm mt-2">
            Autonomous Multi-Channel YouTube Shorts Studio
          </p>

          <div className="my-8 h-px bg-gray-100 w-full" />

          {/* Login Action */}
          <div className="space-y-4">
            <button
              onClick={handleGoogleLogin}
              disabled={isRedirecting}
              className="w-full py-3.5 px-4 bg-white border border-gray-300 hover:border-gray-400 hover:bg-gray-50/80 text-gray-800 font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-3 shadow-sm hover:shadow active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed group"
            >
              {isRedirecting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  <span className="text-sm">Connecting to Google...</span>
                </>
              ) : (
                <>
                  {/* Google SVG Logo */}
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span className="text-sm font-bold text-gray-700 group-hover:text-gray-900">
                    Continue with Google
                  </span>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-transform group-hover:translate-x-0.5 ml-auto" />
                </>
              )}
            </button>

            <p className="text-xs text-gray-400 text-center">
              Passwordless authentication. Instant 1-click access.
            </p>
          </div>

          {/* Highlights */}
          <div className="mt-8 pt-6 border-t border-gray-100 grid grid-cols-3 gap-2 text-left">
            <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
              <Sparkles className="w-4 h-4 text-blue-600 mb-1" />
              <p className="text-[11px] font-bold text-gray-800">AI Metadata</p>
              <p className="text-[10px] text-gray-400">Viral SEO hooks</p>
            </div>
            <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
              <Zap className="w-4 h-4 text-amber-500 mb-1" />
              <p className="text-[11px] font-bold text-gray-800">Peak Slots</p>
              <p className="text-[10px] text-gray-400">Smart timing</p>
            </div>
            <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
              <ShieldCheck className="w-4 h-4 text-emerald-500 mb-1" />
              <p className="text-[11px] font-bold text-gray-800">Protected</p>
              <p className="text-[10px] text-gray-400">Quota safety</p>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-gray-400 mt-6">
          &copy; {new Date().getFullYear()} ReelNexus. All rights reserved.
        </p>
      </div>
    </div>
  );
}
