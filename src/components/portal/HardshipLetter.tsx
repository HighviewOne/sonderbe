import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMyInfo } from '../../hooks/useMyInfo'
import type { MyInfo } from '../../hooks/useMyInfo'
import { hardshipReasons, incomeLabel } from '../../lib/constants'

type Goal = 'modification' | 'short_sale' | 'more_time'
const GOALS: { value: Goal; label: string; sentence: string }[] = [
  { value: 'modification', label: 'Keep my home (loan modification)', sentence: 'I want to keep my home, and I am asking you to review me for a loan modification or another option that makes my payment affordable.' },
  { value: 'short_sale', label: 'Sell my home (short sale)', sentence: 'I am no longer able to keep my home, and I am asking you to approve a short sale so I can sell it and avoid foreclosure.' },
  { value: 'more_time', label: 'More time (postpone the sale)', sentence: 'I am asking you to postpone any foreclosure sale while you review my request for help.' }
]

// Relationship wording for a letter ("my child Jalen", not the form label "Son or daughter")
const LETTER_RELATION: Record<string, string> = {
  spouse: 'my spouse', partner: 'my partner', child: 'my child', parent: 'my parent',
  relative: 'my relative', roommate: 'my roommate', other: ''
}

const joinList = (items: string[]) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`

function draftLetter(d: MyInfo, goal: Goal) {
  const i = d.info
  const name = d.profile.full_name || '[Your name]'
  const today = new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
  const address = i?.property_street
    ? `${i.property_street}${i.property_unit ? ` ${i.property_unit}` : ''}, ${i.property_city ?? ''}, CA ${i.property_zip ?? ''}`
    : '[Property address]'
  const reasons = (i?.hardship_reasons ?? []).map(r => hardshipReasons.find(h => h.value === r)?.letter).filter(Boolean) as string[]
  const reasonSentence = reasons.length
    ? `I am writing to explain why I have fallen behind on my mortgage payments. I ${joinList(reasons)}.`
    : 'I am writing to explain why I have fallen behind on my mortgage payments. [Say what happened.]'
  const others = d.household.filter(m => !m.is_self)
  const householdSentence = others.length
    ? `I live in the home with ${joinList(others.map(m => `${LETTER_RELATION[m.relationship] ?? ''} ${m.full_name}`.trim()))}.`
    : ''
  const earners = d.household.filter(m => m.income_types.length > 0)
  const incomeSentence = earners.length
    ? `Our household income now comes from ${joinList(earners.map(m => `${m.is_self ? 'my' : `${m.full_name.split(' ')[0]}'s`} ${joinList(m.income_types.map(t => incomeLabel(t).toLowerCase().replace(/ \(.*\)/, '')))}`))}.`
    : ''
  const details = i?.hardship_details?.trim() ? i.hardship_details.trim() : '[Add when it happened and how much your income changed.]'

  return [
    today,
    '',
    name,
    address,
    `Loan number: ____________`,
    '',
    `To ${i?.servicer_name || 'my mortgage servicer'}:`,
    '',
    `${reasonSentence} ${details}`,
    '',
    [householdSentence, incomeSentence].filter(Boolean).join(' ') || '[Who lives in the home and where your income comes from now.]',
    '',
    `${GOALS.find(g => g.value === goal)!.sentence} I have included the documents you need, and I will respond quickly to any request for more information.`,
    '',
    'Thank you for your time and consideration.',
    '',
    'Sincerely,',
    '',
    '',
    '______________________________',
    `${name}          Date: ____________`
  ].join('\n')
}

// Drafts the hardship letter from My Information; the homeowner edits, prints or copies it
export function HardshipLetter() {
  const { data, loading, error } = useMyInfo()
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    )
  }
  if (error || !data) return <div className="error-message">{error}</div>
  return <LetterEditor data={data} />
}

function LetterEditor({ data }: { data: MyInfo }) {
  // No default goal: the letter shouldn't assume the homeowner can or can't keep the home
  const [goal, setGoal] = useState<Goal | ''>('')
  const [text, setText] = useState('')
  const [edited, setEdited] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)

  const changeGoal = (g: Goal | '') => {
    setGoal(g)
    if (g && !edited) setText(draftLetter(data, g))
  }

  const copy = async () => {
    setCopyError(null)
    if (!text.trim()) {
      setCopied(false)
      setCopyError('The letter is empty, so there is nothing to copy.')
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const missing = !data.info?.hardship_reasons.length || !data.info.property_street

  return (
    <div className="hardship-letter">
      <div className="page-header">
        <h1>Hardship Letter</h1>
        <p>
          Your lender asks for a short letter explaining what happened. We drafted one from{' '}
          <Link to="/portal/info">My Information</Link>. Read it, change anything that isn't right, then print and sign it.
        </p>
      </div>

      {missing && (
        <div className="dashboard-card info-nudge">
          Some parts are in [brackets] because they're missing from <Link to="/portal/info">My Information</Link>.
          Fill them in there, or type them here.
        </div>
      )}

      <div className="dashboard-card no-print">
        <div className="form-group">
          <label htmlFor="hl-goal">What are you asking for?</label>
          <select id="hl-goal" value={goal} onChange={e => changeGoal(e.target.value as Goal | '')}>
            <option value="" disabled>Choose one</option>
            {GOALS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </div>
        {edited && goal && (
          <button type="button" className="btn-link" onClick={() => { setText(draftLetter(data, goal)); setEdited(false) }}>
            Start over from my information
          </button>
        )}
      </div>

      {!goal ? (
        <div className="dashboard-card">
          <p>Choose what you're asking your lender for, and we'll draft the letter. Not sure? Your professional can help you decide.</p>
        </div>
      ) : (
      <div className="dashboard-card">
        <label htmlFor="hl-text" className="no-print">Your letter (you can edit it)</label>
        <textarea
          id="hl-text"
          className="letter-text"
          value={text}
          rows={24}
          onChange={e => { setText(e.target.value); setEdited(true); setCopied(false); setCopyError(null) }}
        />
        <div className="letter-print" aria-hidden="true">{text}</div>
        <div className="save-row no-print">
          <button type="button" className="btn btn-primary btn-small" onClick={() => window.print()}>Print</button>
          <button type="button" className="btn btn-secondary btn-small" onClick={copy}>{copied ? '✓ Copied' : 'Copy text'}</button>
          {copyError && <div className="error-message" role="alert">{copyError}</div>}
        </div>
        <p className="form-note no-print">
          This letter isn't saved on SonderBe. Print it or copy it into an email to your professional.
        </p>
      </div>
      )}
    </div>
  )
}
