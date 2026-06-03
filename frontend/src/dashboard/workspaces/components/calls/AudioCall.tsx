import { useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, MoreVertical } from 'lucide-react';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback } from '../ui/avatar';

interface AudioCallProps {
  onClose: () => void;
  participant?: { name: string; avatar: string };
}

export function AudioCall({ onClose, participant }: AudioCallProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callDuration, setCallDuration] = useState('00:00');

  const defaultParticipant = participant || { name: 'Sarah Chen', avatar: 'SC' };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-[#0A1929] via-[#1a2942] to-[#2196F3]/20 z-50 flex items-center justify-center">
      <div className="w-full max-w-md mx-4">
        <div className="bg-background/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/20">
          {/* Participant Info */}
          <div className="text-center mb-8">
            <div className="relative inline-block mb-6">
              <Avatar className="w-32 h-32 ring-4 ring-white/20">
                <AvatarFallback className="bg-gradient-to-br from-[#2196F3] to-[#1976D2] text-white text-4xl">
                  {defaultParticipant.avatar}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                <div className="bg-green-500 px-4 py-1 rounded-full text-white text-xs font-medium">
                  Active
                </div>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{defaultParticipant.name}</h2>
            <p className="text-white/60">{callDuration}</p>
          </div>

          {/* Audio Visualization */}
          <div className="flex justify-center gap-2 mb-8 h-16 items-end">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="w-2 bg-[#2196F3] rounded-full animate-pulse"
                style={{
                  height: `${Math.random() * 60 + 20}%`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>

          {/* Controls */}
          <div className="flex justify-center gap-6 mb-4">
            <Button
              size="lg"
              className={`rounded-full w-16 h-16 ${isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-background/20 hover:bg-background/30'}`}
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
            </Button>
            <Button
              size="lg"
              className="rounded-full w-20 h-20 bg-red-500 hover:bg-red-600"
              onClick={onClose}
            >
              <PhoneOff className="w-7 h-7 text-white" />
            </Button>
            <Button
              size="lg"
              className={`rounded-full w-16 h-16 ${!isSpeakerOn ? 'bg-red-500 hover:bg-red-600' : 'bg-background/20 hover:bg-background/30'}`}
              onClick={() => setIsSpeakerOn(!isSpeakerOn)}
            >
              {isSpeakerOn ? <Volume2 className="w-6 h-6 text-white" /> : <VolumeX className="w-6 h-6 text-white" />}
            </Button>
          </div>

          {/* Additional Options */}
          <div className="flex justify-center">
            <Button variant="ghost" className="text-white/60 hover:text-white hover:bg-background/10">
              <MoreVertical className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
