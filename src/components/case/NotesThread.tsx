import { useState } from 'react'
import type { FormEvent } from 'react'
import type { CaseNote } from '../../hooks/useMatch'

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

// A conversation between the homeowner and their professional, about the case or one document
export function NotesThread({ notes, viewer, otherName, onSend, placeholder, compact = false }: {
  notes: CaseNote[]
  viewer: 'homeowner' | 'professional'
  otherName: string
  onSend: (body: string) => Promise<void>
  placeholder?: string
  compact?: boolean
}) {
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!body.trim()) return
    setBusy(true)
    setError(null)
    try {
      await onSend(body.trim())
      setBody('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`notes-thread ${compact ? 'compact' : ''}`}>
      {notes.length > 0 && (
        <ul className="notes-list">
          {notes.map(n => {
            const mine = n.author_role === viewer
            return (
              <li key={n.id} className={`note ${mine ? 'mine' : 'theirs'}`}>
                <div className="note-meta">{mine ? 'You' : otherName} · {when(n.created_at)}</div>
                <div className="note-body">{n.body}</div>
              </li>
            )
          })}
        </ul>
      )}
      <form className="note-form" onSubmit={submit}>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          maxLength={2000}
          rows={compact ? 1 : 2}
          placeholder={placeholder ?? `Write a note to ${otherName}`}
          aria-label={placeholder ?? `Note to ${otherName}`}
        />
        <button type="submit" className="btn btn-secondary btn-small" disabled={busy || !body.trim()}>
          {busy ? 'Sending...' : 'Send'}
        </button>
      </form>
      {error && <div className="error-message">{error}</div>}
    </div>
  )
}
