import { Link } from 'react-router-dom'
import logo from '../assets/logo-256.png'

export function NotFoundPage() {
  return (
    <section className="empty-page">
      <img src={logo} alt="" width="96" height="96" />
      <h1>Page not found</h1>
      <p className="subtitle">That page does not exist, or it has been moved.</p>
      <Link to="/" className="button primary">
        Back to Expenses
      </Link>
    </section>
  )
}
