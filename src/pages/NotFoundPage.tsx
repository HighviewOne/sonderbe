import { Link } from 'react-router-dom'

// Unknown address. Inside a portal, `home` is that portal's dashboard and the portal keeps its own nav.
export function NotFoundPage({ home }: { home?: string }) {
  const body = (
    <div className="dashboard-card not-found">
      <h1>Page not found</h1>
      <p>We couldn't find that page. The link may be old or mistyped.</p>
      <Link to={home ?? '/'} className="btn btn-primary btn-small">
        {home ? 'Back to your dashboard' : 'Go to the home page'}
      </Link>
    </div>
  )
  return home ? body : <main className="not-found-page">{body}</main>
}
