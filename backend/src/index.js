// Express app setup

import express from 'express'
import { mountTechitApi } from '../../Plugins-MCP/server/mount.ts'

const app = express()
const PORT = 3000;

app.use(express.json())

// Allow the Vite frontend (different origin) to call the API during dev.
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Headers', 'Content-Type')
    res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    if (req.method === 'OPTIONS') return res.sendStatus(204)
    next()
})

app.get('/', (req, res) => {
    res.end('Server is running on port 3000!')
})

// Mount the TechIT plugin/MCP API: /api/tools, /api/audit, /api/contributions,
// /api/approvals, POST /api/invoke, POST /api/approvals/:id/approve
await mountTechitApi(app, '/api')

app.listen(PORT, () => {
    console.log(`Server is running on PORT ${PORT}`)
    console.log(`TechIT API mounted at http://localhost:${PORT}/api`)
})
