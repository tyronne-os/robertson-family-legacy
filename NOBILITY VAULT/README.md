# NOBILITY VAULT

Automated daily backup of the Branches admin/approval database (branch admin
roster, pending tree changes, and the notification log). Pulled from the live
site's `/api/backup/export` endpoint by
[`.github/workflows/nobility-vault-backup.yml`](../.github/workflows/nobility-vault-backup.yml)
every day at 09:00 UTC.

- `latest.json` — always the most recent snapshot.
- `history/YYYY-MM-DD.json` — one dated copy per day it ran, so any past
  state can be recovered even if `latest.json` gets overwritten by a bad run.

Git itself is the version history here — every commit to this folder is a
point-in-time backup, kept forever unless the repo history is rewritten.

If the site or your device is ever lost, this folder is the recovery source:
the JSON here can be re-imported into a fresh SQLite database to restore the
admin roster and change history.
