import { Link, NavLink } from 'react-router-dom'
import logo from '../assets/logo-128.png'

function ListIcon() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 4h14v16l-2.3-1.6L14.3 20 12 18.4 9.7 20l-2.4-1.6L5 20V4Zm3 4v2h8V8H8Zm0 4v2h8v-2H8Z" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z" />
    </svg>
  )
}

export function Navbar() {
  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="brand">
          <img src={logo} alt="" width="46" height="46" />
          <span>Trip Splitter</span>
        </Link>
        <nav aria-label="Main">
          <ul className="nav-links">
            <li>
              <NavLink to="/" end>
                <ListIcon />
                Expenses
              </NavLink>
            </li>
            <li>
              <NavLink to="/expenses/new">
                <PlusIcon />
                Add expense
              </NavLink>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  )
}
