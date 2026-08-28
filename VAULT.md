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
