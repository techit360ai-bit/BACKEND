import { useState } from 'react';
import { LeftSidebar } from '../components/LeftSidebar';
import { RightPanel } from '../components/RightPanel';
import { ZoneSwitcher } from '../components/ZoneSwitcher';
import { PostComposer } from '../components/PostComposer';
import {
  MilestoneCard,
  InsightCard,
  CollabCallCard,
  BuildUpdateCard,
  ProblemSignalCard,
  QuestionCard,
} from '../components/FeedCards';

export function FeedPage() {
  const [activeZone, setActiveZone] = useState('Global Pulse');
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [selectedPostType, setSelectedPostType] = useState('milestone');

  return (
    <div className="flex pb-14 lg:pb-0">
      {/* Left Sidebar */}
      <LeftSidebar />

      {/* Main Feed */}
      <main className="flex-1 min-w-0 lg:max-w-[720px] lg:mx-auto w-full">
        {/* Zone Switcher */}
        <ZoneSwitcher active={activeZone} onChange={setActiveZone} />

        {/* Post Composer - Desktop only */}
        <div className="hidden lg:block px-4 pt-4">
          <PostComposer
            expanded={composerExpanded}
            setExpanded={setComposerExpanded}
            selectedType={selectedPostType}
            setSelectedType={setSelectedPostType}
          />
        </div>

        {/* Feed Stream */}
        <div className="px-4 pb-8 space-y-3 pt-4 lg:pt-0">
          <MilestoneCard postId="1" />
          <InsightCard postId="2" />
          <CollabCallCard postId="3" />
          <BuildUpdateCard postId="4" />
          <ProblemSignalCard postId="5" />
          <QuestionCard postId="6" />
        </div>
      </main>

      {/* Right Panel */}
      <RightPanel />
    </div>
  );
}
