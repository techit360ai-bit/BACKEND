import { Link } from 'react-router-dom';
import { MessageCircle, TrendingUp, Clock } from 'lucide-react';
import { LeftSidebar } from '../components/LeftSidebar';
import { RightPanel } from '../components/RightPanel';
import { BackButton } from '../components/BackButton';

export function QuestionsPage() {
  const questions = [
    {
      id: '1',
      author: 'Chioma Eze',
      authorGsis: 71,
      category: 'AgriTech',
      stage: 'Validation',
      avatar: 'from-score-green to-score-amber',
      question: 'How do you validate demand in rural markets with limited internet access?',
      context: { stage: 'Validation', industry: 'AgriTech', stack: 'React/Node.js' },
      tags: ['validation', 'rural', 'market-research'],
      answers: 8,
      views: 142,
      trending: true,
      timeAgo: '6h ago',
    },
    {
      id: '2',
      author: 'David Osei',
      authorGsis: 79,
      category: 'FinTech',
      stage: 'Beta',
      avatar: 'from-score-amber to-score-red',
      question: 'What is the best way to handle mobile money integrations in West Africa?',
      context: { stage: 'Beta', industry: 'FinTech', stack: 'Python/Django' },
      tags: ['mobile-money', 'payments', 'integration'],
      answers: 12,
      views: 234,
      trending: true,
      timeAgo: '3h ago',
    },
    {
      id: '3',
      author: 'Fatima Al-Hassan',
      authorGsis: 61,
      category: 'EdTech',
      stage: 'Idea',
      avatar: 'from-score-purple to-accent-primary',
      question: 'How much equity should I offer a technical co-founder joining at idea stage?',
      context: { stage: 'Idea', industry: 'EdTech', stack: 'To be decided' },
      tags: ['equity', 'co-founder', 'legal'],
      answers: 15,
      views: 389,
      trending: false,
      timeAgo: '1d ago',
    },
    {
      id: '4',
      author: 'Kwame Mensah',
      authorGsis: 74,
      category: 'FinTech',
      stage: 'Beta',
      avatar: 'from-accent-primary to-score-blue',
      question: 'Should I focus on B2B or B2C for my payment product?',
      context: { stage: 'Beta', industry: 'FinTech', stack: 'React/Node.js' },
      tags: ['strategy', 'business-model', 'b2b-vs-b2c'],
      answers: 10,
      views: 201,
      trending: false,
      timeAgo: '18h ago',
    },
    {
      id: '5',
      author: 'Tunde Balogun',
      authorGsis: 65,
      category: 'CleanTech',
      stage: 'Validation',
      avatar: 'from-green-500 to-blue-500',
      question: 'How to price solar solutions for customers with irregular income?',
      context: { stage: 'Validation', industry: 'CleanTech', stack: 'Hardware + IoT' },
      tags: ['pricing', 'cleantech', 'africa'],
      answers: 6,
      views: 87,
      trending: false,
      timeAgo: '2d ago',
    },
  ];

  return (
    <div className="flex pb-14 lg:pb-0">
      {/* Left Sidebar */}
      <LeftSidebar />

      {/* Main Content */}
      <main className="flex-1 min-w-0 lg:max-w-[720px] lg:mx-auto w-full">
        {/* Header */}
        <div className="sticky top-14 bg-bg-surface border-b border-border-default px-6 py-4 z-40">
          <BackButton className="mb-3" />
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-semibold text-text-primary mb-1">Questions & Answers</h1>
              <p className="text-sm text-text-secondary">
                Get help from {questions.length} active founders
              </p>
            </div>
            <button className="bg-accent-primary text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity">
              Ask Question
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-4 text-sm">
            <button className="text-accent-primary border-b-2 border-accent-primary pb-2 font-medium">
              Trending
            </button>
            <button className="text-text-secondary hover:text-text-primary pb-2 transition-colors">
              Recent
            </button>
            <button className="text-text-secondary hover:text-text-primary pb-2 transition-colors">
              Unanswered
            </button>
            <button className="text-text-secondary hover:text-text-primary pb-2 transition-colors">
              My Questions
            </button>
          </div>
        </div>

        {/* Questions List */}
        <div className="px-4 py-4 space-y-3">
          {questions.map((q) => (
            <QuestionCard key={q.id} question={q} />
          ))}
        </div>
      </main>

      {/* Right Panel */}
      <RightPanel />
    </div>
  );
}

function QuestionCard({ question }: { question: any }) {
  return (
    <Link to={`/feed/post/${question.id}`}>
      <div
        className="bg-bg-surface border border-border-default rounded-xl p-4 border-l-[3px] card-hover animate-slide-in"
        style={{ borderLeftColor: '#EC4899' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex gap-3 flex-1 min-w-0">
            <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${question.avatar} flex-shrink-0`}></div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-text-primary">{question.author}</h4>
              <p className="text-xs text-text-secondary">
                {question.category} · {question.stage}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {question.trending && (
              <div className="flex items-center gap-1 text-score-amber">
                <TrendingUp className="w-3 h-3" />
              </div>
            )}
            <p className="text-text-muted text-xs whitespace-nowrap">{question.timeAgo}</p>
          </div>
        </div>

        {/* Question */}
        <div
          className="inline-block px-2 py-1 rounded text-[11px] font-medium uppercase mb-2"
          style={{
            backgroundColor: 'rgba(236, 72, 153, 0.10)',
            color: '#EC4899',
          }}
        >
          ❓ QUESTION
        </div>

        <h3 className="text-[15px] font-medium text-text-primary mb-3 hover:text-accent-primary transition-colors">
          {question.question}
        </h3>

        {/* Context */}
        <div className="bg-bg-elevated rounded-lg p-3 mb-3">
          <p className="text-xs text-text-secondary">
            <span className="font-medium">Stage:</span> {question.context.stage} ·{' '}
            <span className="font-medium">Industry:</span> {question.context.industry} ·{' '}
            <span className="font-medium">Stack:</span> {question.context.stack}
          </p>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-3">
          {question.tags.map((tag: string) => (
            <span
              key={tag}
              className="text-xs bg-bg-elevated border border-border-default text-text-secondary px-2 py-1 rounded"
            >
              #{tag}
            </span>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border-default">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-text-secondary">
              <MessageCircle className="w-4 h-4" />
              <span className="text-xs font-medium">{question.answers} answers</span>
            </div>
            <div className="flex items-center gap-1.5 text-text-secondary">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-medium">{question.views} views</span>
            </div>
          </div>
          <button
            className="text-sm font-medium hover:underline"
            style={{ color: '#EC4899' }}
            onClick={(e) => {
              e.preventDefault();
            }}
          >
            Answer →
          </button>
        </div>
      </div>
    </Link>
  );
}
