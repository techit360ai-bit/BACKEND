import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Send, Sparkles, Clock, CheckCircle2, User } from 'lucide-react';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { ScrollArea } from '../ui/scroll-area';

export function RightPanel() {
  const location = useLocation();
  const [message, setMessage] = useState('');

  // Show AI Copilot for AI Agents page
  if (location.pathname === '/workspaces/ai-agents') {
    return (
      <div className="w-[320px] bg-white border-l border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-[#2196F3] to-purple-500 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">AI Copilot</h3>
              <p className="text-xs text-gray-500">Always here to help</p>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm text-gray-700">
                Hi! I'm your AI assistant. I can help you configure agents, answer questions, or suggest the best tools for your workflow.
              </p>
            </div>
            <div className="bg-[#2196F3]/10 p-3 rounded-lg ml-8">
              <p className="text-sm">
                What's the difference between Basic and Premium agents?
              </p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm text-gray-700">
                Premium agents offer advanced capabilities like multi-step reasoning, custom training, and priority processing. They're perfect for complex tasks!
              </p>
            </div>
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-gray-200">
          <div className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ask me anything..."
              className="flex-1 px-3 py-2 bg-gray-50 rounded-lg text-sm border border-gray-200 focus:border-[#2196F3] focus:ring-1 focus:ring-[#2196F3] outline-none"
            />
            <button className="p-2 bg-[#2196F3] text-white rounded-lg hover:bg-[#2196F3]/90 transition-colors">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show Activity Feed for Build page
  if (
    location.pathname === '/workspaces/build' ||
    location.pathname === '/workspaces' ||
    location.pathname === '/workspaces/'
  ) {
    const activities = [
      { user: 'Sarah Chen', action: 'moved task to Review', task: 'Homepage redesign', time: '2 min ago', avatar: 'SC', color: 'bg-blue-500' },
      { user: 'Mike Johnson', action: 'completed', task: 'API integration', time: '15 min ago', avatar: 'MJ', color: 'bg-green-500' },
      { user: 'Alex Kim', action: 'commented on', task: 'Database schema', time: '1 hour ago', avatar: 'AK', color: 'bg-purple-500' },
      { user: 'Emma Wilson', action: 'started working on', task: 'Mobile responsive', time: '2 hours ago', avatar: 'EW', color: 'bg-pink-500' },
    ];

    return (
      <div className="w-[320px] bg-white border-l border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold">Team Activity</h3>
          <p className="text-xs text-gray-500 mt-1">Real-time updates</p>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {activities.map((activity, idx) => (
              <div key={idx} className="flex gap-3 group hover:bg-gray-50 p-2 rounded-lg -mx-2 transition-colors">
                <Avatar className="w-8 h-8 flex-shrink-0">
                  <AvatarFallback className={`${activity.color} text-white text-xs`}>
                    {activity.avatar}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{activity.user}</span>
                    {' '}
                    <span className="text-gray-600">{activity.action}</span>
                  </p>
                  <p className="text-sm text-[#2196F3] truncate">{activity.task}</p>
                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    {activity.time}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-gray-200">
          <div className="bg-gradient-to-r from-[#2196F3]/10 to-purple-500/10 p-3 rounded-lg border border-[#2196F3]/20">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
              <span className="text-sm font-medium">Sprint Progress</span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">12 of 18 tasks</span>
                <span className="font-medium">67%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-[#10B981] rounded-full" style={{ width: '67%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default: No right panel
  return null;
}
