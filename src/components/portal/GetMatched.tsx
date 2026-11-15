import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMatch } from '../../hooks/useMatch'
import type { DirectoryEntry } from '../../hooks/useMatch'
import { useMyInfo } from '../../hooks/useMyInfo'
import type { TeamContact } from '../../hooks/useMyInfo'
import { apiPost } from '../../lib/api'
import { categoryLabels } from '../../lib/constants'
import type { Category } from '../../lib/constants'
import { FindProfessional } from './FindProfessional'
import { MyCase } from './MyCase'
import { TeamContacts } from './TeamContacts'

const CATEGORIES: Category[] = ['real_estate', 'legal']

// /portal/match — "My Professionals": one SonderBe case per category (real estate, legal),
// plus the homeowner's own record of their lawyer
export function GetMatched() {
  const { cases, consentText, loading, error, chooseProfessional, withdraw, markSent, reload, sendNote, markNotesRead } = useMatch()
  const myInfo = useMyInfo()
  const [finding, setFinding] = useState<Category | null>(null)

  // Choosing someone swaps the directory for the case: start at the top
  const activeCount = cases.filter(c => c.request.status === 'claimed').length
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [activeCount])

  if (loading || myInfo.loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    )
  }

  if (error || myInfo.error) {
    return (
      <div className="get-matched">
        <div className="error-message">{error || myInfo.error}</div>
        <button className="btn btn-secondary" onClick={() => { reload(); myInfo.reload() }}>Retry</button>
      </div>
    )
  }

  const team = myInfo.data?.team ?? []
  const defaultCounty = myInfo.data?.info?.property_county ?? cases.find(c => c.request.county)?.request.county ?? ''

  const addToTeam = async (pro: DirectoryEntry) => {
    const saved = await apiPost<TeamContact>('/me/team', {
      role: 'attorney', directory_profile_id: pro.id, name: pro.full_name || pro.business_name,
      firm: pro.business_name, phone: pro.phone ?? null, email: pro.email ?? null, status: 'contacted'
    })
    myInfo.patch(d => ({ ...d, team: [...d.team, saved] }))
  }

  const choose = async (input: Parameters<typeof chooseProfessional>[0]) => {
    await chooseProfessional(input)
    setFinding(null)
  }

  return (
    <div className="get-matched">
      <div className="page-header">
        <h1>My Professionals</h1>
        <p>
          You can work with a real estate professional (for example, to sell through a short sale) and get legal help
          (for example, a lawyer to stop or slow a foreclosure) at the same time. It's free for homeowners.
        </p>
      </div>

      <div className="dashboard-card warning-card">
        <strong>Never pay anyone upfront for foreclosure help.</strong> In California it is illegal to charge you
        before the work is done. SonderBe lists professionals A–Z and does not recommend or guarantee any of them.
      </div>

      {myInfo.data && !myInfo.data.info?.property_street && (
        <div className="dashboard-card info-nudge">
          <strong>Save time:</strong> fill in <Link to="/portal/info">My Information</Link> once (address, household,
          hardship) and your professionals can build your document list and hardship letter from it.
        </div>
      )}

      {CATEGORIES.map(category => {
        const current = cases.find(c => c.category === category)
        const active = current && current.request.status === 'claimed' ? current : null
        return (
          <div key={category} className="category-block">
            {active ? (
              <MyCase caseData={active} markSent={markSent} withdraw={withdraw} sendNote={sendNote} markNotesRead={markNotesRead} />
            ) : finding === category ? (
              <div className="dashboard-card">
                <FindProfessional
                  category={category}
                  previous={current?.request ?? null}
                  defaultCounty={defaultCounty}
                  consentText={consentText}
                  onChoose={choose}
                  onCancel={() => setFinding(null)}
                  onAddToTeam={category === 'legal' ? addToTeam : undefined}
                  teamDirectoryIds={team.map(t => t.directory_profile_id).filter((x): x is string => Boolean(x))}
                />
              </div>
            ) : (
              <div className="dashboard-card">
                <div className="case-kicker">{categoryLabels[category]}</div>
                <p>
                  {category === 'real_estate'
                    ? 'A real estate agent or broker can sell your home through a short sale, so the sale closes before a foreclosure.'
                    : 'Find a foreclosure attorney or a legal document assistant in your county.'}
                </p>
                <button className="btn btn-primary btn-small" onClick={() => setFinding(category)}>
                  {category === 'real_estate' ? 'Find a real estate professional' : 'Find legal help'}
                </button>
              </div>
            )}

            {category === 'legal' && (
              <div className="dashboard-card">
                <div className="card-header"><h2>My lawyer</h2></div>
                <TeamContacts team={team} onChanged={t => myInfo.patch(d => ({ ...d, team: t }))} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
