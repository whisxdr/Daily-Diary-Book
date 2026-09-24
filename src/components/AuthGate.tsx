/*
 * Sign-in for the cloud store, and the local-data tools that stand in for it
 * when no Supabase project is configured.
 *
 * Magic link only: no password to store, and it works on the free tier.
 */
import { useEffect, useState } from "react";
import { cloudEnabled, exportEntries, importEntries, supabase, type ImportResult } from "../lib/store";
import type { Category, DiaryEntry } from "../lib/types";

type AuthGateProps = {
  entries: DiaryEntry[];
  categories: Category[];
  email: string | null;
  onEntriesImported: (result: ImportResult) => Promise<void>;
};

export function AuthGate({ entries, categories, email, onEntriesImported }: AuthGateProps) {
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // The magic link returns with a session in the URL fragment; the client picks
  // it up on load, so only the hash needs clearing afterwards.
  useEffect(() => {
    if (!supabase) return;
    if (window.location.hash.includes("access_token")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  if (!cloudEnabled) {
    return (
      <div className="auth auth--local">
        <p className="auth__note">
          Mode lokal — catatan disimpan di browser ini. Isi <code>VITE_SUPABASE_URL</code> dan{" "}
          <code>VITE_SUPABASE_ANON_KEY</code> untuk menyimpan ke cloud.
        </p>
        <div className="auth__actions">
          <button type="button" onClick={() => exportEntries(entries, categories)} disabled={!entries.length}>
            Ekspor JSON
          </button>
          <label className="auth__import">
            <span>Impor JSON</span>
            <input
              type="file"
              accept="application/json"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setError(null);
                try {
                  const imported = await importEntries(file);
                  await onEntriesImported(imported);
                  setStatus(
                    imported.categories
                      ? `${imported.entries.length} catatan dan ${imported.categories.length} kategori diimpor`
                      : `${imported.entries.length} catatan diimpor`,
                  );
                } catch (caught) {
                  setError(caught instanceof Error ? caught.message : "Gagal mengimpor");
                }
              }}
            />
          </label>
        </div>
        {status ? <p className="auth__status" role="status">{status}</p> : null}
        {error ? <p className="auth__error">{error}</p> : null}
      </div>
    );
  }

  if (email) {
    return (
      <div className="auth">
        <p className="auth__note">
          Masuk sebagai <strong>{email}</strong>
        </p>
        <div className="auth__actions">
          <button type="button" onClick={() => void supabase?.auth.signOut()}>
            Keluar
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="auth"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!supabase) return;
        setSending(true);
        setError(null);
        setStatus(null);
        const { error: sendError } = await supabase.auth.signInWithOtp({
          email: address,
          options: { emailRedirectTo: window.location.origin },
        });
        setSending(false);
        if (sendError) setError(sendError.message);
        else setStatus("Tautan masuk dikirim. Periksa email.");
      }}
    >
      <label className="auth__field">
        <span>Masuk untuk menyimpan ke cloud</span>
        <input
          type="email"
          required
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder="nama@email.com"
        />
      </label>
      <button type="submit" disabled={sending}>
        {sending ? "Mengirim…" : "Kirim tautan masuk"}
      </button>
      {status ? <p className="auth__status" role="status">{status}</p> : null}
      {error ? <p className="auth__error">{error}</p> : null}
    </form>
  );
}
