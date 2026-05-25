import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowUp,
  Flame,
  MessageCircle,
  Share2,
  Bookmark,
  ThumbsUp,
  MoreHorizontal,
  Send,
} from 'lucide-react';
import { ShareModal } from '../components/ShareModal';

export function PostDetailPage() {
  const { postId } = useParams();
  const [commentText, setCommentText] = useState('');
  const [fired, setFired] = useState(false);
  const [fireCount, setFireCount] = useState(23);
  const [bookmarked, setBookmarked] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [comments, setComments] = useState([
    {
      id: '1',
      author: 'Kwame Mensah',
      authorGsis: 74,
      category: 'FinTech',
      stage: 'Beta',
      avatar: 'from-accent-primary to-score-blue',
      content:
        'Congrats on the milestone! I had a similar journey. The first 50 users are the hardest. Make sure to collect detailed feedback - it will be gold for your next iteration.',
      likes: 12,
      timeAgo: '1h ago',
      replies: [],
    },
    {
      id: '2',
      author: 'Fatima Al-Hassan',
      authorGsis: 61,
      category: 'EdTech',
      stage: 'Idea',
      avatar: 'from-score-purple to-accent-primary',
      content:
        'This is inspiring! Quick question - how long did it take from idea to MVP? And did you build in-house or outsource?',
      likes: 8,
      timeAgo: '45m ago',
      replies: [
        {
          id: '2-1',
          author: 'Adaeze Okonkwo',
          authorGsis: 68,
          category: 'HealthTech',
          stage: 'MVP',
          avatar: 'from-score-green to-score-amber',
          content:
            'Thanks! Took us 6 weeks from validation to MVP. Built in-house with a small team. Happy to share more details if helpful!',
          likes: 5,
          timeAgo: '30m ago',
        },
      ],
    },
    {
      id: '3',
      author: 'David Osei',
      authorGsis: 79,
      category: 'FinTech',
      stage: 'Beta',
      avatar: 'from-score-amber to-score-red',
      content:
        'Strong execution! The 3 clinics using it daily is a great signal. Have you thought about pricing yet? Healthcare SaaS pricing can be tricky in Africa.',
      likes: 15,
      timeAgo: '20m ago',
      replies: [],
    },
  ]);

  // Mock post data - in real app this would come from API
  const post = {
    id: postId,
    type: 'milestone',
    author: 'Adaeze Okonkwo',
    authorGsis: 68,
    category: 'HealthTech',
    stage: 'MVP',
    avatar: 'from-score-green to-score-amber',
    title: 'Shipped MVP — First 50 beta users onboarded across 3 clinics',
    content:
      'After 6 weeks of intense building, we finally shipped our MVP! MediConnect is now live in 3 clinics across Lagos, helping doctors manage patient records more efficiently.\n\nKey learnings:\n• The first clinic took 2 weeks to onboard. The third took 2 days.\n• Doctors want mobile-first. Our initial desktop-only approach was wrong.\n• Real-time sync is non-negotiable in healthcare.\n\nNext milestone: First paying customer in ~14 days. The journey continues! 🚀',
    metrics: {
      betaUsers: 50,
      mrr: 0,
      gsisDelta: 7,
      daysToNext: 14,
    },
    reactions: {
      fire: 23,
      comments: comments.length,
    },
    timeAgo: '2h ago',
  };

  const handleAddComment = () => {
    if (!commentText.trim()) return;

    const newComment = {
      id: String(comments.length + 1),
      author: 'You',
      authorGsis: 68,
      category: 'HealthTech',
      stage: 'MVP',
      avatar: 'from-accent-primary to-score-purple',
      content: commentText,
      likes: 0,
      timeAgo: 'Just now',
      replies: [],
    };

    setComments([...comments, newComment]);
    setCommentText('');
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-20 lg:pb-6">
      {/* Back Button */}
      <Link
        to="/feed"
        className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary text-sm mb-6 transition-colors"
      >
        ← Back to Feed
      </Link>

      {/* Post Card */}
      <div className="bg-bg-surface border border-border-default rounded-xl p-6 border-l-[3px] border-l-score-green mb-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex gap-3">
            <Link to={`/feed/profile/${post.id}`}>
              <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${post.avatar} cursor-pointer hover:scale-105 transition-transform`}></div>
            </Link>
            <div>
              <Link to={`/feed/profile/${post.id}`}>
                <h4 className="text-base font-medium text-text-primary hover:text-accent-primary transition-colors">
                  {post.author}
                </h4>
              </Link>
              <p className="text-sm text-text-secondary">
                Co-founder · {post.category} · {post.stage} Stage
              </p>
            </div>
          </div>
          <div className="text-right">
            <div
              className="inline-block px-3 py-1.5 rounded-md border text-sm font-mono mb-1"
              style={{
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                borderColor: 'var(--score-amber)',
                color: 'var(--score-amber)',
              }}
            >
              GSIS {post.authorGsis}
            </div>
            <p className="text-text-muted text-sm">{post.timeAgo}</p>
          </div>
        </div>

        {/* Post Type Label */}
        <div
          className="inline-block px-2 py-1 rounded text-[11px] font-medium uppercase mb-3"
          style={{
            backgroundColor: 'rgba(34, 197, 94, 0.10)',
            color: 'var(--score-green)',
          }}
        >
          🏆 MILESTONE HIT
        </div>

        {/* Title */}
        <h1 className="text-xl font-semibold text-text-primary mb-4">{post.title}</h1>

        {/* Stage Progress */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-1.5">
            <div
              className="px-2 py-1 rounded text-xs"
              style={{ backgroundColor: 'rgba(34, 197, 94, 0.10)', color: 'var(--score-green)' }}
            >
              Idea ✓
            </div>
            <span className="text-text-muted">→</span>
            <div
              className="px-2 py-1 rounded text-xs"
              style={{ backgroundColor: 'rgba(34, 197, 94, 0.10)', color: 'var(--score-green)' }}
            >
              Validation ✓
            </div>
            <span className="text-text-muted">→</span>
            <div
              className="px-2 py-1 rounded text-xs animate-pulse"
              style={{ backgroundColor: 'rgba(34, 197, 94, 0.20)', color: 'var(--score-green)' }}
            >
              MVP ✓
            </div>
          </div>
          <div
            className="px-2 py-1 rounded text-xs font-mono flex items-center gap-1"
            style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', color: 'var(--score-green)' }}
          >
            <ArrowUp className="w-3 h-3" />
            +7 GSIS
          </div>
        </div>

        {/* Content */}
        <p className="text-base text-text-primary leading-relaxed mb-4 whitespace-pre-line">
          {post.content}
        </p>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-bg-elevated rounded-lg p-4">
            <p className="text-text-muted text-xs mb-1">Beta Users</p>
            <p className="font-mono text-2xl font-semibold text-text-primary">
              {post.metrics.betaUsers}
            </p>
          </div>
          <div className="bg-bg-elevated rounded-lg p-4">
            <p className="text-text-muted text-xs mb-1">MRR</p>
            <p className="font-mono text-2xl font-semibold text-text-primary">
              ${post.metrics.mrr}
            </p>
          </div>
          <div className="bg-bg-elevated rounded-lg p-4">
            <p className="text-text-muted text-xs mb-1">GSIS Delta</p>
            <p className="font-mono text-2xl font-semibold text-score-green">
              +{post.metrics.gsisDelta}
            </p>
          </div>
          <div className="bg-bg-elevated rounded-lg p-4">
            <p className="text-text-muted text-xs mb-1">Days to Next</p>
            <p className="font-mono text-2xl font-semibold text-text-primary">
              {post.metrics.daysToNext}
            </p>
          </div>
        </div>

        {/* Reactions Bar */}
        <div className="flex items-center justify-between pt-4 border-t border-border-default">
          <div className="flex items-center gap-6">
            <button
              onClick={() => { setFired(f => !f); setFireCount(c => fired ? c - 1 : c + 1); }}
              className="flex items-center gap-2 hover:scale-105 transition-all"
              style={{ color: fired ? 'var(--score-red)' : 'var(--text-secondary)' }}
            >
              <Flame className="w-5 h-5" />
              <span className="text-sm font-medium">{fireCount}</span>
            </button>
            <button className="flex items-center gap-2 text-text-secondary hover:text-accent-primary hover:scale-105 transition-all">
              <MessageCircle className="w-5 h-5" />
              <span className="text-sm font-medium">{post.reactions.comments} comments</span>
            </button>
            <button
              onClick={() => setBookmarked(b => !b)}
              className="flex items-center gap-2 hover:scale-105 transition-all"
              style={{ color: bookmarked ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
            >
              <Bookmark className={`w-5 h-5 ${bookmarked ? 'fill-current' : ''}`} />
              <span className="text-sm font-medium">{bookmarked ? 'Saved' : 'Save'}</span>
            </button>
            <button
              onClick={() => setShareOpen(true)}
              className="flex items-center gap-2 text-text-secondary hover:text-accent-primary hover:scale-105 transition-all"
            >
              <Share2 className="w-5 h-5" />
              <span className="text-sm font-medium">Share</span>
            </button>
          </div>
          <Link
            to="/feed/build-log"
            className="text-accent-primary text-sm hover:underline font-medium"
          >
            View Build Log →
          </Link>
        </div>
      </div>

      {/* Comments Section */}
      <div className="bg-bg-surface border border-border-default rounded-xl p-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">
          Comments ({comments.length})
        </h2>

        {/* Add Comment */}
        <div className="mb-6">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-primary to-score-purple flex-shrink-0"></div>
            <div className="flex-1">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="w-full bg-bg-elevated rounded-lg px-4 py-3 text-sm text-text-primary placeholder-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent-primary min-h-[80px]"
                placeholder="Share your thoughts..."
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={handleAddComment}
                  disabled={!commentText.trim()}
                  className="flex items-center gap-2 bg-accent-primary text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                  Comment
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Comments List */}
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))}
        </div>
      </div>

      {/* Share Modal */}
      {shareOpen && (
        <ShareModal
          postId={postId ?? '1'}
          postTitle={post.title}
          postType="🏆 Milestone Hit"
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}

function CommentItem({ comment, isReply = false }: { comment: any; isReply?: boolean }) {
  const [showReplyBox, setShowReplyBox] = useState(false);

  return (
    <div className={`${isReply ? 'ml-12' : ''}`}>
      <div className="flex gap-3">
        <Link to={`/feed/profile/${comment.id}`}>
          <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${comment.avatar} flex-shrink-0 cursor-pointer hover:scale-105 transition-transform`}></div>
        </Link>
        <div className="flex-1">
          <div className="bg-bg-elevated rounded-lg p-3 mb-2">
            <div className="flex items-start justify-between mb-2">
              <div>
                <Link to={`/feed/profile/${comment.id}`}>
                  <h4 className="text-sm font-medium text-text-primary hover:text-accent-primary transition-colors">
                    {comment.author}
                  </h4>
                </Link>
                <p className="text-xs text-text-secondary">
                  {comment.category} · {comment.stage} · GSIS {comment.authorGsis}
                </p>
              </div>
              <button className="text-text-muted hover:text-text-primary transition-colors">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-text-primary leading-relaxed">{comment.content}</p>
          </div>

          {/* Comment Actions */}
          <div className="flex items-center gap-4 text-xs">
            <button className="flex items-center gap-1 text-text-secondary hover:text-accent-primary transition-colors">
              <ThumbsUp className="w-3.5 h-3.5" />
              <span>{comment.likes}</span>
            </button>
            <button
              onClick={() => setShowReplyBox(!showReplyBox)}
              className="text-text-secondary hover:text-accent-primary transition-colors"
            >
              Reply
            </button>
            <span className="text-text-muted">{comment.timeAgo}</span>
          </div>

          {/* Reply Box */}
          {showReplyBox && (
            <div className="mt-3 flex gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-primary to-score-purple flex-shrink-0"></div>
              <div className="flex-1">
                <input
                  type="text"
                  className="w-full bg-bg-base rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary"
                  placeholder="Write a reply..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setShowReplyBox(false);
                    }
                  }}
                />
              </div>
            </div>
          )}

          {/* Nested Replies */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-4 space-y-4">
              {comment.replies.map((reply: any) => (
                <CommentItem key={reply.id} comment={reply} isReply={true} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}