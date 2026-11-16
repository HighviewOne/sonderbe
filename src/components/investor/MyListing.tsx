import { useState, useEffect, useCallback } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiGet, apiPut } from '../../lib/api'
import { professionalTypes } from '../../lib/constants'
import type { ProfessionalType } from '../../lib/constants'
import { ProfessionalHeader } from '../case/CaseParts'
import { ImageUpload } from '../case/ImageUpload'
import { apiDelete } from '../../lib/api'

type Listing = {
  full_name: string | null
  phone: string | null
  business_name: string | null
  professional_type: ProfessionalType | null
  bio: string | null
  website: string | null
  license_number: string | null
  license_verified: boolean
  no_upfront_fee_pledged_at: string | null
  listed: boolean
  service_counties: string[]
  avatar_url: string | null
  brokerage_id: string | null
}

const LICENSED: ProfessionalType[] = ['agent', 'broker', 'attorney']

const PLEDGE_TEXT =
  'I will not charge any homeowner I meet through SonderBe a fee before my services are complete, ' +
  'I will not promise to stop a foreclosure, and I will tell homeowners plainly how I get paid.'

export function MyListing({ embedded = false }: { embedded?: boolean }) {
  const [listing, setListing] = useState<Listing | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // No synchronous setState here — it runs from the mount effect
  const fetchListing = useCallback(() => {
    apiGet<Listing>('/leads/profile')
      .then(res => {
        setListing(res)
        setError(null)
      })
      .catch(err => {
        console.error('Error loading listing:', err)
        setError('Failed to load your listing. Please refresh.')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchListing()
  }, [fetchListing])

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading your listing...</p>
      </div>
    )
  }
  if (error || !listing) return <div className="error-message">{error}</div>
  return <ListingForm listing={listing} onSaved={setListing} embedded={embedded} />
}

function ListingForm({ listing, onSaved, embedded }: { listing: Listing; onSaved: (l: Listing) => void; embedded: boolean }) {
  const [type, setType] = useState<ProfessionalType | ''>(listing.professional_type ?? '')
  const [businessName, setBusinessName] = useState(listing.business_name ?? '')
  const [bio, setBio] = useState(listing.bio ?? '')
  const [website, setWebsite] = useState(listing.website ?? '')
  const [license, setLicense] = useState(listing.license_number ?? '')
  const [pledge, setPledge] = useState(Boolean(listing.no_upfront_fee_pledged_at))
  const [listed, setListed] = useState(listing.listed)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(listing.avatar_url)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaved(false)
    if (!type) {
      setError('Please choose what kind of professional you are.')
      return
    }
    setSaving(true)
    try {
      const res = await apiPut<Listing>('/leads/profile', {
        professional_type: type, business_name: businessName, bio, website,
        license_number: license, pledge, listed
      })
      onSaved(res)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save your listing')
    } finally {
      setSaving(false)
    }
  }

  const licensed = type !== '' && LICENSED.includes(type)
  const preview = {
    full_name: listing.full_name,
    business_name: businessName || null,
    professional_type: (type || 'agent') as ProfessionalType,
    licensed_profession: licensed,
    license_verified: listing.license_verified && license === listing.license_number && type === listing.professional_type,
    license_number: license || null,
    avatar_url: avatarUrl
  }

  return (
    <div className="my-listing">
      {embedded ? (
        <h2 className="section-heading">Directory listing (public)</h2>
      ) : (
        <div className="page-header"><h1>My Listing</h1></div>
      )}
      <p>
        This is what homeowners see in the SonderBe directory. Listings appear A–Z by business name; placement
        can't be bought. Homeowners who choose you appear under <Link to="/investor/clients">Clients</Link>.
      </p>

      <div className="dashboard-card">
        <div className="card-header">
          <h2>Status</h2>
          <span className={`license-badge ${listing.listed ? 'verified' : 'pending'}`}>
            {listing.listed ? 'Published' : 'Not published'}
          </span>
        </div>
        <p>
          Counties: {listing.service_counties.length ? listing.service_counties.join(', ') : 'none yet'}{' '}
          (<Link to="/investor/clients">change on Clients</Link>)
        </p>
        {type === 'attorney' && (
          <p className="form-note">
            Attorneys are shown as directory listings only: homeowners contact you directly, and SonderBe does not
            send you their details. This is pending legal review of California's lawyer referral rules.
          </p>
        )}
      </div>

      <div className="dashboard-card">
        <ImageUpload
          label="Your photo or company logo"
          url={avatarUrl}
          name={listing.full_name || businessName || 'Professional'}
          uploadPath="/leads/avatar"
          field="avatar_url"
          onUploaded={setAvatarUrl}
          onRemove={async () => { await apiDelete('/leads/avatar'); setAvatarUrl(null) }}
        />
        {type === 'broker' && (
          <p className="form-note">Run a team? Set up your brokerage and invite your agents under <Link to="/investor/brokerage">My Brokerage</Link>.</p>
        )}
      </div>

      <form className="dashboard-card listing-form" onSubmit={handleSubmit}>

        <div className="form-group">
          <label htmlFor="listing-type">I am a</label>
          <select id="listing-type" value={type} onChange={e => setType(e.target.value as ProfessionalType | '')} required>
            <option value="">Choose one</option>
            {professionalTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="listing-business">Business name</label>
          <input id="listing-business" value={businessName} onChange={e => setBusinessName(e.target.value)} maxLength={120} required />
        </div>
        <div className="form-group">
          <label htmlFor="listing-bio">About you (what you do and how you're paid)</label>
          <textarea id="listing-bio" value={bio} onChange={e => setBio(e.target.value)} maxLength={600} rows={4} />
          <span className="form-note">{bio.length}/600</span>
        </div>
        <div className="form-group">
          <label htmlFor="listing-website">Website (optional)</label>
          <input id="listing-website" type="url" value={website} onChange={e => setWebsite(e.target.value)} maxLength={200}
            placeholder="https://" />
        </div>
        <div className="form-group">
          <label htmlFor="listing-license">
            {type === 'attorney' ? 'State Bar number' : type === 'agent' || type === 'broker' ? 'DRE license number' : 'License or registration number (optional)'}
          </label>
          <input id="listing-license" value={license} onChange={e => setLicense(e.target.value)} maxLength={40} required={licensed} />
          <span className="form-note">
            {licensed
              ? 'SonderBe checks this against state records before showing "License verified". Changing it resets verification.'
              : 'This profession is not licensed in California, so your listing will say "Not a state-licensed profession".'}
          </span>
        </div>

        <label className="consent-label">
          <input type="checkbox" checked={pledge} onChange={e => setPledge(e.target.checked)} />
          <span><strong>No-upfront-fee pledge:</strong> {PLEDGE_TEXT}</span>
        </label>
        <label className="consent-label">
          <input type="checkbox" checked={listed} onChange={e => setListed(e.target.checked)} />
          <span>Publish my listing in the homeowner directory</span>
        </label>

        <h3>Preview</h3>
        <div className="directory-card listing-preview">
          <ProfessionalHeader pro={preview} />
          {bio && <p className="pro-bio">{bio}</p>}
        </div>

        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save listing'}</button>
        {saved && <span className="form-note"> Saved.</span>}
        {error && <div className="error-message" role="alert">{error}</div>}
      </form>
    </div>
  )
}
