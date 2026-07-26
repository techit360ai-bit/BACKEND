import { readDb, writeDb } from '../config/database.js'
import { createId, nowIso } from '../utils/api.js'

const VIDEO_CDN_BASE = process.env.VIDEO_CDN_BASE || 'https://test-cdn.techit.dev/videos'

export function listVideoLessons(req, res) {
  const db = readDb()
  const lessons = (db.videoLessons || [])
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map(lesson => ({
      ...lesson,
      videoUrl: `${VIDEO_CDN_BASE}/${lesson.videoKey || lesson.id}.mp4`,
      thumbnailUrl: `${VIDEO_CDN_BASE}/thumbnails/${lesson.videoKey || lesson.id}.jpg`,
    }))
  const progress = (db.videoProgress || []).filter(p => p.userId === req.user.id)
  return res.json({ lessons, progress })
}

export function getVideoLesson(req, res) {
  const db = readDb()
  const lesson = (db.videoLessons || []).find(l => l.id === req.params.id)
  if (!lesson) return res.status(404).json({ error: 'Lesson not found' })
  const userProgress = (db.videoProgress || []).find(p => p.userId === req.user.id && p.lessonId === lesson.id)
  return res.json({
    lesson: {
      ...lesson,
      videoUrl: `${VIDEO_CDN_BASE}/${lesson.videoKey || lesson.id}.mp4`,
      thumbnailUrl: `${VIDEO_CDN_BASE}/thumbnails/${lesson.videoKey || lesson.id}.jpg`,
    },
    progress: userProgress || null,
  })
}

export function createVideoLesson(req, res) {
  const db = readDb()
  const title = String(req.body.title || '').trim()
  if (!title) return res.status(400).json({ error: 'Title is required' })

  const lesson = {
    id: createId('vlesson'),
    title,
    description: String(req.body.description || '').trim(),
    videoKey: String(req.body.videoKey || '').trim(),
    duration: Number(req.body.duration) || 0,
    category: String(req.body.category || 'general').trim(),
    order: Number(req.body.order) || (db.videoLessons || []).length,
    createdBy: req.user.id,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  if (!db.videoLessons) db.videoLessons = []
  db.videoLessons.push(lesson)
  writeDb(db)
  return res.status(201).json({
    lesson: {
      ...lesson,
      videoUrl: `${VIDEO_CDN_BASE}/${lesson.videoKey || lesson.id}.mp4`,
      thumbnailUrl: `${VIDEO_CDN_BASE}/thumbnails/${lesson.videoKey || lesson.id}.jpg`,
    },
  })
}

export function markVideoProgress(req, res) {
  const db = readDb()
  if (!db.videoProgress) db.videoProgress = []
  const existing = db.videoProgress.find(p => p.userId === req.user.id && p.lessonId === req.params.id)
  if (existing) {
    existing.watchedAt = nowIso()
    existing.progress = Math.min(100, Number(req.body.progress) || 100)
  } else {
    db.videoProgress.push({
      id: createId('vprog'),
      userId: req.user.id,
      lessonId: req.params.id,
      progress: Math.min(100, Number(req.body.progress) || 100),
      watchedAt: nowIso(),
    })
  }
  writeDb(db)
  return res.json({ ok: true })
}
