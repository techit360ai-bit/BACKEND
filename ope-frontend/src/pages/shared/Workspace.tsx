import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { File, Plus, Trash2, Save, X, Code2, LayoutDashboard, Terminal as TerminalIcon, Maximize2, Minimize2, AlertCircle, RefreshCw, Copy, Check } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { cn } from '../../lib/utils'
import { Button, Badge } from '../../components/ui'
import { Spinner } from '../../components/ProtectedRoute'

// ── Language detection ─────────────────────────────────────────
const LANG_EXT: Record<string, string[]> = {
  typescript: ['ts','tsx'], javascript: ['js','jsx','mjs'], python: ['py','pyw'],
  html: ['html','htm'], css: ['css','scss','sass'], json: ['json'], markdown: ['md','mdx'],
  sql: ['sql'], bash: ['sh','bash'], rust: ['rs'], go: ['go'], text: ['txt'],
}
const LANG_COLORS: Record<string, string> = {
  typescript:'text-blue-400', javascript:'text-yellow-400', python:'text-green-400',
  html:'text-orange-400', css:'text-pink-400', json:'text-amber-400',
  markdown:'text-gray-400', sql:'text-cyan-400', bash:'text-emerald-400',
  rust:'text-orange-500', go:'text-sky-400', text:'text-[color:var(--muted-foreground)]',
}
function getLang(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  for (const [lang, exts] of Object.entries(LANG_EXT)) { if (exts.includes(ext)) return lang }
  return 'text'
}

// ── Types ──────────────────────────────────────────────────────
interface WsFile { id: string; workspace_id: string; name: string; content: string; language: string; updated_at: string }

// ── Storage helpers ────────────────────────────────────────────
const getLS = (k: string) => { try { return JSON.parse(localStorage.getItem(k) || '[]') } catch { return [] } }
const setLS = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v))
const getFiles = (wsId: string): WsFile[] => getLS('techit_ws_files').filter((f: WsFile) => f.workspace_id === wsId)
const saveFile  = (f: WsFile) => { const all = getLS('techit_ws_files'); const idx = all.findIndex((x: WsFile) => x.id === f.id); if (idx !== -1) all[idx] = f; else all.push(f); setLS('techit_ws_files', all) }
const delFile   = (id: string) => setLS('techit_ws_files', getLS('techit_ws_files').filter((f: WsFile) => f.id !== id))

const STARTERS: Partial<WsFile>[] = [
  { name: 'README.md',  language: 'markdown',   content: '# Project Workspace\n\nWelcome to your TechIT Network workspace!\n\n## Getting Started\n\n1. Add files using the Explorer panel\n2. Your team collaborates in real-time\n3. Use Ctrl+S to save\n\n## Milestones\n\n- [ ] Set up project structure\n- [ ] First working prototype\n- [ ] Testing & feedback\n- [ ] Launch\n' },
  { name: 'notes.md',   language: 'markdown',   content: '# Project Notes\n\n## Ideas\n\n- \n\n## Decisions\n\n- \n\n## Meeting Notes\n\n' },
  { name: 'index.js',   language: 'javascript', content: '// Entry point\nconsole.log("Hello from TechIT Workspace!");\n' },
]

export default function Workspace() {
  const { projectId }    = useParams<{ projectId: string }>()
  const { profile }      = useAuth()
  const navigate         = useNavigate()

  const [wsId,       setWsId]      = useState<string|null>(null)
  const [project,    setProject]   = useState<any>(null)
  const [files,      setFiles]     = useState<WsFile[]>([])
  const [active,     setActive]    = useState<WsFile|null>(null)
  const [openTabs,   setTabs]      = useState<WsFile[]>([])
  const [content,    setContent]   = useState('')
  const [loading,    setLoading]   = useState(true)
  const [error,      setError]     = useState('')
  const [saving,     setSaving]    = useState(false)
  const [saved,      setSaved]     = useState(true)
  const [copied,     setCopied]    = useState(false)
  const [showNew,    setShowNew]   = useState(false)
  const [newName,    setNewName]   = useState('')
  const [sideOpen,   setSide]      = useState(true)
  const [termOpen,   setTerm]      = useState(false)
  const [termLines,  setTermLines] = useState(['TechIT Workspace Terminal v1.0', "Type 'help' for commands", ''])
  const [termInput,  setTermInput] = useState('')
  const [fullscreen, setFull]      = useState(false)
  const textRef   = useRef<HTMLTextAreaElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout>|null>(null)

  useEffect(() => { if (projectId && profile?.id) init() }, [projectId, profile?.id])

  useEffect(() => {
    if (!active || saved) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(save, 1500)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [content])

  function init() {
    setLoading(true); setError('')
    try {
      // Load project from localStorage
      const allProjects = getLS('techit_projects')
      const proj = allProjects.find((p: any) => p.id === projectId)

      // Generate workspace id
      const id = `ws_${projectId}`
      setWsId(id); setProject(proj)

      // Load or seed files
      let wsFiles = getFiles(id)
      if (wsFiles.length === 0) {
        wsFiles = STARTERS.map((s, i) => ({
          id: `${id}_file_${i}`, workspace_id: id, name: s.name!, content: s.content!,
          language: s.language!, updated_at: new Date().toISOString(),
        }))
        wsFiles.forEach(f => saveFile(f))
      }
      wsFiles.sort((a, b) => a.name.localeCompare(b.name))
      setFiles(wsFiles)
      if (wsFiles[0]) openFile(wsFiles[0])
    } catch (e) { setError((e as Error).message || 'Failed to load workspace') }
    finally { setLoading(false) }
  }

  function openFile(file: WsFile) {
    setActive(file); setContent(file.content ?? ''); setSaved(true)
    setTabs(prev => prev.find(t => t.id === file.id) ? prev : [...prev, file])
  }

  function closeTab(file: WsFile, e: React.MouseEvent) {
    e.stopPropagation()
    const remaining = openTabs.filter(t => t.id !== file.id)
    setTabs(remaining)
    if (active?.id === file.id) {
      const next = remaining[remaining.length - 1] ?? null
      setActive(next); setContent(next?.content ?? ''); setSaved(true)
    }
  }

  async function save() {
    if (!active || !wsId) return
    setSaving(true)
    const updated: WsFile = { ...active, content, updated_at: new Date().toISOString() }
    saveFile(updated)
    setFiles(prev => prev.map(f => f.id === updated.id ? updated : f))
    setActive(updated)
    setTabs(prev => prev.map(t => t.id === updated.id ? updated : t))
    setSaved(true); setSaving(false)
  }

  async function copyContent() {
    if (!content) return
    await navigator.clipboard.writeText(content)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  function createFile() {
    if (!newName.trim() || !wsId) return
    const lang = getLang(newName.trim())
    const f: WsFile = { id: `${wsId}_file_${Date.now()}`, workspace_id: wsId, name: newName.trim(), content: '', language: lang, updated_at: new Date().toISOString() }
    saveFile(f); setFiles(prev => [...prev, f]); openFile(f); setNewName(''); setShowNew(false)
  }

  function deleteFile(file: WsFile, e: React.MouseEvent) {
    e.stopPropagation()
    if (!window.confirm(`Delete "${file.name}"?`)) return
    delFile(file.id)
    const remaining = openTabs.filter(t => t.id !== file.id)
    setTabs(remaining); setFiles(prev => prev.filter(f => f.id !== file.id))
    if (active?.id === file.id) { const next = remaining[0] ?? null; setActive(next); setContent(next?.content ?? '') }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Tab') {
      e.preventDefault()
      const s = e.currentTarget.selectionStart, end = e.currentTarget.selectionEnd
      const next = content.slice(0, s) + '  ' + content.slice(end)
      setContent(next); setSaved(false)
      setTimeout(() => { if (textRef.current) { textRef.current.selectionStart = textRef.current.selectionEnd = s + 2 } }, 0)
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save() }
  }

  function runTerminal(cmd: string) {
    const parts = cmd.trim().split(' ')
    let out = ''
    switch (parts[0]) {
      case 'help':    out = 'Commands: ls · pwd · whoami · project · clear'; break
      case 'ls':      out = files.map(f => f.name).join('  ') || '(empty)'; break
      case 'pwd':     out = `/workspace/${project?.title ?? projectId}`; break
      case 'whoami':  out = `${profile?.firstName} ${profile?.lastName} (${profile?.role})`; break
      case 'project': out = project ? `${project.title} · ${project.industry} · ${project.stage}` : 'No project'; break
      case 'clear':   setTermLines(['']); setTermInput(''); return
      default:        out = `${parts[0]}: command not found`
    }
    setTermLines(prev => [...prev, `$ ${cmd}`, out, ''])
    setTermInput('')
  }

  const lineNums = content.split('\n').length

  if (loading) return (
    <div className="min-h-screen bg-[color:var(--background)] flex flex-col items-center justify-center gap-4">
      <div className="h-8 w-8 rounded-full border-2 border-[color:var(--primary)] border-t-transparent animate-spin" />
      <p className="text-sm text-[color:var(--muted-foreground)]">Loading workspace…</p>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-[color:var(--background)] flex flex-col items-center justify-center gap-6 px-6 text-center">
      <AlertCircle className="h-12 w-12 text-red-500/60" />
      <div><h2 className="font-bold text-xl mb-2">Could not load workspace</h2><p className="text-[color:var(--muted-foreground)] text-sm">{error}</p></div>
      <div className="flex gap-3">
        <Button onClick={init}><RefreshCw className="h-4 w-4" /> Retry</Button>
        <Button variant="outline" onClick={() => navigate('/dashboard')}><LayoutDashboard className="h-4 w-4" /> Dashboard</Button>
      </div>
    </div>
  )

  return (
    <div className={cn('flex flex-col bg-[color:var(--background)] text-[color:var(--foreground)]', fullscreen ? 'fixed inset-0 z-50' : 'min-h-screen')}>
      {/* Top bar */}
      <header className="flex items-center gap-2 px-3 py-2 bg-[color:var(--sidebar)] border-b border-[color:var(--sidebar-border)] flex-shrink-0 h-11">
        <Link to="/dashboard" className="flex items-center gap-1.5 mr-2 flex-shrink-0">
          <div className="h-6 w-6 rounded-md bg-gradient-to-br from-[color:var(--primary)] to-blue-400 flex items-center justify-center">
            <Code2 className="h-3.5 w-3.5 text-white" />
          </div>
        </Link>
        <div className="flex items-center gap-1.5 text-xs flex-shrink-0 min-w-0">
          <span className="text-[color:var(--sidebar-foreground)]/40">/</span>
          <span className="font-semibold truncate max-w-32">{project?.title ?? 'Workspace'}</span>
          {project?.stage && <Badge variant="outline" className="text-[0.6rem] h-4 px-1.5">{project.stage}</Badge>}
        </div>

        {/* File tabs */}
        <div className="flex-1 flex items-center overflow-x-auto gap-0 ml-2">
          {openTabs.map(tab => (
            <div key={tab.id} onClick={() => openFile(tab)}
              className={cn('flex items-center gap-1.5 px-3 h-8 text-xs font-medium border-r border-[color:var(--sidebar-border)] cursor-pointer flex-shrink-0 transition-colors min-w-0',
                active?.id === tab.id ? 'bg-[color:var(--background)] text-[color:var(--foreground)]' : 'text-[color:var(--sidebar-foreground)]/60 hover:text-[color:var(--sidebar-foreground)] hover:bg-[color:var(--sidebar-accent)]/20')}>
              <File className={cn('h-3 w-3 flex-shrink-0', LANG_COLORS[tab.language] ?? LANG_COLORS.text)} />
              <span className="truncate max-w-20">{tab.name}</span>
              {active?.id === tab.id && !saved && <span className="h-1.5 w-1.5 rounded-full bg-amber-400 flex-shrink-0" />}
              <button onClick={e => closeTab(tab, e)} className="opacity-60 hover:opacity-100 hover:text-rose-400 ml-0.5 flex-shrink-0"><X className="h-2.5 w-2.5" /></button>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 ml-auto flex-shrink-0">
          {saving && <span className="text-[0.65rem] text-[color:var(--muted-foreground)] font-mono">saving…</span>}
          {saved && !saving && <span className="text-[0.65rem] text-emerald-400 font-mono">saved</span>}
          <button onClick={save} title="Save (Ctrl+S)" className="p-1.5 rounded hover:bg-[color:var(--sidebar-accent)]/30 text-[color:var(--sidebar-foreground)]/60 hover:text-[color:var(--sidebar-foreground)] transition-colors"><Save className="h-3.5 w-3.5" /></button>
          <button onClick={copyContent} title="Copy file content" className="p-1.5 rounded hover:bg-[color:var(--sidebar-accent)]/30 text-[color:var(--sidebar-foreground)]/60 hover:text-[color:var(--sidebar-foreground)] transition-colors">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <button onClick={() => setTerm(o => !o)} title="Toggle Terminal"
            className={cn('p-1.5 rounded transition-colors', termOpen ? 'bg-[color:var(--primary)]/20 text-[color:var(--primary)]' : 'hover:bg-[color:var(--sidebar-accent)]/30 text-[color:var(--sidebar-foreground)]/60 hover:text-[color:var(--sidebar-foreground)]')}>
            <TerminalIcon className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setFull(f => !f)} className="p-1.5 rounded hover:bg-[color:var(--sidebar-accent)]/30 text-[color:var(--sidebar-foreground)]/60 hover:text-[color:var(--sidebar-foreground)] transition-colors">
            {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
          <Link to="/dashboard" className="p-1.5 rounded hover:bg-[color:var(--sidebar-accent)]/30 text-[color:var(--sidebar-foreground)]/60 hover:text-[color:var(--sidebar-foreground)] transition-colors">
            <LayoutDashboard className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* File explorer */}
        {sideOpen && (
          <div className="w-52 flex-shrink-0 bg-[color:var(--sidebar)] border-r border-[color:var(--sidebar-border)] flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 border-b border-[color:var(--sidebar-border)]">
              <span className="text-[0.65rem] font-semibold text-[color:var(--sidebar-foreground)]/50 uppercase tracking-widest">Explorer</span>
              <button onClick={() => setShowNew(true)} title="New File" className="p-0.5 rounded hover:bg-[color:var(--sidebar-accent)]/30 text-[color:var(--sidebar-foreground)]/50 hover:text-[color:var(--sidebar-foreground)]">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {showNew && (
              <div className="px-3 py-2 border-b border-[color:var(--sidebar-border)]">
                <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') createFile(); if (e.key === 'Escape') { setShowNew(false); setNewName('') } }}
                  placeholder="filename.tsx"
                  className="w-full bg-[color:var(--sidebar-accent)]/20 border border-[color:var(--sidebar-border)] rounded px-2 py-1 text-xs text-[color:var(--sidebar-foreground)] placeholder:text-[color:var(--sidebar-foreground)]/40 outline-none focus:border-[color:var(--primary)]" />
              </div>
            )}

            <div className="flex-1 overflow-y-auto py-1">
              {files.length === 0
                ? <p className="px-3 py-4 text-xs text-[color:var(--sidebar-foreground)]/40">No files. Click + to create one.</p>
                : files.map(file => (
                  <div key={file.id} onClick={() => openFile(file)}
                    className={cn('flex items-center gap-2 px-3 py-1.5 cursor-pointer group transition-colors',
                      active?.id === file.id ? 'bg-[color:var(--primary)]/15 text-[color:var(--sidebar-foreground)]' : 'text-[color:var(--sidebar-foreground)]/70 hover:bg-[color:var(--sidebar-accent)]/15 hover:text-[color:var(--sidebar-foreground)]')}>
                    <File className={cn('h-3.5 w-3.5 flex-shrink-0', LANG_COLORS[file.language] ?? LANG_COLORS.text)} />
                    <span className="flex-1 text-xs truncate">{file.name}</span>
                    <button onClick={e => deleteFile(file, e)} className="hidden group-hover:block p-0.5 hover:text-rose-400 transition-colors">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))
              }
            </div>
            <button onClick={() => setSide(false)} className="px-3 py-2 text-[0.65rem] text-[color:var(--sidebar-foreground)]/40 hover:text-[color:var(--sidebar-foreground)] border-t border-[color:var(--sidebar-border)] transition-colors text-left">
              Hide Explorer
            </button>
          </div>
        )}

        {/* Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!sideOpen && (
            <button onClick={() => setSide(true)} className="px-3 py-1 text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] border-b border-[color:var(--border)] transition-colors text-left">
              Show Explorer
            </button>
          )}

          {!active ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
              <Code2 className="h-16 w-16 text-[color:var(--muted-foreground)]/20" />
              <div>
                <p className="font-bold text-lg mb-1">{project?.title ?? 'Workspace'}</p>
                <p className="text-sm text-[color:var(--muted-foreground)] mb-4">Select a file from the explorer or create a new one.</p>
                <Button size="sm" onClick={() => setShowNew(true)}><Plus className="h-4 w-4" /> New File</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 overflow-hidden">
              {/* Line numbers */}
              <div className="w-11 flex-shrink-0 bg-[color:var(--sidebar)]/50 border-r border-[color:var(--border)] overflow-y-auto py-3 select-none scrollbar-hide">
                {Array.from({ length: lineNums }, (_, i) => (
                  <div key={i} className="text-right pr-2.5 text-xs text-[color:var(--muted-foreground)]/40 font-mono leading-6">{i + 1}</div>
                ))}
              </div>
              {/* Text editor */}
              <textarea ref={textRef} value={content}
                onChange={e => { setContent(e.target.value); setSaved(false) }}
                onKeyDown={handleKeyDown}
                spellCheck={false} autoCapitalize="off" autoCorrect="off"
                className="flex-1 bg-[color:var(--background)] text-[color:var(--foreground)] text-sm font-mono leading-6 p-3 resize-none outline-none border-none overflow-auto"
                style={{ tabSize: 2 }} />
            </div>
          )}

          {/* Status bar */}
          <div className="flex items-center justify-between px-4 py-1 bg-[color:var(--sidebar)] border-t border-[color:var(--sidebar-border)] text-xs text-[color:var(--sidebar-foreground)]/50 flex-shrink-0">
            <div className="flex items-center gap-4">
              {active && <span className={LANG_COLORS[active.language] ?? LANG_COLORS.text}>{active.language}</span>}
              <span>UTF-8</span>
            </div>
            <div className="flex items-center gap-4">
              {active && <><span>Ln {lineNums}</span><span>{content.length} chars</span></>}
              <span className="text-emerald-400 font-medium">Live</span>
            </div>
          </div>

          {/* Terminal */}
          {termOpen && (
            <div className="border-t border-[color:var(--sidebar-border)] bg-[color:var(--sidebar)] flex flex-col flex-shrink-0" style={{ height: 180 }}>
              <div className="flex items-center justify-between px-4 py-1.5 border-b border-[color:var(--sidebar-border)]">
                <span className="text-[0.65rem] font-semibold text-[color:var(--sidebar-foreground)]/50 uppercase tracking-wider">Terminal</span>
                <button onClick={() => setTerm(false)}><X className="h-3.5 w-3.5 text-[color:var(--sidebar-foreground)]/40 hover:text-[color:var(--sidebar-foreground)]" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 font-mono text-xs text-[color:var(--sidebar-foreground)]/80 space-y-0">
                {termLines.map((line, i) => <div key={i} className={cn('leading-5', line.startsWith('$') && 'text-[color:var(--primary)]')}>{line || '\u00A0'}</div>)}
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 border-t border-[color:var(--sidebar-border)]">
                <span className="text-[color:var(--primary)] font-mono text-xs">$</span>
                <input value={termInput} onChange={e => setTermInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') runTerminal(termInput) }}
                  placeholder="Type a command…"
                  className="flex-1 bg-transparent text-xs font-mono text-[color:var(--sidebar-foreground)] outline-none placeholder:text-[color:var(--sidebar-foreground)]/30" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


