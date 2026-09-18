'use client';

import React from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './AuthContext';
import { ProjectProvider } from './ProjectContext';
import { LoginPage } from './components/LoginPage';
import { DashboardLayout } from './LayoutClient';
import { Loader2 } from 'lucide-react';

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col justify-center items-center bg-gray-50">
        <Loader2 className="w-9 h-9 animate-spin text-blue-600 mb-3" />
        <p className="text-sm font-semibold text-gray-500 tracking-wide">Loading ReelNexus...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <ProjectProvider>
      <DashboardLayout>
        {children}
      </DashboardLayout>
    </ProjectProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardShell>
        {children}
      </DashboardShell>
      <Toaster position="bottom-right" />
    </AuthProvider>
  );
}
