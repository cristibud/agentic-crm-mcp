'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function LoginPage() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState('crm-secret-key-2024');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setError('API key is required');
      return;
    }
    setLoading(true);
    setError('');

    // Validate by calling the API
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/leads?limit=1`, {
        headers: { 'X-API-Key': apiKey.trim() },
      });
      if (!res.ok) {
        setError('Invalid API key. Please try again.');
        setLoading(false);
        return;
      }
    } catch {
      // API not reachable, still store the key for offline use
    }

    Cookies.set('crm_api_key', apiKey.trim(), { expires: 30 });
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">CRM MCP</h1>
          <p className="text-gray-500 mt-1 text-sm">Sign in with your API key</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="API Key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your API key"
            error={error}
            autoFocus
          />
          <Button type="submit" loading={loading} className="w-full" size="lg">
            Sign In
          </Button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Default key: <code className="bg-gray-100 px-1.5 py-0.5 rounded">crm-secret-key-2024</code>
        </p>
      </div>
    </div>
  );
}
