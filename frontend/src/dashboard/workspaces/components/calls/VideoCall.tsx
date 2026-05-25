import { useState } from 'react';
import { Video, VideoOff, Mic, MicOff, MonitorUp, Users, MoreVertical, X, Minimize2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback } from '../ui/avatar';

interface VideoCallProps {
  onClose: () => void;
  participants?: Array<{ name: string; avatar: string; isMuted?: boolean; isVideoOff?: boolean }>;
  isPIP?: boolean;
  onTogglePIP?: () => void;
}

export function VideoCall({ onClose, participants, isPIP = false, onTogglePIP }: VideoCallProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const defaultParticipants = participants || [
    { name: 'Sarah Chen', avatar: 'SC', isMuted: false, isVideoOff: false },
    { name: 'Mike Johnson', avatar: 'MJ', isMuted: true, isVideoOff: false },
    { name: 'Alex Kim', avatar: 'AK', isMuted: false, isVideoOff: false },
  ];

  if (isPIP) {
    return (
      <div className="fixed bottom-6 right-6 w-80 bg-[#0A1929] rounded-lg shadow-2xl overflow-hidden border-2 border-[#2196F3] z-50">
        <div className="relative">
          <div className="aspect-video bg-gray-900 flex items-center justify-center">
            <Avatar className="w-16 h-16">
              <AvatarFallback className="bg-[#2196F3] text-white text-xl">SC</AvatarFallback>
            </Avatar>
          </div>
          <div className="absolute top-3 right-3 flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="w-8 h-8 p-0 bg-black/50 hover:bg-black/70"
              onClick={onTogglePIP}
            >
              <Minimize2 className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="w-8 h-8 p-0 bg-black/50 hover:bg-black/70"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="absolute bottom-3 left-3 right-3 flex justify-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              className={`w-10 h-10 p-0 rounded-full ${isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-white/20 hover:bg-white/30'}`}
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className={`w-10 h-10 p-0 rounded-full ${isVideoOff ? 'bg-red-500 hover:bg-red-600' : 'bg-white/20 hover:bg-white/30'}`}
              onClick={() => setIsVideoOff(!isVideoOff)}
            >
              {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#0A1929] z-50 flex flex-col">
      {/* Header */}
      <div className="h-16 border-b border-gray-700 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#2196F3]/10 rounded-lg">
            <Video className="w-5 h-5 text-[#2196F3]" />
          </div>
          <div>
            <h2 className="text-white font-semibold">Sprint Planning Meeting</h2>
            <p className="text-sm text-gray-400">{defaultParticipants.length} participants</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onTogglePIP && (
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10"
              onClick={onTogglePIP}
            >
              <Minimize2 className="w-4 h-4 mr-2" />
              Minimize
            </Button>
          )}
          <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Main Video Area */}
      <div className="flex-1 grid grid-cols-2 gap-4 p-6">
        {defaultParticipants.map((participant, idx) => (
          <div
            key={idx}
            className="bg-gray-900 rounded-lg relative overflow-hidden flex items-center justify-center"
          >
            {participant.isVideoOff ? (
              <Avatar className="w-24 h-24">
                <AvatarFallback className="bg-[#2196F3] text-white text-2xl">
                  {participant.avatar}
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center">
                <Avatar className="w-24 h-24">
                  <AvatarFallback className="bg-[#2196F3] text-white text-2xl">
                    {participant.avatar}
                  </AvatarFallback>
                </Avatar>
              </div>
            )}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
              <div className="flex items-center gap-2 bg-black/50 px-3 py-1 rounded-full">
                <span className="text-white text-sm font-medium">{participant.name}</span>
                {participant.isMuted && <MicOff className="w-4 h-4 text-red-400" />}
              </div>
              <Button variant="ghost" size="sm" className="w-8 h-8 p-0 bg-black/50 hover:bg-black/70">
                <MoreVertical className="w-4 h-4 text-white" />
              </Button>
            </div>
          </div>
        ))}
        {/* Your video (larger) */}
        <div className="col-span-2 bg-gray-900 rounded-lg relative overflow-hidden flex items-center justify-center">
          {isVideoOff ? (
            <Avatar className="w-32 h-32">
              <AvatarFallback className="bg-[#2196F3] text-white text-4xl">JD</AvatarFallback>
            </Avatar>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-cyan-900 to-blue-900 flex items-center justify-center">
              <Avatar className="w-32 h-32">
                <AvatarFallback className="bg-[#2196F3] text-white text-4xl">JD</AvatarFallback>
              </Avatar>
            </div>
          )}
          <div className="absolute bottom-4 left-4">
            <div className="flex items-center gap-2 bg-black/50 px-3 py-1 rounded-full">
              <span className="text-white font-medium">You</span>
              {isMuted && <MicOff className="w-4 h-4 text-red-400" />}
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="h-20 border-t border-gray-700 flex items-center justify-center gap-4 px-6">
        <Button
          size="lg"
          className={`rounded-full w-14 h-14 ${isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-white/10 hover:bg-white/20'}`}
          onClick={() => setIsMuted(!isMuted)}
        >
          {isMuted ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
        </Button>
        <Button
          size="lg"
          className={`rounded-full w-14 h-14 ${isVideoOff ? 'bg-red-500 hover:bg-red-600' : 'bg-white/10 hover:bg-white/20'}`}
          onClick={() => setIsVideoOff(!isVideoOff)}
        >
          {isVideoOff ? <VideoOff className="w-6 h-6 text-white" /> : <Video className="w-6 h-6 text-white" />}
        </Button>
        <Button
          size="lg"
          className={`rounded-full w-14 h-14 ${isScreenSharing ? 'bg-[#2196F3] hover:bg-[#1976D2]' : 'bg-white/10 hover:bg-white/20'}`}
          onClick={() => setIsScreenSharing(!isScreenSharing)}
        >
          <MonitorUp className="w-6 h-6 text-white" />
        </Button>
        <Button
          size="lg"
          className="rounded-full w-14 h-14 bg-white/10 hover:bg-white/20"
        >
          <Users className="w-6 h-6 text-white" />
        </Button>
        <div className="w-px h-8 bg-gray-700" />
        <Button
          size="lg"
          className="rounded-full w-14 h-14 bg-red-500 hover:bg-red-600"
          onClick={onClose}
        >
          <X className="w-6 h-6 text-white" />
        </Button>
      </div>
    </div>
  );
}
