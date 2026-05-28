import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'sonner';
import { AppShell } from '@/components/layout/AppShell';

export const metadata: Metadata = {
  title: 'CRM MCP',
  description: 'CRM application with MCP Server',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased" suppressHydrationWarning>
        <AppShell>{children}</AppShell>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
