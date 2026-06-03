import { useDrag } from 'react-dnd';
import { Calendar, Clock, Flag } from 'lucide-react';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Badge } from '../ui/badge';

import type { Task } from './type';
interface TaskCardProps {
  task: Task;
}

const priorityConfig = {
  high: { color: 'border-red-500', flag: 'text-red-500', bg: 'bg-red-50' },
  medium: { color: 'border-[#F59E0B]', flag: 'text-[#F59E0B]', bg: 'bg-amber-50' },
  low: { color: 'border-[#10B981]', flag: 'text-[#10B981]', bg: 'bg-green-50' },
};

export function TaskCard({ task }: TaskCardProps) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'TASK',
    item: { id: task.id },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const config = priorityConfig[task.priority];

  return (
    <div
      ref={(node) => {
        drag(node);
      }}
      className={`bg-background rounded-lg shadow-sm border-l-4 ${config.color} p-4 cursor-move hover:shadow-md transition-all ${
        isDragging ? 'opacity-50 scale-95' : 'hover:scale-[1.02]'
      }`}
    >
      {/* Task Title */}
      <h4 className="font-medium mb-3 line-clamp-2">{task.title}</h4>

      {/* Labels */}
      {task.labels && task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {task.labels.map((label, idx) => (
            <Badge key={idx} variant="secondary" className="text-xs px-2 py-0">
              {label}
            </Badge>
          ))}
        </div>
      )}

      {/* Bottom Section */}
      <div className="flex items-center justify-between mt-auto">
        {/* Assignee */}
        <Avatar className="w-7 h-7">
          <AvatarFallback className={`${task.assignee.color} text-white text-xs`}>
            {task.assignee.avatar}
          </AvatarFallback>
        </Avatar>

        <div className="flex items-center gap-2">
          {/* Priority Flag */}
          <Flag className={`w-4 h-4 ${config.flag} fill-current`} />
          
          {/* Due Date */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            <span>{task.dueDate}</span>
          </div>

          {/* Time Tracker */}
          <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${config.bg}`}>
            <Clock className="w-3 h-3" />
            <span className="font-medium">{task.timeTracked}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
