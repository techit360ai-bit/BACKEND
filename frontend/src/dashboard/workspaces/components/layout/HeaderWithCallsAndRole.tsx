import { useState } from 'react';
import { Bell, Settings, Video, Phone, ChevronDown } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '../ui/dropdown-menu';
import { VideoCall } from '../calls/VideoCall';
import { AudioCall } from '../calls/AudioCall';
import { useNavigate } from 'react-router-dom';

export function HeaderWithCallsAndRole() {
  const navigate = useNavigate();
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [showAudioCall, setShowAudioCall] = useState(false);
  const [isVideoPIP, setIsVideoPIP] = useState(false);
  const [currentRole, setCurrentRole] = useState<'developer' | 'designer' | 'manager' | 'admin'>('developer');

  const teamMembers = [
    { name: 'Sarah Chen', avatar: 'SC', color: 'bg-blue-500' },
    { name: 'Mike Johnson', avatar: 'MJ', color: 'bg-green-500' },
    { name: 'Alex Kim', avatar: 'AK', color: 'bg-purple-500' },
    { name: 'Emma Wilson', avatar: 'EW', color: 'bg-pink-500' },
  ];

  const roles = [
    { id: 'developer' as const, name: 'Software Developer', icon: '💻' },
    { id: 'designer' as const, name: 'UI/UX Designer', icon: '🎨' },
    { id: 'manager' as const, name: 'Project Manager', icon: '📊' },
    { id: 'admin' as const, name: 'Administrator', icon: '⚙️' },
  ];

  const handleRoleChange = (role: typeof currentRole) => {
    setCurrentRole(role);
  };

  return (
    <>
      <header className="h-[60px] border-b border-gray-200 bg-white flex items-center justify-between px-6">
        {/* Left: Project name and stage */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              TechIT Platform
            </h1>
            <Badge className="bg-[#10B981] text-white hover:bg-[#10B981]/90">
              Active Development
            </Badge>
          </div>
        </div>

        {/* Center: Project Switcher */}
        <div className="flex-1 max-w-xs mx-8">
          <DropdownMenu>
            <DropdownMenuTrigger className="w-full">
              <div className="flex items-center justify-between px-4 py-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200">
                <span className="text-sm font-medium">Current Workspace</span>
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[280px]">
              <DropdownMenuItem>TechIT Platform (Current)</DropdownMenuItem>
              <DropdownMenuItem>Mobile App Redesign</DropdownMenuItem>
              <DropdownMenuItem>API Integration Hub</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>+ Create New Project</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Right: Team avatars and actions */}
        <div className="flex items-center gap-4">
          {/* Team Avatars */}
          <div className="flex -space-x-2">
            {teamMembers.map((member, idx) => (
              <Avatar
                key={idx}
                className="w-8 h-8 border-2 border-white hover:z-10 transition-all hover:scale-110 cursor-pointer"
              >
                <AvatarFallback className={`${member.color} text-white text-xs`}>
                  {member.avatar}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>

          <div className="h-6 w-px bg-gray-200" />

          {/* Action Icons */}
          <button
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            onClick={() => {
              setShowVideoCall(true);
              setIsVideoPIP(false);
            }}
          >
            <Video className="w-5 h-5 text-gray-600" />
          </button>
          <button
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            onClick={() => setShowAudioCall(true)}
          >
            <Phone className="w-5 h-5 text-gray-600" />
          </button>
          <button
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors relative"
            onClick={() => navigate('/workspaces/notifications')}
          >
            <Bell className="w-5 h-5 text-gray-600" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-[#F59E0B] rounded-full" />
          </button>
          <button
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            onClick={() => navigate('/workspaces/settings')}
          >
            <Settings className="w-5 h-5 text-gray-600" />
          </button>

          <div className="h-6 w-px bg-gray-200" />

          {/* User Profile with Role */}
          <DropdownMenu>
            <DropdownMenuTrigger>
              <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded-lg px-2 py-1 transition-colors">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-[#2196F3] text-white">
                    JD
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>John Doe</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-gray-500 font-normal">
                Switch Role
              </DropdownMenuLabel>
              {roles.map(role => (
                <DropdownMenuItem
                  key={role.id}
                  onClick={() => handleRoleChange(role.id)}
                  className={currentRole === role.id ? 'bg-[#2196F3]/10 text-[#2196F3]' : ''}
                >
                  <span className="mr-2">{role.icon}</span>
                  {role.name}
                  {currentRole === role.id && (
                    <Badge className="ml-auto bg-[#2196F3] text-white text-xs">Active</Badge>
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/workspaces/settings')}>Settings</DropdownMenuItem>
              <DropdownMenuItem>Sign Out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Video Call Component */}
      {showVideoCall && (
        <VideoCall
          onClose={() => setShowVideoCall(false)}
          isPIP={isVideoPIP}
          onTogglePIP={() => setIsVideoPIP(!isVideoPIP)}
        />
      )}

      {/* Audio Call Component */}
      {showAudioCall && <AudioCall onClose={() => setShowAudioCall(false)} />}
    </>
  );
}
