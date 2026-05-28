'use client';

import { usePathname } from 'next/navigation';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/leads': 'Leads',
  '/pipeline': 'Pipeline',
  '/contracts': 'Contracts',
  '/ai-chat': 'AI Chat',
  '/settings': 'Settings',
};

interface HeaderProps {
  onMenuToggle: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const pathname = usePathname();
  const title = Object.entries(pageTitles).find(([key]) => pathname.startsWith(key))?.[1] ?? 'CRM';

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6 gap-4">
      <button
        onClick={onMenuToggle}
        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 md:hidden"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <h1 className="text-xl font-semibold text-gray-800">{title}</h1>
    </header>
  );
}
