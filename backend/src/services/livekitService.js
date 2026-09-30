// LiveKit access-token minting for real workspace audio/video calls.
//
// The Go messaging service hosts the LiveKit rooms (internal/livekit/service.go)
// but it does not own workspace membership. The platform backend owns that
// authority, so it authorizes the caller and mints the participant token here,
// using the same LIVEKIT_API_KEY/SECRET/URL as the messaging service.
//
// Tokens are plain HS256 JWTs with the LiveKit `video` grant — no SDK needed.

import jwt from 'jsonwebtoken'

const apiKey = () => process.env.LIVEKIT_API_KEY || ''
const apiSecret = () => process.env.LIVEKIT_API_SECRET || ''
const serverUrl = () => process.env.LIVEKIT_URL || ''

export function livekitEnabled() {
  return Boolean(apiKey() && apiSecret() && serverUrl())
}

export function livekitUrl() {
  return serverUrl()
}

export function livekitRoomName(workspaceId) {
  return `workspace-${String(workspaceId)}`
}

export function mintLivekitToken({ room, identity, canPublish = true, ttlSeconds = 3600 }) {
  if (!livekitEnabled()) throw new Error('livekit_not_configured')
  if (!room || !identity) throw new Error('livekit_room_and_identity_required')
  const now = Math.floor(Date.now() / 1000)
  const ttl = Math.max(60, Math.min(Number(ttlSeconds) || 3600, 6 * 3600))
  // LiveKit reads the signing key from `iss` and the participant from `sub`.
  const payload = {
    iss: apiKey(),
    sub: String(identity),
    nbf: now - 10,
    iat: now,
    exp: now + ttl,
    video: {
      room: String(room),
      roomJoin: true,
      canPublish: Boolean(canPublish),
      canSubscribe: true,
      canPublishData: true,
    },
  }
  return jwt.sign(payload, apiSecret(), { algorithm: 'HS256', noTimestamp: true })
}
