import { useEffect, useState } from "react";
import classNames from "classnames";
import { mdiImageMultiple, mdiLayersTriple, mdiViewGrid } from "@mdi/js";
import { NavLink, Outlet } from "react-router-dom";
import { MdiIcon } from "../icons/MdiIcon";
import styles from "./AppLayout.module.scss";

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
    <div className={styles.shell}>
      <header
        className={classNames(styles.header, {
          [styles.scrolled]: hasScrolled,
        })}
      >
        <a className={styles.brand} href="/" aria-label="MagicEyeLab home">
          <span className={styles.brandMark} aria-hidden="true">
            M
          </span>
          <span>
            <strong>MagicEyeLab</strong>
            <small>Local stereogram studio</small>
          </span>
        </a>

        <nav className={styles.primaryNav} aria-label="Primary navigation">
          {navigation.map(({ to, label, icon }) => (
            <NavLink key={to} to={to} className={styles.navLink}>
              <MdiIcon path={icon} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </header>

      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
