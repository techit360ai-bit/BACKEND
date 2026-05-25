import { Bell, Settings, Video, Phone, ChevronDown } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

export function Header() {
  const teamMembers = [
    { name: 'Sarah Chen', avatar: 'SC', color: 'bg-blue-500' },
    { name: 'Mike Johnson', avatar: 'MJ', color: 'bg-green-500' },
    { name: 'Alex Kim', avatar: 'AK', color: 'bg-purple-500' },
    { name: 'Emma Wilson', avatar: 'EW', color: 'bg-pink-500' },
  ];

  return (
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
        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <Video className="w-5 h-5 text-gray-600" />
        </button>
        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <Phone className="w-5 h-5 text-gray-600" />
        </button>
        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors relative">
          <Bell className="w-5 h-5 text-gray-600" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-[#F59E0B] rounded-full" />
        </button>
        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <Settings className="w-5 h-5 text-gray-600" />
        </button>

        <div className="h-6 w-px bg-gray-200" />

        {/* User Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Avatar className="w-8 h-8 cursor-pointer hover:ring-2 ring-[#2196F3] transition-all">
              <AvatarFallback className="bg-[#2196F3] text-white">
                JD
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuItem>Sign Out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
