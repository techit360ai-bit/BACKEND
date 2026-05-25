import { useState } from 'react';
import { Github, GitBranch, GitPullRequest, GitCommit, Star, GitFork, Users, Code, AlertCircle } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Avatar, AvatarFallback } from '../components/ui/avatar';

export function GitHub() {
  const [repos] = useState([
    {
      name: 'techit-platform',
      description: 'Main TechIT collaborative workspace platform',
      language: 'TypeScript',
      stars: 247,
      forks: 34,
      isPrivate: false,
      updated: '2 hours ago',
    },
    {
      name: 'api-gateway',
      description: 'Microservices API gateway with authentication',
      language: 'Go',
      stars: 89,
      forks: 12,
      isPrivate: true,
      updated: '1 day ago',
    },
    {
      name: 'mobile-app',
      description: 'React Native mobile application',
      language: 'JavaScript',
      stars: 156,
      forks: 23,
      isPrivate: false,
      updated: '3 days ago',
    },
  ]);

  const [pullRequests] = useState([
    {
      id: 1,
      title: 'Add authentication flow to API endpoints',
      repo: 'techit-platform',
      author: 'Sarah Chen',
      status: 'open',
      comments: 8,
      updated: '30 minutes ago',
    },
    {
      id: 2,
      title: 'Fix: Memory leak in WebSocket connection',
      repo: 'api-gateway',
      author: 'Mike Johnson',
      status: 'review',
      comments: 3,
      updated: '2 hours ago',
    },
    {
      id: 3,
      title: 'Feature: Dark mode support',
      repo: 'mobile-app',
      author: 'Alex Kim',
      status: 'merged',
      comments: 12,
      updated: '1 day ago',
    },
  ]);

  const [branches] = useState([
    { name: 'main', protected: true, commits: 1247, updated: '2 hours ago' },
    { name: 'develop', protected: true, commits: 892, updated: '5 hours ago' },
    { name: 'feature/ai-integration', protected: false, commits: 23, updated: '1 day ago' },
    { name: 'hotfix/auth-bug', protected: false, commits: 4, updated: '2 days ago' },
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-green-500';
      case 'review':
        return 'bg-yellow-500';
      case 'merged':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getLanguageColor = (language: string) => {
    switch (language) {
      case 'TypeScript':
        return 'bg-blue-500';
      case 'JavaScript':
        return 'bg-yellow-500';
      case 'Go':
        return 'bg-cyan-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-900 rounded-lg">
              <Github className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                GitHub Integration
              </h1>
              <p className="text-sm text-gray-500">Connected as @johndoe • TechIT Organization</p>
            </div>
          </div>
          <Button className="bg-[#2196F3] hover:bg-[#1976D2]">
            <Github className="w-4 h-4 mr-2" />
            New Repository
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-8 py-6">
        <Tabs defaultValue="repos" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="repos">
              <Code className="w-4 h-4 mr-2" />
              Repositories
            </TabsTrigger>
            <TabsTrigger value="prs">
              <GitPullRequest className="w-4 h-4 mr-2" />
              Pull Requests
            </TabsTrigger>
            <TabsTrigger value="branches">
              <GitBranch className="w-4 h-4 mr-2" />
              Branches
            </TabsTrigger>
            <TabsTrigger value="activity">
              <GitCommit className="w-4 h-4 mr-2" />
              Activity
            </TabsTrigger>
          </TabsList>

          {/* Repositories Tab */}
          <TabsContent value="repos" className="space-y-4">
            {repos.map((repo, idx) => (
              <div
                key={idx}
                className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold">{repo.name}</h3>
                      {repo.isPrivate ? (
                        <Badge variant="outline">Private</Badge>
                      ) : (
                        <Badge className="bg-green-500/10 text-green-600 border-green-200">Public</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-4">{repo.description}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <div className={`w-3 h-3 rounded-full ${getLanguageColor(repo.language)}`} />
                        <span>{repo.language}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4" />
                        <span>{repo.stars}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <GitFork className="w-4 h-4" />
                        <span>{repo.forks}</span>
                      </div>
                      <span>Updated {repo.updated}</span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    View Repository
                  </Button>
                </div>
              </div>
            ))}
          </TabsContent>

          {/* Pull Requests Tab */}
          <TabsContent value="prs" className="space-y-4">
            {pullRequests.map(pr => (
              <div
                key={pr.id}
                className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(pr.status)} mt-2`} />
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold mb-1">{pr.title}</h3>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <span className="font-medium">{pr.repo}</span>
                          <span>•</span>
                          <span>by {pr.author}</span>
                          <span>•</span>
                          <span>{pr.updated}</span>
                        </div>
                      </div>
                      <Badge className={getStatusColor(pr.status) + ' text-white'}>
                        {pr.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-4">
                      <Button size="sm" variant="outline">
                        <GitCommit className="w-4 h-4 mr-2" />
                        View Changes
                      </Button>
                      <span className="text-sm text-gray-500">{pr.comments} comments</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </TabsContent>

          {/* Branches Tab */}
          <TabsContent value="branches" className="space-y-4">
            {branches.map((branch, idx) => (
              <div
                key={idx}
                className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <GitBranch className="w-5 h-5 text-[#2196F3]" />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{branch.name}</h3>
                        {branch.protected && (
                          <Badge variant="outline" className="text-xs">
                            Protected
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {branch.commits} commits • Updated {branch.updated}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">
                      View
                    </Button>
                    {!branch.protected && (
                      <Button size="sm" variant="outline" className="text-red-500">
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold mb-4">Recent Activity</h3>
              <div className="space-y-4">
                {[
                  { user: 'Sarah Chen', action: 'opened pull request', target: '#247', time: '30 min ago' },
                  { user: 'Mike Johnson', action: 'merged branch', target: 'feature/auth', time: '2 hours ago' },
                  { user: 'Alex Kim', action: 'pushed to', target: 'develop', time: '4 hours ago' },
                  { user: 'Emma Wilson', action: 'created branch', target: 'hotfix/ui-bug', time: '6 hours ago' },
                ].map((activity, idx) => (
                  <div key={idx} className="flex items-start gap-3 pb-4 border-b last:border-0">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-[#2196F3] text-white text-xs">
                        {activity.user.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm">
                        <span className="font-medium">{activity.user}</span>{' '}
                        <span className="text-gray-600">{activity.action}</span>{' '}
                        <span className="font-medium text-[#2196F3]">{activity.target}</span>
                      </p>
                      <span className="text-xs text-gray-400">{activity.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
