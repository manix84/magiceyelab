import { useEffect, useState, type ReactNode } from "react";
import classNames from "classnames";
import {
  mdiBrightnessAuto,
  mdiImageMultiple,
  mdiLayersTriple,
  mdiViewGrid,
  mdiWeatherNight,
  mdiWhiteBalanceSunny,
} from "@mdi/js";
import { Link, NavLink, Outlet } from "react-router-dom";
import logoUrl from "../../assets/magiceyelab-logo.svg";
import { MdiIcon } from "../icons/MdiIcon";
import styles from "./AppLayout.module.scss";

const navigation = [
  { to: "/generator", label: "Generator", icon: mdiImageMultiple },
  { to: "/depth-painter", label: "Depth Painter", icon: mdiLayersTriple },
  { to: "/pattern-maker", label: "Pattern Maker", icon: mdiViewGrid },
];
const themeStorageKey = "magiceyelab-theme";
const themeOptions = [
  { value: "light", label: "Light", icon: mdiWhiteBalanceSunny },
  { value: "dark", label: "Dark", icon: mdiWeatherNight },
  { value: "auto", label: "Auto", icon: mdiBrightnessAuto },
] as const;

type ThemeMode = (typeof themeOptions)[number]["value"];

function getStoredThemeMode(): ThemeMode {
  const storedMode =
    typeof window.localStorage.getItem === "function"
      ? window.localStorage.getItem(themeStorageKey)
      : null;

  return storedMode === "light" || storedMode === "dark" ? storedMode : "auto";
}

function storeThemeMode(themeMode: ThemeMode) {
  if (themeMode === "auto") {
    if (typeof window.localStorage.removeItem === "function") {
      window.localStorage.removeItem(themeStorageKey);
    }

    return;
  }

  if (typeof window.localStorage.setItem === "function") {
    window.localStorage.setItem(themeStorageKey, themeMode);
  }
}

type AppLayoutProps = {
  children?: ReactNode;
};

export function AppLayout({ children }: AppLayoutProps) {
  const [hasScrolled, setHasScrolled] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(getStoredThemeMode);

  useEffect(() => {
    function updateHeaderState() {
      setHasScrolled(window.scrollY > 8);
    }

    updateHeaderState();
    window.addEventListener("scroll", updateHeaderState, { passive: true });

    return () => window.removeEventListener("scroll", updateHeaderState);
  }, []);

  useEffect(() => {
    if (themeMode === "auto") {
      document.documentElement.removeAttribute("data-theme");
      storeThemeMode(themeMode);
      return;
    }

    document.documentElement.dataset.theme = themeMode;
    storeThemeMode(themeMode);
  }, [themeMode]);

  return (
    <div className={styles.shell}>
      <header
        className={classNames(styles.header, {
          [styles.scrolled]: hasScrolled,
        })}
      >
        <Link className={styles.brand} to="/" aria-label="MagicEyeLab home">
          <img className={styles.brandMark} src={logoUrl} alt="" aria-hidden="true" />
          <span>
            <strong>MagicEyeLab</strong>
            <small>Local stereogram studio</small>
          </span>
        </Link>

        <div className={styles.headerActions}>
          <nav className={styles.primaryNav} aria-label="Primary navigation">
            {navigation.map(({ to, label, icon }) => (
              <NavLink key={to} to={to} className={styles.navLink}>
                <MdiIcon path={icon} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className={styles.themeControl} aria-label="Theme mode">
            {themeOptions.map(({ value, label, icon }) => (
              <button
                key={value}
                type="button"
                aria-label={`Use ${label.toLowerCase()} theme`}
                aria-pressed={themeMode === value}
                onClick={() => setThemeMode(value)}
              >
                <MdiIcon path={icon} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className={styles.main}>{children ?? <Outlet />}</main>
    </div>
  );
}
