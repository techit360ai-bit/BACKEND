export interface Task {
  id: string;
  title: string;
  assignee: {
    name: string;
    avatar: string;
    color: string;
  };
  priority: 'high' | 'medium' | 'low';
  dueDate: string;
  timeTracked: string;
  labels?: string[];
}