'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { getSettings, updateSettings, AVAILABLE_MODELS, type Settings } from '@/lib/api';

export default function SettingsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    llmModel: 'gpt-4-turbo',
    llmBaseUrl: 'https://api.openai.com/v1',
    llmApiKey: '',
  });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);
        const data = await getSettings();
        setSettings((prev) => ({
          ...prev,
          llmModel: data.llmModel,
          llmBaseUrl: data.llmBaseUrl,
          // Don't expose the full API key
          llmApiKey: '',
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load settings');
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleInputChange = (field: keyof Settings, value: string) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
    setError(null);
    setSuccess(false);
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    handleInputChange('llmModel', e.target.value);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!settings.llmModel) {
      setError('Please select a model');
      return;
    }

    if (!settings.llmBaseUrl) {
      setError('Base URL is required');
      return;
    }

    try {
      setIsSaving(true);
      const updateData: Partial<Settings> = {
        llmModel: settings.llmModel,
        llmBaseUrl: settings.llmBaseUrl,
      };

      // Only include API key in update if it was changed (non-empty)
      if (settings.llmApiKey && settings.llmApiKey.trim()) {
        updateData.llmApiKey = settings.llmApiKey;
      }

      await updateSettings(updateData);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);

      // Clear the API key input after successful save
      setSettings((prev) => ({
        ...prev,
        llmApiKey: '',
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="mt-2 text-gray-600">Configure LLM settings for the MCP server</p>
        </div>

        <Card className="p-6 md:p-8">
          <form onSubmit={handleSave} className="space-y-6">
            {/* Model Selection */}
            <div>
              <label htmlFor="model" className="block text-sm font-medium text-gray-900">
                LLM Model <span className="text-red-500">*</span>
              </label>
              <select
                id="model"
                value={settings.llmModel}
                onChange={handleSelectChange}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {AVAILABLE_MODELS.map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-sm text-gray-600">Select the OpenAI model to use for LLM operations</p>
            </div>

            {/* Base URL */}
            <div>
              <label htmlFor="baseUrl" className="block text-sm font-medium text-gray-900">
                API Base URL <span className="text-red-500">*</span>
              </label>
              <Input
                id="baseUrl"
                type="url"
                value={settings.llmBaseUrl}
                onChange={(e) => handleInputChange('llmBaseUrl', e.target.value)}
                placeholder="https://api.openai.com/v1"
                required
                className="mt-1"
              />
              <p className="mt-2 text-sm text-gray-600">The base URL for OpenAI API or compatible services</p>
            </div>

            {/* API Key */}
            <div>
              <label htmlFor="apiKey" className="block text-sm font-medium text-gray-900">
                OpenAI API Key
              </label>
              <Input
                id="apiKey"
                type="password"
                value={settings.llmApiKey}
                onChange={(e) => handleInputChange('llmApiKey', e.target.value)}
                placeholder="sk-..."
                className="mt-1"
              />
              <p className="mt-2 text-sm text-gray-600">
                Leave empty to keep the current API key. Enter a new key only to update it.
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="rounded-md bg-green-50 p-4">
                <p className="text-sm text-green-700">✓ Settings saved successfully</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg transition disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : 'Save Settings'}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-900 font-medium py-2 px-4 rounded-lg transition"
              >
                Back
              </button>
            </div>

            {/* Info Section */}
            <div className="mt-8 border-t pt-6">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Information</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-gray-700 space-y-2">
                <p>
                  <strong>Model:</strong> Determines which LLM model is used for processing messages through the MCP server.
                </p>
                <p>
                  <strong>API Base URL:</strong> The endpoint for API requests. Use the default for OpenAI, or customize for
                  compatible services.
                </p>
                <p>
                  <strong>API Key:</strong> Your authentication token for the API. Changes here won't be displayed for security
                  reasons.
                </p>
              </div>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
