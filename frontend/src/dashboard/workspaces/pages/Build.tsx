import { useState } from 'react';
import { KanbanColumn } from '../components/kanban/KanbanColumn';
import type { Task } from '../components/kanban/type';
import { Plus, Github } from 'lucide-react';
import { Badge } from '../components/ui/badge';

type ColumnType = 'backlog' | 'inProgress' | 'review' | 'done';

const initialTasks: Record<ColumnType, Task[]> = {
  backlog: [
    {
      id: '1',
      title: 'Design new dashboard layout',
      assignee: { name: 'Sarah Chen', avatar: 'SC', color: 'bg-blue-500' },
      priority: 'high',
      dueDate: 'Feb 20',
      timeTracked: '0h',
      labels: ['Design', 'UI/UX'],
    },
    {
      id: '2',
      title: 'Update API documentation',
      assignee: { name: 'Mike Johnson', avatar: 'MJ', color: 'bg-green-500' },
      priority: 'medium',
      dueDate: 'Feb 22',
      timeTracked: '0h',
      labels: ['Docs'],
    },
  ],
  inProgress: [
    {
      id: '3',
      title: 'Implement user authentication',
      assignee: { name: 'Alex Kim', avatar: 'AK', color: 'bg-purple-500' },
      priority: 'high',
      dueDate: 'Feb 18',
      timeTracked: '5.5h',
      labels: ['Backend', 'Security'],
    },
    {
      id: '4',
      title: 'Build responsive navigation',
      assignee: { name: 'Emma Wilson', avatar: 'EW', color: 'bg-pink-500' },
      priority: 'medium',
      dueDate: 'Feb 19',
      timeTracked: '3h',
      labels: ['Frontend'],
    },
  ],
  review: [
    {
      id: '5',
      title: 'Database migration script',
      assignee: { name: 'Sarah Chen', avatar: 'SC', color: 'bg-blue-500' },
      priority: 'high',
      dueDate: 'Feb 17',
      timeTracked: '8h',
      labels: ['Database'],
    },
  ],
  done: [
    {
      id: '6',
      title: 'Setup CI/CD pipeline',
      assignee: { name: 'Mike Johnson', avatar: 'MJ', color: 'bg-green-500' },
      priority: 'medium',
      dueDate: 'Feb 15',
      timeTracked: '6h',
      labels: ['DevOps'],
    },
    {
      id: '7',
      title: 'Create project wireframes',
      assignee: { name: 'Alex Kim', avatar: 'AK', color: 'bg-purple-500' },
      priority: 'low',
      dueDate: 'Feb 14',
      timeTracked: '4h',
      labels: ['Design'],
    },
  ],
};

export function Build() {
  const [tasks, setTasks] = useState(initialTasks);

  const handleDrop = (column: ColumnType) => (taskId: string) => {
    setTasks((prev) => {
      // Find the task in all columns
      let movedTask: Task | null = null;
      let sourceColumn: ColumnType | null = null;

      Object.entries(prev).forEach(([col, taskList]) => {
        const task = taskList.find((t) => t.id === taskId);
        if (task) {
          movedTask = task;
          sourceColumn = col as ColumnType;
        }
      });

      if (!movedTask || !sourceColumn || sourceColumn === column) return prev;

      // Remove from source and add to destination
      return {
        ...prev,
        [sourceColumn]: prev[sourceColumn].filter((t) => t.id !== taskId),
        [column]: [...prev[column], movedTask],
      };
    });
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Page Header */}
      <div className="bg-background border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Build
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Sprint 12 • Feb 10 - Feb 24, 2026
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-lg hover:bg-background transition-colors">
              <Github className="w-4 h-4" />
              <span className="text-sm font-medium">GitHub</span>
              <Badge className="bg-[#10B981] text-white text-xs">3 PRs</Badge>
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-[#2196F3] text-white rounded-lg hover:bg-[#2196F3]/90 transition-colors shadow-sm">
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">New Task</span>
            </button>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-auto p-6">
        <div className="flex gap-6 h-full">
          <KanbanColumn
            title="Backlog"
            tasks={tasks.backlog}
            onDrop={handleDrop('backlog')}
            color="bg-muted"
          />
          <KanbanColumn
            title="In Progress"
            tasks={tasks.inProgress}
            onDrop={handleDrop('inProgress')}
            color="bg-[#2196F3]"
          />
          <KanbanColumn
            title="Review"
            tasks={tasks.review}
            onDrop={handleDrop('review')}
            color="bg-[#F59E0B]"
          />
          <KanbanColumn
            title="Done"
            tasks={tasks.done}
            onDrop={handleDrop('done')}
            color="bg-[#10B981]"
          />
        </div>
      </div>

      {/* Floating Action Button */}
      <button
        className="fixed bottom-8 right-8 w-14 h-14 bg-[#2196F3] text-white rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all flex items-center justify-center group"
        title="Add New Task"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}