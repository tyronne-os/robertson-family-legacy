# The Vault — credential storage for this site

This project stores its Hugging Face deploy token and Google Cloud API key
client-side, in the browser's `localStorage`, under the key
`robertson-legacy:settings`. There is no backend for this — the Vault (the
⚙ gear icon, top-right of the site) is the only place these values live.

## What broke (2026-08-28)

`Clear All` was a single click with no confirmation and no backup. A fresh
browser profile/tab (or one stray click) wiped `localStorage` and the keys
were gone with no way to recover them. You had to re-generate an HF token
and re-paste the GCP key from scratch.

## What was repaired

In `src/components/SettingsPanel.jsx`:

1. **Clear All now requires two clicks.** First click turns the button red
   and reads "Click again to confirm"; it resets on its own after 4 seconds
   if you don't follow through. One misclick can no longer wipe the Vault.

2. **Export Backup.** Downloads everything currently saved in the Vault
   (HF token, GCP key, backend URL, etc.) as a local `.json` file. This is
   your actual insurance policy — `localStorage` can still be cleared by a
   private tab, a browser reset, or clearing site data, and this file is
   the only way back from that.

3. **Import Backup.** Restores a previously exported `.json` file straight
   back into the Vault and into all the form fields — no retyping.

## Round two (same day): making it self-aware

The repairs above stopped the data loss, but you were still guessing about
*what* was stored and whether it actually worked. Three more additions:

4. **Access Status, live.** Under the token field the Vault now verifies
   against `whoami-v2` on open and whenever the token changes, and reports
   what it actually found — not what it assumed:
   - who the token authenticates as (`Write access confirmed as AIBRUH`)
   - which token it is, by name (`Token: big ma 2`)
   - the real granted scopes (`Scopes: write`)
   - an explicit warning if the token is read-only, since a read token
     looks "valid" right up until the deploy fails.

5. **Required Access manifest.** A section listing every credential the
   site needs, what each is for, what scope it must carry, and what
   specifically breaks without it — with a green/red/grey dot showing
   whether it's stored right now. Declared in `src/lib/vaultManifest.js`,
   so adding a credential means adding one entry, not hunting through JSX.

6. **Dated SDK freshness check.** The Vault queries the npm registry for
   tracked packages and reports e.g. `@huggingface/hub 2.15.0 → 2.16.0
   available`, stamped with the date and time it looked. Shown right under
   the key input, as requested.

## Syncing the token to the CLI

A browser cannot write to your filesystem — no web page can. So the Vault
cannot silently update the CLI on its own. What it can do is hand you a
verified file, which `vault-sync.mjs` then installs:

```
node vault-sync.mjs
```

It finds the newest exported backup (in `~/Downloads` or the repo), checks
the token against Hugging Face *before* writing anything, then installs it
to `~/.cache/huggingface/token` with mode `600`. Every HF tool on the
machine reads that path, so the terminal stays authenticated even if the
browser's storage is wiped. It refuses to install a dead token and warns
if the role isn't `write`.

The token never gets typed into a terminal argument or pasted into a chat —
it moves file-to-file only.

## Your workflow going forward

- **Day to day**: nothing changes. Open the Vault, your keys are already
  there, click Save & Deploy.
- **First time after this fix, or any time you start on a fresh
  browser/profile**: paste your keys in once, then immediately click
  **Export Backup** and save that file somewhere private (not in this repo,
  not committed to git — it contains raw secrets).
- **If the Vault ever shows up empty again**: click **Import Backup**,
  select that saved `.json` file, done. No regenerating tokens.
- **Swapping a key** (rotating the HF token, changing the GCP key): edit it
  in the Vault as normal, `Save Keys`, then `Export Backup` again to refresh
  your backup file — old backups go stale the moment you rotate a key.

## Why this isn't "fixed" in a stronger sense

This is a static site with no backend, by design — Hugging Face Static
Spaces cannot execute server code, so there is nowhere else to put these
secrets except the browser. The repairs above don't make loss impossible,
they make it recoverable: confirmation stops the accidental case, and the
export file is the answer to every other case (profile wipe, corrupted
storage, new machine).

See `~/.claude/vault-pattern.md` for the reusable version of this pattern —
this project is the reference implementation.
