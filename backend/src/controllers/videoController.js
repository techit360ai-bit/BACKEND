import { readAuthorityDb, writeAuthorityDb } from '../config/database.js'
import { createId, nowIso } from '../utils/api.js'
import { videoStoreEnabled, videoFallbackEnabled, runVideoRead, applyVideoMutation } from '../repositories/videoRepository.js'

const VIDEO_CDN_BASE = process.env.VIDEO_CDN_BASE || 'https://test-cdn.techit.dev/videos'

const lessonView = lesson => ({
  ...lesson,
  videoUrl: `${VIDEO_CDN_BASE}/${lesson.videoKey || lesson.id}.mp4`,
  thumbnailUrl: `${VIDEO_CDN_BASE}/thumbnails/${lesson.videoKey || lesson.id}.jpg`,
})

// Row-level wrappers: the sync helpers below read/write the request authority,
// which is the bounded bundle inside runVideoRead/applyVideoMutation and the
// snapshot otherwise. On failure (and while the SQLite fallback is enabled) they
// re-run against the snapshot.
async function videoRead(userId, read) {
  if (!videoStoreEnabled()) return read()
  try { return await runVideoRead(userId, read) } catch (error) {
    console.error(JSON.stringify({ event: 'video_postgres_read_failed', error: error.message }))
    if (!videoFallbackEnabled()) throw error
    return read()
  }
}
async function videoWrite(userId, mutate) {
  if (!videoStoreEnabled()) return mutate()
  try { return await applyVideoMutation(userId, mutate) } catch (error) {
    console.error(JSON.stringify({ event: 'video_postgres_write_failed', error: error.message }))
    if (!videoFallbackEnabled()) throw error
    return mutate()
  }
}

function listPayload(userId) {
  const db = readAuthorityDb()
  const lessons = (db.videoLessons || []).sort((a, b) => (a.order || 0) - (b.order || 0)).map(lessonView)
  const progress = (db.videoProgress || []).filter(p => p.userId === userId)
  return { lessons, progress }
}

function lessonPayload(userId, lessonId) {
  const db = readAuthorityDb()
  const lesson = (db.videoLessons || []).find(l => l.id === lessonId)
  if (!lesson) return null
  const userProgress = (db.videoProgress || []).find(p => p.userId === userId && p.lessonId === lesson.id)
  return { lesson: lessonView(lesson), progress: userProgress || null }
}

function createLesson(body, actorId) {
  const db = readAuthorityDb()
  const title = String(body.title || '').trim()
  if (!title) return { error: 'Title is required' }
  const lesson = {
    id: createId('vlesson'),
    title,
    description: String(body.description || '').trim(),
    videoKey: String(body.videoKey || '').trim(),
    duration: Number(body.duration) || 0,
    category: String(body.category || 'general').trim(),
    order: Number(body.order) || (db.videoLessons || []).length,
    createdBy: actorId,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  if (!db.videoLessons) db.videoLessons = []
  db.videoLessons.push(lesson)
  writeAuthorityDb(db)
  return { lesson: lessonView(lesson) }
}

function markProgress(body, lessonId, userId) {
  const db = readAuthorityDb()
  if (!db.videoProgress) db.videoProgress = []
  const existing = db.videoProgress.find(p => p.userId === userId && p.lessonId === lessonId)
  if (existing) {
    existing.watchedAt = nowIso()
    existing.progress = Math.min(100, Number(body.progress) || 100)
  } else {
    db.videoProgress.push({
      id: createId('vprog'),
      userId,
      lessonId,
      progress: Math.min(100, Number(body.progress) || 100),
      watchedAt: nowIso(),
    })
  }
  writeAuthorityDb(db)
  return { ok: true }
}

export async function listVideoLessons(req, res) {
  return res.json(await videoRead(req.user.id, () => listPayload(req.user.id)))
}

export async function getVideoLesson(req, res) {
  const payload = await videoRead(req.user.id, () => lessonPayload(req.user.id, req.params.id))
  if (!payload) return res.status(404).json({ error: 'Lesson not found' })
  return res.json(payload)
}

export async function createVideoLesson(req, res) {
  if (!String(req.body.title || '').trim()) return res.status(400).json({ error: 'Title is required' })
  const result = await videoWrite(req.user.id, () => createLesson(req.body, req.user.id))
  if (result.error) return res.status(400).json({ error: result.error })
  return res.status(201).json({ lesson: result.lesson })
}

export async function markVideoProgress(req, res) {
  return res.json(await videoWrite(req.user.id, () => markProgress(req.body, req.params.id, req.user.id)))
}
