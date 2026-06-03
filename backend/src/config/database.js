import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '../../data')
const DB_PATH = path.join(DATA_DIR, 'db.json')

const INITIAL = { users: [], profiles: [], otps: [] }

export function readDb() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(DB_PATH, JSON.stringify(INITIAL, null, 2))
    return structuredClone(INITIAL)
  }
  const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'))
  // Migrate older db files that don't have otps array
  if (!data.otps) data.otps = []
  return data
}

export function writeDb(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2))
}
