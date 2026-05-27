import { mdiArrowLeft, mdiRefresh } from "@mdi/js";
import { Link } from "react-router-dom";
import { MdiIcon } from "../../components/icons/MdiIcon";
import styles from "./ErrorPage.module.scss";

type ErrorPageProps = {
  code: "404" | "500";
  eyebrow: string;
  title: string;
  description: string;
  showReload?: boolean;
};

export function ErrorPage({
  code,
  eyebrow,
  title,
  description,
  showReload = false,
}: ErrorPageProps) {
  return (
    <section className={styles.page} aria-labelledby={`error-${code}-title`}>
      <header className={styles.header}>
        <p>{eyebrow}</p>
        <h1 id={`error-${code}-title`}>{title}</h1>
        <span>{description}</span>
      </header>

      <div className={styles.actions}>
        <Link className={styles.primaryLink} to="/generator">
          <MdiIcon path={mdiArrowLeft} />
          Back to generator
        </Link>
        {showReload ? (
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => window.location.reload()}
          >
            <MdiIcon path={mdiRefresh} />
            Reload
          </button>
        ) : null}
      </div>
    </section>
  );
}

export function NotFoundPage() {
  return (
    <ErrorPage
      code="404"
      eyebrow="404"
      title="Image not found"
      description="That workspace route does not exist. The lab is still here; head back to the generator to keep working."
    />
  );
}

export function ServerErrorPage() {
  return (
    <ErrorPage
      code="500"
      eyebrow="500"
      title="Render interrupted"
      description="Something in the app failed before this view could finish loading. Reload the workspace or return to the generator."
      showReload
    />
  );
}
