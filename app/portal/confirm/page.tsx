import PortalShell from "../portal-shell";
import styles from "../portal.module.css";

export const dynamic = "force-dynamic";

export default async function ConfirmPage({ searchParams }: { searchParams: Promise<{ token_hash?: string; type?: string }> }) {
  const params = await searchParams;
  const valid = typeof params.token_hash === "string" && /^[a-f0-9]{40,128}$/i.test(params.token_hash)
    && (params.type === "magiclink" || params.type === "signup");
  return (
    <PortalShell>
      <div className={styles.confirmWrap}>
        <h1>{valid ? "confirm sign-in" : "link unavailable"}</h1>
        {valid ? (
          // A GET never consumes the one-time token: email security scanners can
          // visit this page without signing in or invalidating the user's link.
          <form action="/api/portal/confirm" method="post">
            <input type="hidden" name="token_hash" value={params.token_hash} />
            <input type="hidden" name="type" value={params.type} />
            <button type="submit" className={styles.primaryButton}>sign in</button>
          </form>
        ) : <a className={styles.secondaryButton} href="/portal">request a new link</a>}
      </div>
    </PortalShell>
  );
}
