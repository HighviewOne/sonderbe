import type { Response } from 'express'
import { supabaseAdmin } from './config.js'
import type { AuthenticatedRequest } from './types.js'

const BUCKET = 'profile-images'

// Identify the image from its first bytes, not the client-supplied type or name
function sniffImage(buf: Buffer): { ext: string; mime: string } | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: 'png', mime: 'image/png' }
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' }
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return { ext: 'webp', mime: 'image/webp' }
  }
  return null
}

// Upload req.file to the public profile-images bucket under `${prefix}-<time>.<ext>`.
// Sends the error response itself and returns null on failure.
export async function uploadProfileImage(req: AuthenticatedRequest, res: Response, prefix: string): Promise<string | null> {
  const file = (req as AuthenticatedRequest & { file?: Express.Multer.File }).file
  if (!file) {
    res.status(400).json({ error: 'Please choose an image' })
    return null
  }
  const kind = sniffImage(file.buffer)
  if (!kind) {
    res.status(400).json({ error: 'Please upload a PNG, JPEG or WebP image' })
    return null
  }
  const path = `${prefix}-${Date.now()}.${kind.ext}`
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, file.buffer, {
    contentType: kind.mime, upsert: false,
    // Short CDN cache, so a photo someone removes stops loading within minutes (default is an hour)
    cacheControl: '300'
  })
  if (error) {
    console.error('Failed to upload image:', error)
    res.status(500).json({ error: 'Failed to upload the image' })
    return null
  }
  return supabaseAdmin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

// Delete an image we stored, from its public URL, once nothing points at it any more (a photo
// removed or replaced). Only paths under `prefix` are touched, so a URL can never reach another
// account's files. Best-effort: a failure is logged and never blocks the request.
export async function removeProfileImage(url: string | null | undefined, prefix: string): Promise<void> {
  if (!url) return
  const marker = `/object/public/${BUCKET}/`
  const at = url.indexOf(marker)
  if (at === -1) return
  const path = decodeURIComponent(url.slice(at + marker.length).split('?')[0])
  if (!path.startsWith(prefix) || path.includes('..')) return
  const { error } = await supabaseAdmin.storage.from(BUCKET).remove([path])
  if (error) console.error('Failed to delete old image:', error)
}
