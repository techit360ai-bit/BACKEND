import { useState, useEffect } from 'react';

interface Cursor {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
}

/**
 * CursorPresence - Shows real-time cursor positions of other users
 * This is a demo component showing the collaborative feature
 */
export function CursorPresence() {
  const [cursors, setCursors] = useState<Cursor[]>([
    {
      id: '1',
      name: 'Sarah Chen',
      color: '#2196F3',
      x: 45,
      y: 30,
    },
  ]);

  // Simulate cursor movement
  useEffect(() => {
    const interval = setInterval(() => {
      setCursors(prev =>
        prev.map(cursor => ({
          ...cursor,
          x: Math.min(95, Math.max(5, cursor.x + (Math.random() - 0.5) * 10)),
          y: Math.min(95, Math.max(5, cursor.y + (Math.random() - 0.5) * 10)),
        }))
      );
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {cursors.map(cursor => (
        <div
          key={cursor.id}
          className="absolute transition-all duration-2000 ease-out pointer-events-none"
          style={{
            left: `${cursor.x}%`,
            top: `${cursor.y}%`,
          }}
        >
          {/* Cursor dot */}
          <div
            className="w-3 h-3 rounded-full shadow-lg"
            style={{ backgroundColor: cursor.color }}
          />
          {/* Name label */}
          <div
            className="absolute top-4 left-4 px-2 py-1 rounded text-xs text-white whitespace-nowrap shadow-lg"
            style={{ backgroundColor: cursor.color }}
          >
            {cursor.name}
          </div>
        </div>
      ))}
    </div>
  );
}
