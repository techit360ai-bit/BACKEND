import { useDrop } from 'react-dnd';
import { TaskCard } from './TaskCard';
import type { Task } from './type';
import { Plus } from 'lucide-react';

interface KanbanColumnProps {
  title: string;
  tasks: Task[];
  onDrop: (taskId: string) => void;
  color: string;
}

export function KanbanColumn({ title, tasks, onDrop, color }: KanbanColumnProps) {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'TASK',
    drop: (item: { id: string }) => onDrop(item.id),
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }));

  return (
    <div className="flex-1 min-w-[280px] bg-gray-50 rounded-lg p-4">
      {/* Column Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${color}`} />
          <h3 className="font-semibold">{title}</h3>
          <span className="text-sm text-gray-500 bg-white px-2 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        <button className="p-1 hover:bg-white rounded transition-colors">
          <Plus className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* Drop Zone */}
      <div
        ref={(node) => {
          drop(node);
        }}
        className={`space-y-3 min-h-[200px] ${
          isOver ? 'bg-[#2196F3]/5 border-2 border-dashed border-[#2196F3] rounded-lg p-2' : ''
        }`}
      >
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}
