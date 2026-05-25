import { Grid3X3, Image, Layers3 } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

const navigation = [
  { to: "/generator", label: "Generator", icon: Image },
  { to: "/depth-painter", label: "Depth Painter", icon: Layers3 },
  { to: "/pattern-maker", label: "Pattern Maker", icon: Grid3X3 },
];

export function AppLayout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="/" aria-label="MagicEyeLab home">
          <span className="brand-mark" aria-hidden="true">
            M
          </span>
          <span>
            <strong>MagicEyeLab</strong>
            <small>Local stereogram studio</small>
          </span>
        </a>

        <nav className="primary-nav" aria-label="Primary navigation">
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to}>
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
