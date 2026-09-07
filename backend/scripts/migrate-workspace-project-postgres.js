import { closeWorkspaceProjectProjection, initializeWorkspaceProjectProjection } from '../src/services/workspaceProjectPostgresProjection.js'

if (!process.env.WORKSPACE_DATABASE_URL && !process.env.DATABASE_URL) throw new Error('WORKSPACE_DATABASE_URL or DATABASE_URL is required')
try { console.log(JSON.stringify({ event: 'workspace_project_postgres_migrated', ...(await initializeWorkspaceProjectProjection()) })) } finally { await closeWorkspaceProjectProjection() }
