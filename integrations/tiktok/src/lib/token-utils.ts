export function buildTokenTimestamps(
  expiresIn: number,
  refreshExpiresIn: number,
): { expiresAt: string; refreshTokenExpiresAt: string } {
  const now = Date.now()
  return {
    expiresAt: new Date(now + expiresIn * 1000).toISOString(),
    refreshTokenExpiresAt: new Date(
      now + refreshExpiresIn * 1000,
    ).toISOString(),
  }
}
