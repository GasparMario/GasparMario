import Link from "next/link";

export function Header() {
  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <Link href="/" className="brand">
          dtf-manager
        </Link>
        <nav className="nav-links">
          <Link href="/">Artes</Link>
          <Link href="/upload">Upload</Link>
        </nav>
      </div>
    </header>
  );
}
