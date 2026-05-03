import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { Heart, MessageCircle, Share2, Send, TrendingUp, Search, X, Globe, Bookmark } from 'lucide-react'
import DashboardLayout from '../../components/shared/DashboardLayout'
import { Card, Button, Badge, Avatar } from '../../components/ui'
import { useAuth } from '../../contexts/AuthContext'
import { cn, timeAgo, initials, avatarGradient } from '../../lib/utils'

interface Post {
  id: string; author_id: string; content: string; tags: string[]
  likes: string[]; collab_tag: string | null; created_at: string
  author?: { firstName: string; lastName: string; role: string; country: string; avatarUrl?: string }
}

const TAG_VARIANTS: Record<string, 'violet'|'cyan'|'teal'|'amber'> = {
  HIRING: 'violet', PAID: 'cyan', FREE: 'teal', INVESTING: 'amber',
}

const COMPOSE_TAGS = [
  { id: null, label: 'None' }, { id: 'HIRING', label: 'Hiring' },
  { id: 'PAID', label: 'Paid Collab' }, { id: 'FREE', label: 'Free Collab' },
  { id: 'INVESTING', label: 'Investing' },
]

const getLS = (k: string): Post[] => { try { return JSON.parse(localStorage.getItem(k) || '[]') } catch { return [] } }
const setLS = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v))

function PostCard({ post, myId, onDelete }: { post: Post; myId: string; onDelete: (id: string) => void }) {
  const [liked, setLiked]   = useState(post.likes.includes(myId))
  const [count, setCount]   = useState(post.likes.length)
  const [expanded, setExpanded] = useState(false)
  const [comment, setComment]   = useState('')
  const [comments, setComments] = useState<{id:string;text:string;author:string;time:string}[]>([])

  const name = post.author ? `${post.author.firstName} ${post.author.lastName}` : 'Member'
  const tag  = post.collab_tag ? TAG_VARIANTS[post.collab_tag] : null

  const toggleLike = () => {
    const nl = !liked; const nc = nl ? count + 1 : count - 1
    setLiked(nl); setCount(nc)
    const all = getLS('techit_posts')
    const idx = all.findIndex((p: Post) => p.id === post.id)
    if (idx !== -1) {
      all[idx].likes = nl ? [...(all[idx].likes ?? []), myId] : (all[idx].likes ?? []).filter((l: string) => l !== myId)
      setLS('techit_posts', all)
    }
  }

  const addComment = () => {
    if (!comment.trim()) return
    setComments(p => [...p, { id: Date.now().toString(), text: comment.trim(), author: 'You', time: new Date().toISOString() }])
    setComment('')
  }

  const isLong = post.content.length > 280
  const display = isLong && !expanded ? post.content.slice(0, 280) + '…' : post.content

  return (
    <Card className="overflow-hidden hover:border-[color:var(--primary)]/15 transition-colors">
      {/* Header */}
      <div className="flex items-start gap-3 p-5 pb-3">
        <Avatar name={name} src={post.author?.avatarUrl} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-sm">{name}</span>
            {post.author?.role && <Badge variant="outline">{post.author.role}</Badge>}
            {tag && <Badge variant={tag}>{post.collab_tag}</Badge>}
          </div>
          <div className="text-xs text-[color:var(--muted-foreground)] mt-0.5 flex items-center gap-2">
            {post.author?.country && <span>{post.author.country}</span>}
            <span>·</span><span>{timeAgo(post.created_at)}</span>
            <span>·</span><Globe className="h-3 w-3" /><span>Public</span>
          </div>
        </div>
        {post.author_id === myId && (
          <button onClick={() => onDelete(post.id)} className="p-1.5 rounded-lg text-[color:var(--muted-foreground)] hover:text-red-500 hover:bg-red-500/10 transition-colors text-xs">✕</button>
        )}
      </div>

      {/* Content */}
      <div className="px-5 pb-3">
        <p className="text-sm leading-relaxed whitespace-pre-line">{display}</p>
        {isLong && <button onClick={() => setExpanded(e => !e)} className="text-xs text-[color:var(--primary)] mt-1 hover:underline">{expanded ? 'See less' : 'See more'}</button>}
        {post.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {post.tags.map(t => <span key={t} className="text-xs text-[color:var(--primary)] font-mono hover:underline cursor-pointer">#{t}</span>)}
          </div>
        )}
      </div>

      {/* Stats */}
      {count > 0 && (
        <div className="flex items-center px-5 py-2 text-xs text-[color:var(--muted-foreground)] border-t border-[color:var(--border)]/50">
          <span className="flex items-center gap-1">
            <span className="h-4 w-4 rounded-full bg-[color:var(--primary)] flex items-center justify-center"><Heart className="h-2.5 w-2.5 text-white fill-white" /></span>
            {count}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 px-3 py-2 border-t border-[color:var(--border)]/50">
        <button onClick={toggleLike} className={cn('flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition-all', liked ? 'text-[color:var(--primary)] bg-[color:var(--primary)]/8' : 'text-[color:var(--muted-foreground)] hover:bg-[color:var(--muted)] hover:text-[color:var(--foreground)]')}>
          <Heart className={cn('h-4 w-4', liked && 'fill-[color:var(--primary)]')} /><span className="hidden sm:inline">{liked ? 'Liked' : 'Like'}</span>
        </button>
        <button onClick={() => setExpanded(e => !e)} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium text-[color:var(--muted-foreground)] hover:bg-[color:var(--muted)] hover:text-[color:var(--foreground)] transition-all">
          <MessageCircle className="h-4 w-4" /><span className="hidden sm:inline">Comment</span>
        </button>
        <button onClick={() => navigator.clipboard?.writeText(window.location.href)} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium text-[color:var(--muted-foreground)] hover:bg-[color:var(--muted)] hover:text-[color:var(--foreground)] transition-all">
          <Share2 className="h-4 w-4" /><span className="hidden sm:inline">Share</span>
        </button>
      </div>

      {/* Comments */}
      {expanded && (
        <div className="border-t border-[color:var(--border)]/50 px-5 py-3 space-y-3">
          {comments.map(c => (
            <div key={c.id} className="flex gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-[color:var(--muted)] flex items-center justify-center text-xs font-bold flex-shrink-0">Me</div>
              <div className="flex-1 bg-[color:var(--muted)]/40 rounded-2xl px-3 py-2">
                <p className="text-xs font-semibold mb-0.5">{c.author}</p>
                <p className="text-xs leading-relaxed">{c.text}</p>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-[color:var(--muted)] flex items-center justify-center text-xs font-bold flex-shrink-0">Me</div>
            <div className="flex-1 flex items-center gap-2 bg-[color:var(--muted)]/40 rounded-full px-3 py-1.5">
              <input value={comment} onChange={e => setComment(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment() } }}
                placeholder="Write a comment…" maxLength={500}
                className="flex-1 bg-transparent text-xs text-[color:var(--foreground)] outline-none placeholder:text-[color:var(--muted-foreground)]" />
              <button onClick={addComment} disabled={!comment.trim()} className="text-[color:var(--primary)] disabled:text-[color:var(--muted-foreground)]/40 transition-colors flex-shrink-0"><Send className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

const FILTERS = ['All', 'HIRING', 'PAID', 'FREE', 'INVESTING']

export default function Feed() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const searchQuery = params.get('q') ?? ''

  const [posts,     setPosts]     = useState<Post[]>([])
  const [filter,    setFilter]    = useState('All')
  const [composing, setComposing] = useState(false)
  const [content,   setContent]   = useState('')
  const [selTag,    setSelTag]    = useState<string|null>(null)
  const [posting,   setPosting]   = useState(false)

  useEffect(() => {
    let all = getLS('techit_posts')
    if (searchQuery) all = all.filter((p: Post) => p.content.toLowerCase().includes(searchQuery.toLowerCase()))
    else if (filter !== 'All') all = all.filter((p: Post) => p.collab_tag === filter)
    all.sort((a: Post, b: Post) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    setPosts(all)
  }, [filter, searchQuery])

  const submitPost = () => {
    if (!content.trim() || !profile) return
    setPosting(true)
    const tags = (content.match(/#\w+/g) ?? []).map(t => t.slice(1))
    const newPost: Post = {
      id: Date.now().toString(), author_id: profile.id, content: content.trim(),
      collab_tag: selTag, tags, likes: [], created_at: new Date().toISOString(),
      author: { firstName: profile.firstName, lastName: profile.lastName, role: profile.role, country: profile.country, avatarUrl: profile.avatarUrl ?? undefined },
    }
    const all = getLS('techit_posts')
    all.unshift(newPost)
    setLS('techit_posts', all)
    setPosts(p => [newPost, ...p])
    setContent(''); setSelTag(null); setComposing(false); setPosting(false)
  }

  const onDelete = (id: string) => {
    const all = getLS('techit_posts').filter((p: Post) => p.id !== id)
    setLS('techit_posts', all)
    setPosts(p => p.filter(x => x.id !== id))
  }

  return (
    <DashboardLayout title={searchQuery ? `Search: "${searchQuery}"` : undefined}>
      <div className="max-w-2xl mx-auto space-y-4 page-enter">
        {searchQuery && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-[color:var(--primary)]/5 border border-[color:var(--primary)]/15">
            <Search className="h-4 w-4 text-[color:var(--primary)] flex-shrink-0" />
            <span className="text-sm flex-1">Results for <span className="font-semibold">"{searchQuery}"</span></span>
            <Link to="/feed" className="text-xs text-[color:var(--primary)] hover:underline flex items-center gap-1"><X className="h-3 w-3" /> Clear</Link>
          </div>
        )}

        {/* Compose */}
        {!searchQuery && (
          <Card className="p-4">
            <div className="flex gap-3">
              <Avatar name={profile ? `${profile.firstName} ${profile.lastName}` : 'U'} src={profile?.avatarUrl} size="sm" />
              <div className="flex-1">
                {!composing ? (
                  <button onClick={() => setComposing(true)}
                    className="w-full text-left px-4 py-3 rounded-2xl bg-[color:var(--muted)]/50 border border-[color:var(--border)] text-sm text-[color:var(--muted-foreground)] hover:bg-[color:var(--muted)]/80 hover:border-[color:var(--primary)]/30 transition-all">
                    What's on your mind, {profile?.firstName}?
                  </button>
                ) : (
                  <div className="space-y-3">
                    <textarea value={content} onChange={e => setContent(e.target.value)} placeholder={`What's on your mind, ${profile?.firstName}?`}
                      rows={4} autoFocus maxLength={3000}
                      className="w-full bg-transparent border-none outline-none text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] resize-none" />
                    <div className="flex flex-wrap gap-2 pb-3 border-b border-[color:var(--border)]">
                      {COMPOSE_TAGS.map(t => (
                        <button key={String(t.id)} onClick={() => setSelTag(selTag === t.id ? null : t.id)}
                          className={cn('px-2.5 py-1 rounded-full text-xs font-medium border transition-all', selTag === t.id ? 'bg-[color:var(--primary)]/20 text-[color:var(--primary)] border-[color:var(--primary)]/40' : 'border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:border-[color:var(--primary)]/30')}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[color:var(--muted-foreground)] font-mono">{content.length}/3000</span>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => { setComposing(false); setContent(''); setSelTag(null) }}>Cancel</Button>
                        <Button size="sm" onClick={submitPost} disabled={!content.trim() || posting}>Post</Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Filters */}
        {!searchQuery && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {FILTERS.map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={cn('px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-all flex-shrink-0', filter === f ? 'bg-[color:var(--primary)] text-white border-[color:var(--primary)] shadow-sm' : 'border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:border-[color:var(--primary)]/40')}>
                {f}
              </button>
            ))}
          </div>
        )}

        {/* Posts */}
        {posts.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="h-14 w-14 rounded-2xl bg-[color:var(--muted)] flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="h-7 w-7 text-[color:var(--muted-foreground)]/40" />
            </div>
            <p className="font-bold text-lg mb-1">{searchQuery ? `No posts matching "${searchQuery}"` : 'The feed is quiet'}</p>
            <p className="text-sm text-[color:var(--muted-foreground)] mb-4">
              {searchQuery ? 'Try different keywords.' : 'Be the first to post something!'}
            </p>
            {!searchQuery && <Button size="sm" onClick={() => setComposing(true)}>Create First Post</Button>}
          </Card>
        ) : (
          <div className="space-y-4">
            {posts.map(post => (
              <PostCard key={post.id} post={post} myId={profile?.id ?? ''} onDelete={onDelete} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
