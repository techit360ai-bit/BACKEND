import { Rocket, TrendingUp, Users, Lightbulb } from 'lucide-react';

export function Incubator() {
  return (
    <div className="h-full bg-background flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <div className="w-20 h-20 bg-gradient-to-br from-[#2196F3] to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Rocket className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-2xl font-semibold mb-3" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          Incubator Hub
        </h2>
        <p className="text-muted-foreground mb-8">
          Launch and grow your innovative projects with our comprehensive incubator tools and resources.
        </p>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="bg-background p-4 rounded-lg shadow-sm">
            <TrendingUp className="w-6 h-6 text-[#10B981] mx-auto mb-2" />
            <div className="font-medium">Growth Tools</div>
          </div>
          <div className="bg-background p-4 rounded-lg shadow-sm">
            <Users className="w-6 h-6 text-[#2196F3] mx-auto mb-2" />
            <div className="font-medium">Networking</div>
          </div>
          <div className="bg-background p-4 rounded-lg shadow-sm">
            <Lightbulb className="w-6 h-6 text-[#F59E0B] mx-auto mb-2" />
            <div className="font-medium">Mentorship</div>
          </div>
        </div>
      </div>
    </div>
  );
}
