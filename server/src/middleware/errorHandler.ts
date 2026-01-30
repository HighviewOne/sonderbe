import type { Request, Response, NextFunction } from 'express'
import multer from 'multer'

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  // Multer file size error
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: 'File too large' })
    return
  }

  // JSON parse error (bad request body)
  if ((err as any).type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Invalid JSON' })
    return
  }

  console.error('Unhandled error:', err)
  res.status(500).json({ error: 'Internal server error' })
}
