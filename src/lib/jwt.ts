type AccessTokenClaims = {
  sub: string
  is_super_user: boolean
  // Seconds since epoch (standard JWT `exp`) - drives the proactive refresh
  // schedule in AuthContext, not used for any security decision here.
  exp: number
}

// Reads claims out of our own already-trusted access token - no signature
// verification needed here, the token only ever comes from a login/refresh
// response over HTTPS from urs-backend itself. Used only to gate UI
// visibility (e.g. hide the admin page from non-super-users) - the actual
// security boundary is server-side (requireSuperUser), this is UX only.
export function decodeAccessTokenClaims(token: string): AccessTokenClaims | null {
  try {
    const payload = token.split('.')[1]
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const claims = JSON.parse(json)
    if (typeof claims.sub !== 'string' || typeof claims.exp !== 'number') return null
    return { sub: claims.sub, is_super_user: Boolean(claims.is_super_user), exp: claims.exp }
  } catch {
    return null
  }
}
