import { useEffect } from 'react'
import { useMatch } from '../../hooks/useMatch'
import { FindProfessional } from './FindProfessional'
import { MyCase } from './MyCase'

// /portal/match — the homeowner's directory (no active case) or their case (once they chose someone)
export function GetMatched() {
  const {
    request, professional, events, documents, consentText,
    loading, error, chooseProfessional, withdraw, markSent, reload
  } = useMatch()

  // Choosing a professional swaps the directory for the case view: start it at the top
  const status = request?.status
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [status])

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="get-matched">
        <div className="error-message">{error}</div>
        <button className="btn btn-secondary" onClick={reload}>Retry</button>
      </div>
    )
  }

  if (request?.status === 'claimed') {
    return (
      <MyCase
        request={request}
        professional={professional}
        events={events}
        documents={documents}
        markSent={markSent}
        withdraw={withdraw}
      />
    )
  }

  return <FindProfessional previous={request} consentText={consentText} onChoose={chooseProfessional} />
}
