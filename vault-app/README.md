# Nobility Depository — Desktop Vault

A small Electron app for storing project credentials outside of browser
`localStorage`. Built after a browser-based vault lost its saved keys when
a preview server's origin changed — this one writes to a real file instead.

## Storage

- Keys live in `~/.config/nobility-depository/vault.json`, file mode `600`.
- Never in `localStorage`, never in this repo, never committed.

## Run it

```bash
cd vault-app
npm install
npm run start
```

Or use the packaged launcher at `/home/hunt/NobilityDepository/launch.sh`
and the "Nobility Depository" entry in the Ubuntu app menu
(`~/.local/share/applications/nobility-depository.desktop`).

## Features

- Add any named key (not just HF/GCP) — arbitrary count.
- Reveal / Copy / Delete per key; delete requires a second confirm click.
- Hugging Face token tools: **Verify** (checks real granted scope via
  `whoami-v2`, not just a 200) and **Sync to CLI** (installs to
  `~/.cache/huggingface/token`, mode 600 — never installs an unverified
  token).
- Export/Import Backup as a plain JSON file.
- Clear All requires a two-step confirm.

This is the standing pattern referenced by `~/.claude/vault-pattern.md`
for all future projects: confirm-before-destroy, export/import backup,
and no bare "paste key → save" panel without them.
