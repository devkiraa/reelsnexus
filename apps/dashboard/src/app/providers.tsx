'use client';

import { Toaster } from 'react-hot-toast';
import { ProjectProvider } from './ProjectContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ProjectProvider>
      {children}
      <Toaster position="bottom-right" />
    </ProjectProvider>
  );
}
