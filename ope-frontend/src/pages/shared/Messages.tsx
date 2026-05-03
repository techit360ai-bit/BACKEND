import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { Send, Search, ArrowLeft, UserCircle } from 'lucide-react'
import DashboardLayout from '../../components/shared/DashboardLayout'
import { Avatar, Button } from '../../components/ui'
import { useAuth } from '../../contexts/AuthContext'
import { cn, timeAgo } from '../../lib/utils'

interface Message  { id: string; sender_id: string; content: string; created_at: string }
interface Conversation { id: string; participant_ids: string[]; participantName: string; messages: Message[]; created_at: string }

const getLS = (k: string) => { try { return JSON.parse(localStorage.getItem(k) || '[]') } catch { return [] } }
const setLS = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v))

export default function Messages() {
  const { profile } = useAuth()
  const location = useLocation()
  const initConvId = (location.state as { conversationId?: string })?.conversationId

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [active, setActive]   = useState<Conversation | null>(null)
  const [newMsg, setNewMsg]   = useState('')
  const [search, setSearch]   = useState('')
  const [mobileView, setMobileView] = useState<'list'|'chat'>('list')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const convs: Conversation[] = getLS('techit_conversations')
    const myConvs = convs.filter(c => c.participant_ids.includes(profile?.id ?? ''))
    setConversations(myConvs)

    if (initConvId) {
      const conv = myConvs.find(c => c.id === initConvId)
      if (conv) { setActive(conv); setMobileView('chat') }
    }
  }, [profile?.id, initConvId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [active?.messages])

  const sendMessage = () => {
    if (!newMsg.trim() || !active || !profile) return
    const msg: Message = { id: Date.now().toString(), sender_id: profile.id, content: newMsg.trim(), created_at: new Date().toISOString() }
    const updated = { ...active, messages: [...(active.messages ?? []), msg] }
    setActive(updated)
    const allConvs: Conversation[] = getLS('techit_conversations')
    const idx = allConvs.findIndex(c => c.id === active.id)
    if (idx !== -1) allConvs[idx] = updated
    else allConvs.push(updated)
    setLS('techit_conversations', allConvs)
    setConversations(prev => prev.map(c => c.id === active.id ? updated : c))
    setNewMsg('')
  }

  const filteredConvs = conversations.filter(c => c.participantName?.toLowerCase().includes(search.toLowerCase()))

  return (
    <DashboardLayout title="Messages" noPadding>
      <div className="flex h-[calc(100vh-57px)] overflow-hidden">
        {/* Conversations list */}
        <div className={cn('w-full sm:w-80 flex-shrink-0 border-r border-[color:var(--border)] flex flex-col bg-[color:var(--sidebar)]', mobileView === 'chat' ? 'hidden sm:flex' : 'flex')}>
          <div className="p-4 border-b border-[color:var(--border)]">
            <div className="flex items-center gap-2 bg-[color:var(--muted)]/40 rounded-xl px-3 py-2 border border-[color:var(--border)]">
              <Search className="h-4 w-4 text-[color:var(--muted-foreground)] flex-shrink-0" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-[color:var(--muted-foreground)] text-[color:var(--foreground)]" />
            </div>
          </div>

          {filteredConvs.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <UserCircle className="h-10 w-10 text-[color:var(--muted-foreground)]/30" />
              <p className="font-semibold text-sm">No conversations yet</p>
              <p className="text-xs text-[color:var(--muted-foreground)]">Visit a profile or find collaborators to start a conversation.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {filteredConvs.map(conv => {
                const isActive = active?.id === conv.id
                const lastMsg = conv.messages?.[conv.messages.length - 1]
                return (
                  <button key={conv.id} onClick={() => { setActive(conv); setMobileView('chat') }}
                    className={cn('w-full flex items-center gap-3 px-4 py-3.5 text-left border-b border-[color:var(--border)]/50 hover:bg-[color:var(--muted)]/40 transition-colors', isActive && 'bg-[color:var(--primary)]/8 border-l-2 border-l-[color:var(--primary)]')}>
                    <Avatar name={conv.participantName || 'Member'} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline">
                        <span className="text-sm font-semibold truncate">{conv.participantName || 'Member'}</span>
                        {lastMsg && <span className="text-xs text-[color:var(--muted-foreground)] flex-shrink-0 ml-2">{timeAgo(lastMsg.created_at)}</span>}
                      </div>
                      <p className="text-xs text-[color:var(--muted-foreground)] truncate">
                        {lastMsg?.content ?? 'Start a conversation'}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Chat area */}
        <div className={cn('flex-1 flex flex-col min-w-0', mobileView === 'list' ? 'hidden sm:flex' : 'flex')}>
          {!active ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-6">
              <div className="h-16 w-16 rounded-2xl bg-[color:var(--muted)] flex items-center justify-center">
                <Send className="h-7 w-7 text-[color:var(--muted-foreground)]/40" />
              </div>
              <div>
                <p className="font-bold text-lg mb-1">Select a conversation</p>
                <p className="text-sm text-[color:var(--muted-foreground)]">Choose a conversation from the list to start chatting.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="px-5 py-3.5 border-b border-[color:var(--border)] flex items-center gap-3 bg-[color:var(--card)]/50 flex-shrink-0">
                <button className="sm:hidden p-1.5 rounded-lg hover:bg-[color:var(--muted)] transition-colors" onClick={() => setMobileView('list')}>
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <Avatar name={active.participantName || 'Member'} size="sm" />
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-sm">{active.participantName || 'Member'}</span>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {(!active.messages || active.messages.length === 0) ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                    <p className="text-sm text-[color:var(--muted-foreground)]">This is the beginning of your conversation.</p>
                  </div>
                ) : (
                  active.messages.map(msg => {
                    const isMe = msg.sender_id === profile?.id
                    return (
                      <div key={msg.id} className={cn('flex gap-2.5', isMe && 'flex-row-reverse')}>
                        <Avatar name={isMe ? `${profile?.firstName} ${profile?.lastName}` : (active.participantName || 'M')} size="sm" />
                        <div className={cn('max-w-[70%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed', isMe ? 'bg-gradient-to-br from-[color:var(--primary)] to-blue-400 text-white rounded-tr-sm' : 'bg-[color:var(--muted)] text-[color:var(--foreground)] rounded-tl-sm')}>
                          {msg.content}
                          <div className={cn('text-[0.65rem] mt-1', isMe ? 'text-white/60 text-right' : 'text-[color:var(--muted-foreground)]')}>{timeAgo(msg.created_at)}</div>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="px-5 py-4 border-t border-[color:var(--border)] bg-[color:var(--card)]/30 flex-shrink-0">
                <div className="flex items-center gap-2 bg-[color:var(--muted)]/40 border border-[color:var(--border)] rounded-2xl px-4 py-2">
                  <input value={newMsg} onChange={e => setNewMsg(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                    placeholder={`Message ${active.participantName || 'Member'}…`}
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-[color:var(--muted-foreground)] text-[color:var(--foreground)]" />
                  <Button size="icon-sm" onClick={sendMessage} disabled={!newMsg.trim()}>
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
