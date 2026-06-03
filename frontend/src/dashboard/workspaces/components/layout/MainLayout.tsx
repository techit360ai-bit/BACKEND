import { Outlet } from 'react-router-dom';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { HeaderWithCallsAndRole } from './HeaderWithCallsAndRole';
import { Sidebar } from './Sidebar';
import { RightPanel } from './RightPanel';
import { VideoCallPIP } from '../ui/video-pip';
import { Toaster } from '../ui/sonner';

export function MainLayout() {
  return (
    <DndProvider backend={HTML5Backend}>
      <div className="workspaces-scope h-screen flex flex-col bg-background">
        <HeaderWithCallsAndRole />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
          <RightPanel />
        </div>
        <VideoCallPIP />
        <Toaster />
      </div>
    </DndProvider>
  );
}