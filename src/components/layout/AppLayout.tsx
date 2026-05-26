import { useEffect, useState } from "react";
import { mdiImageMultiple, mdiLayersTriple, mdiViewGrid } from "@mdi/js";
import { NavLink, Outlet } from "react-router-dom";
import { MdiIcon } from "../icons/MdiIcon";

const navigation = [
  { to: "/generator", label: "Generator", icon: mdiImageMultiple },
  { to: "/depth-painter", label: "Depth Painter", icon: mdiLayersTriple },
  { to: "/pattern-maker", label: "Pattern Maker", icon: mdiViewGrid },
];

export function AppLayout() {
  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    function updateHeaderState() {
      setHasScrolled(window.scrollY > 8);
    }

    updateHeaderState();
    window.addEventListener("scroll", updateHeaderState, { passive: true });

    return () => window.removeEventListener("scroll", updateHeaderState);
  }, []);

  return (
    <div className="app-shell">
      <header className={`app-header${hasScrolled ? " app-header-scrolled" : ""}`}>
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
          {navigation.map(({ to, label, icon }) => (
            <NavLink key={to} to={to}>
              <MdiIcon path={icon} />
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
