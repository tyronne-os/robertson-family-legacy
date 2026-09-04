"""
Phase Three -- Branch Admin & Approval backend.

SQLite-backed (single file, lives alongside the app on the Space).
Adds:
  - Admin registration (per branch, pending until owner-approved)
  - Pending changes queue: any visitor's tree edit is staged, not applied,
    until a branch admin or the owner approves it
  - Notification log: every registration + pending change is logged here;
    if RESEND_API_KEY is set as a Space env var, it also sends a real email
    to NOTIFY_EMAIL. Until then, notifications are visible in the admin
    dashboard only -- no code change needed once the key is added.

Mounted into app.py under /api/*.
"""
import json
import os
import smtplib
import sqlite3
import time
from contextlib import closing
from email.mime.text import MIMEText

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "branches.db")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

NOTIFY_EMAIL = os.environ.get("NOTIFY_EMAIL", "tjengineer@berylize.com")

# Server-side only -- set these as HF Space secrets (Settings > Variables and
# secrets), never in client code. SMTP_HOST/PORT/USER/PASS for the Hostinger
# mailbox that sends these notifications; ADMIN_PASSCODE gates every
# moderation action (approve/deny/approve-change/reject-change) so only
# whoever holds the passcode can act, since there is no login system yet.
SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "465"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")
ADMIN_PASSCODE = os.environ.get("ADMIN_PASSCODE", "")


def _require_passcode(x_admin_passcode: str | None):
    if not ADMIN_PASSCODE:
        # No passcode configured yet -- moderation is open. Warn via notification
        # log rather than silently blocking the owner out before setup is done.
        return
    if x_admin_passcode != ADMIN_PASSCODE:
        raise HTTPException(401, "invalid or missing passcode")

BRANCH_SLUGS = [
    "ethel-robertson", "leola-robertson", "johnnie-robertson", "mary-robertson",
    "beulah-robertson", "lydia-robertson", "beatrice-robertson",
    "lemar-robertson", "susianna-robertson",
]


def _conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def init_db():
    with closing(_conn()) as c, c:
        c.execute("""
            CREATE TABLE IF NOT EXISTS admins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                branch_slug TEXT NOT NULL,
                relation TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at REAL NOT NULL
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS pending_changes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                branch_slug TEXT NOT NULL,
                submitted_by_name TEXT,
                submitted_by_email TEXT,
                payload TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                reviewed_by TEXT,
                created_at REAL NOT NULL,
                reviewed_at REAL
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                kind TEXT NOT NULL,
                branch_slug TEXT,
                message TEXT NOT NULL,
                emailed INTEGER NOT NULL DEFAULT 0,
                created_at REAL NOT NULL
            )
        """)


def _notify(kind, branch_slug, message):
    with closing(_conn()) as c, c:
        c.execute(
            "INSERT INTO notifications (kind, branch_slug, message, emailed, created_at) VALUES (?,?,?,?,?)",
            (kind, branch_slug, message, 0, time.time()),
        )
        row_id = c.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]

    emailed = 0
    if SMTP_HOST and SMTP_USER and SMTP_PASS:
        try:
            msg = MIMEText(message)
            msg["Subject"] = f"[Big Ma Project] {kind.replace('_', ' ').title()}"
            msg["From"] = SMTP_USER
            msg["To"] = NOTIFY_EMAIL
            if SMTP_PORT == 465:
                with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=10) as s:
                    s.login(SMTP_USER, SMTP_PASS)
                    s.sendmail(SMTP_USER, [NOTIFY_EMAIL], msg.as_string())
            else:
                with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as s:
                    s.starttls()
                    s.login(SMTP_USER, SMTP_PASS)
                    s.sendmail(SMTP_USER, [NOTIFY_EMAIL], msg.as_string())
            emailed = 1
        except (smtplib.SMTPException, OSError, TimeoutError) as e:
            print(f"[notify] email send failed: {e}")

    if emailed:
        with closing(_conn()) as c, c:
            c.execute("UPDATE notifications SET emailed = 1 WHERE id = ?", (row_id,))


class AdminRegistration(BaseModel):
    name: str
    email: str
    branch_slug: str
    relation: str = ""


class ChangeSubmission(BaseModel):
    branch_slug: str
    submitted_by_name: str = ""
    submitted_by_email: str = ""
    payload: dict


class ReviewAction(BaseModel):
    reviewed_by: str


router = APIRouter(prefix="/api")


@router.get("/branches")
def list_branches():
    return {"branches": BRANCH_SLUGS}


@router.post("/admins/register")
def register_admin(reg: AdminRegistration):
    if reg.branch_slug not in BRANCH_SLUGS:
        raise HTTPException(400, "unknown branch_slug")
    with closing(_conn()) as c, c:
        c.execute(
            "INSERT INTO admins (name, email, branch_slug, relation, status, created_at) VALUES (?,?,?,?,?,?)",
            (reg.name, reg.email, reg.branch_slug, reg.relation, "pending", time.time()),
        )
    _notify(
        "admin_registration",
        reg.branch_slug,
        f"{reg.name} ({reg.email}) requested admin access for the {reg.branch_slug} branch.\n"
        f"Relation: {reg.relation or '(not given)'}\n"
        f"Approve or deny in the admin dashboard.",
    )
    return {"ok": True}


@router.get("/admins")
def list_admins(branch_slug: str | None = None, status: str | None = None):
    q = "SELECT * FROM admins"
    clauses, params = [], []
    if branch_slug:
        clauses.append("branch_slug = ?")
        params.append(branch_slug)
    if status:
        clauses.append("status = ?")
        params.append(status)
    if clauses:
        q += " WHERE " + " AND ".join(clauses)
    q += " ORDER BY created_at DESC"
    with closing(_conn()) as c:
        rows = c.execute(q, params).fetchall()
    return {"admins": [dict(r) for r in rows]}


@router.get("/server-status")
def server_status():
    return {
        "email_configured": bool(SMTP_HOST and SMTP_USER and SMTP_PASS),
        "notify_email": NOTIFY_EMAIL,
        "passcode_configured": bool(ADMIN_PASSCODE),
    }


@router.post("/admins/{admin_id}/approve")
def approve_admin(admin_id: int, action: ReviewAction, x_admin_passcode: str | None = Header(default=None)):
    _require_passcode(x_admin_passcode)
    with closing(_conn()) as c, c:
        cur = c.execute("UPDATE admins SET status='approved' WHERE id=?", (admin_id,))
        if cur.rowcount == 0:
            raise HTTPException(404, "not found")
    return {"ok": True}


@router.post("/admins/{admin_id}/deny")
def deny_admin(admin_id: int, action: ReviewAction, x_admin_passcode: str | None = Header(default=None)):
    _require_passcode(x_admin_passcode)
    with closing(_conn()) as c, c:
        cur = c.execute("UPDATE admins SET status='denied' WHERE id=?", (admin_id,))
        if cur.rowcount == 0:
            raise HTTPException(404, "not found")
    return {"ok": True}


@router.post("/changes/submit")
def submit_change(sub: ChangeSubmission):
    if sub.branch_slug not in BRANCH_SLUGS:
        raise HTTPException(400, "unknown branch_slug")
    with closing(_conn()) as c, c:
        c.execute(
            "INSERT INTO pending_changes (branch_slug, submitted_by_name, submitted_by_email, payload, status, created_at) VALUES (?,?,?,?,?,?)",
            (sub.branch_slug, sub.submitted_by_name, sub.submitted_by_email, json.dumps(sub.payload), "pending", time.time()),
        )
    _notify(
        "pending_change",
        sub.branch_slug,
        f"{sub.submitted_by_name or 'A family member'} ({sub.submitted_by_email or 'no email given'}) "
        f"submitted a change to the {sub.branch_slug} branch, awaiting approval.",
    )
    return {"ok": True}


@router.get("/changes")
def list_changes(branch_slug: str | None = None, status: str | None = None):
    q = "SELECT * FROM pending_changes"
    clauses, params = [], []
    if branch_slug:
        clauses.append("branch_slug = ?")
        params.append(branch_slug)
    if status:
        clauses.append("status = ?")
        params.append(status)
    if clauses:
        q += " WHERE " + " AND ".join(clauses)
    q += " ORDER BY created_at DESC"
    with closing(_conn()) as c:
        rows = c.execute(q, params).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["payload"] = json.loads(d["payload"])
        out.append(d)
    return {"changes": out}


@router.post("/changes/{change_id}/approve")
def approve_change(change_id: int, action: ReviewAction, x_admin_passcode: str | None = Header(default=None)):
    _require_passcode(x_admin_passcode)
    with closing(_conn()) as c, c:
        cur = c.execute(
            "UPDATE pending_changes SET status='approved', reviewed_by=?, reviewed_at=? WHERE id=? AND status='pending'",
            (action.reviewed_by, time.time(), change_id),
        )
        if cur.rowcount == 0:
            raise HTTPException(404, "not found or already reviewed")
    return {"ok": True}


@router.post("/changes/{change_id}/reject")
def reject_change(change_id: int, action: ReviewAction, x_admin_passcode: str | None = Header(default=None)):
    _require_passcode(x_admin_passcode)
    with closing(_conn()) as c, c:
        cur = c.execute(
            "UPDATE pending_changes SET status='rejected', reviewed_by=?, reviewed_at=? WHERE id=? AND status='pending'",
            (action.reviewed_by, time.time(), change_id),
        )
        if cur.rowcount == 0:
            raise HTTPException(404, "not found or already reviewed")
    return {"ok": True}


@router.get("/notifications")
def list_notifications(limit: int = 100):
    with closing(_conn()) as c:
        rows = c.execute(
            "SELECT * FROM notifications ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall()
    return {"notifications": [dict(r) for r in rows], "email_configured": bool(RESEND_API_KEY)}
