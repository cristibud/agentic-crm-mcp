'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { FloatingChatWidget } from '@/components/ai-chat/FloatingChatWidget';

const NO_SHELL_PATHS = ['/login'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (NO_SHELL_PATHS.includes(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((v) => !v)} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header onMenuToggle={() => setSidebarCollapsed((v) => !v)} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      <FloatingChatWidget />
    </div>
  );
}
