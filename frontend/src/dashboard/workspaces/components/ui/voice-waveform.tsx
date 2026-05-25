import { Play, Pause } from 'lucide-react';
import { useState } from 'react';

interface VoiceWaveformProps {
  duration?: string;
}

/**
 * VoiceWaveform - Displays an audio waveform visualization
 * Used for voice notes in chat messages
 */
export function VoiceWaveform({ duration = '0:45' }: VoiceWaveformProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Generate random heights for waveform bars
  const bars = Array.from({ length: 40 }, () => Math.random() * 100 + 20);

  return (
    <div className="flex items-center gap-3 bg-[#2196F3]/10 rounded-lg p-3 max-w-sm">
      {/* Play/Pause Button */}
      <button
        onClick={() => setIsPlaying(!isPlaying)}
        className="w-8 h-8 bg-[#2196F3] text-white rounded-full flex items-center justify-center hover:bg-[#2196F3]/90 transition-colors flex-shrink-0"
      >
        {isPlaying ? (
          <Pause className="w-4 h-4" fill="currentColor" />
        ) : (
          <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
        )}
      </button>

      {/* Waveform */}
      <div className="flex items-center gap-0.5 flex-1 h-8">
        {bars.map((height, idx) => (
          <div
            key={idx}
            className="flex-1 bg-[#2196F3] rounded-full transition-all"
            style={{
              height: `${height}%`,
              opacity: isPlaying && idx < 20 ? 1 : 0.4,
            }}
          />
        ))}
      </div>

      {/* Duration */}
      <span className="text-xs text-gray-600 font-medium">{duration}</span>
    </div>
  );
}
