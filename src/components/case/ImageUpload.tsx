import { useRef, useState } from 'react'
import { apiUpload } from '../../lib/api'
import { Avatar } from './CaseParts'

const MAX_BYTES = 2 * 1024 * 1024

// Pick and upload a profile picture or logo (PNG, JPEG or WebP, 2 MB max)
export function ImageUpload({ label, url, name, uploadPath, field, square = false, onUploaded, onRemove }: {
  label: string
  url: string | null
  name: string
  uploadPath: string
  field: 'avatar_url' | 'logo_url'
  square?: boolean
  onUploaded: (url: string) => void
  onRemove?: () => Promise<void>
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const choose = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Please choose a PNG, JPEG or WebP image')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('That image is over 2 MB. Please choose a smaller one.')
      return
    }
    setBusy(true)
    try {
      const res = await apiUpload<Record<string, string>>(uploadPath, file)
      onUploaded(res[field])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="image-upload">
      <Avatar url={url} name={name} size={72} square={square} />
      <div>
        <div className="image-upload-label">{label}</div>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => choose(e.target.files?.[0])} />
        <button type="button" className="btn btn-secondary btn-small" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? 'Uploading...' : url ? 'Change' : 'Upload'}
        </button>
        {url && onRemove && (
          <> <button type="button" className="btn-link" disabled={busy} onClick={() => { setBusy(true); onRemove().finally(() => setBusy(false)) }}>Remove</button></>
        )}
        <div className="form-note">PNG, JPEG or WebP, up to 2 MB. Shown to homeowners.</div>
        {error && <div className="error-message">{error}</div>}
      </div>
    </div>
  )
}
