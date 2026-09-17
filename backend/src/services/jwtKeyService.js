import jwt from 'jsonwebtoken'

const env = () => String(process.env.NODE_ENV || 'development').toLowerCase()
const production = () => ['production', 'staging'].includes(env())
const algorithm = () => String(process.env.JWT_ALGORITHM || (production() ? 'RS256' : 'HS256')).toUpperCase()

function keyPair() {
  const alg = algorithm()
  if (alg === 'HS256') {
    const secret = process.env.JWT_SECRET
    if (!secret) throw new Error('JWT_SECRET is required')
    if (production()) throw new Error('HS256 is not permitted in production/staging; configure RS256 keys')
    return { alg, signing: secret, verification: secret }
  }
  if (alg !== 'RS256') throw new Error(`Unsupported JWT_ALGORITHM: ${alg}`)
  const signing = process.env.JWT_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const verification = process.env.JWT_PUBLIC_KEY?.replace(/\\n/g, '\n')
  if (!verification || (production() && !signing)) throw new Error('JWT_PUBLIC_KEY and JWT_PRIVATE_KEY are required for RS256')
  return { alg, signing: signing || verification, verification }
}

export function signJwt(payload, options = {}) {
  const pair = keyPair()
  return jwt.sign(payload, pair.signing, { algorithm: pair.alg, ...options })
}

export function verifyJwt(token, options = {}) {
  const pair = keyPair()
  return jwt.verify(token, pair.verification, { algorithms: [pair.alg], ...options })
}

export function jwtAlgorithm() { return algorithm() }
