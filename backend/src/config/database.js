import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '../../data')
const DB_PATH = path.join(DATA_DIR, 'db.json')

const INITIAL = {
  users: [],
  profiles: [],
  otps: [],
  notifications: [],
  files: [],
  mentorshipRooms: [],
  mentorshipMentees: [],
  mentorshipTasks: [],
  mentorshipApplications: [],
  mentorshipMessages: [],
  feedPosts: [],
  feedComments: [],
  feedLikes: [],
  haviThreads: [],
}

export function readDb() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(DB_PATH, JSON.stringify(INITIAL, null, 2))
    return structuredClone(INITIAL)
  }
  const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'))
  // Migrate older db files that do not yet have newer collections.
  for (const [key, value] of Object.entries(INITIAL)) {
    if (!Array.isArray(data[key])) data[key] = structuredClone(value)
  }
  return data
}

export function writeDb(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2))
}
