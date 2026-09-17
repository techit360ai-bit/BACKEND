# TechIT Code Bridge

The bridge exposes one explicitly selected project directory to an authorized TechIT Workspace session. It does not expose a shell, follow symlinks, read secret-like paths, or access files outside that root.

```bash
npm install -g @techit/code-bridge
techit-code connect --api https://api.techit.network --grant ONE_TIME_GRANT --root ./my-project
techit-code open --workspace WORKSPACE_ID
techit-code serve --workspace WORKSPACE_ID
```

Bridge grants expire after 15 minutes and can be exchanged once. Bridge sessions expire after eight hours and can be revoked from TechIT. Local session files are stored under `~/.techit/code-bridge` with owner-only permissions.
