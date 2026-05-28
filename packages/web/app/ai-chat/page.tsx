import { ChatPanel } from '@/components/ai-chat/ChatPanel';

export default function AiChatPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <p className="text-sm text-gray-500 mb-4">
        Chat with your CRM data using natural language commands.
      </p>
      <ChatPanel />
    </div>
  );
}
