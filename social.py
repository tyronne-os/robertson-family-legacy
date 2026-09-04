"""
Branch social layer -- feed, chat, DMs, and the family tree itself.

Storage is a private Hugging Face Dataset repo rather than the Space's own
disk, because the Space runs on cpu-basic: its filesystem is wiped on every
restart, and the keep-alive pings mean restarts happen. Anything written to
local disk would be lost, taking the family's photos with it.

The dataset is the durable record. To keep reads fast (a git commit per page
view would be unusable), everything is held in memory and flushed back to the
dataset on a short debounce. Media is committed immediately -- a lost photo is
not recoverable, so it never waits in a buffer.

Layout inside the dataset:

    people/{branch}.json   the tree: grandkids, great-grandkids, spouses
    posts/{branch}.json    the branch feed
    chat/{branch}.json     the branch's public conversation
    dms/{pair_id}.json     one-to-one conversations
    media/{id}.{ext}       photos and video

Identity is deliberately thin: a family member types their name once and it
lives in their own browser. There are no passwords. This mirrors how the rest
of the site already works, and the alternative -- accounts for eighty-year-old
aunts -- would cost more updates than it protects.
"""
import io
import json
import os
import threading
import time
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel

DATASET_REPO = os.environ.get("SOCIAL_DATASET", "AIBRUH/magnolia-branches-data")
HF_TOKEN = os.environ.get("HF_TOKEN", "")

# Media is served straight from the dataset over the Hub's CDN rather than
# proxied through the Space, so a photo-heavy feed doesn't compete with page
# rendering for the Space's two cores.
MEDIA_BASE = f"https://huggingface.co/datasets/{DATASET_REPO}/resolve/main"

BRANCH_SLUGS = [
    "ethel-robertson", "leola-robertson", "johnnie-robertson", "mary-robertson",
    "beulah-robertson", "lydia-robertson", "beatrice-robertson",
    "lemar-robertson", "susianna-robertson",
]

BRANCH_NAMES = {
    "ethel-robertson": "Ethel Brown",
    "leola-robertson": "Leola Robertson",
    "johnnie-robertson": "Johnnie Robertson",
    "mary-robertson": "Mary Robertson",
    "beulah-robertson": "Beulah Barabino",
    "lydia-robertson": "Lydia Robertson",
    "beatrice-robertson": "Beatrice Bowman",
    "lemar-robertson": "Lemar Robertson",
    "susianna-robertson": "Susianna Duchane",
}

MAX_MEDIA_BYTES = 60 * 1024 * 1024
ALLOWED_MEDIA = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
    "image/gif": "gif", "image/heic": "heic",
    "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
}

_lock = threading.RLock()
_cache: dict[str, Any] = {}
_dirty: set[str] = set()
_hydrated = False


def _api():
    if not HF_TOKEN:
        return None
    from huggingface_hub import HfApi
    return HfApi(token=HF_TOKEN)


def _blank(path: str):
    return {"people": [], "posts": [], "messages": []}.get(path.split("/")[0], [])


def _read_remote(path: str):
    """Pull one JSON file out of the dataset. Missing is normal, not an error --
    a branch nobody has posted to yet simply has no file."""
    api = _api()
    if api is None:
        return None
    try:
        from huggingface_hub import hf_hub_download
        local = hf_hub_download(
            repo_id=DATASET_REPO, filename=path, repo_type="dataset",
            token=HF_TOKEN,
        )
        with open(local, encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return None


def hydrate():
    """Load every branch's data from the dataset into memory once at startup."""
    global _hydrated
    with _lock:
        if _hydrated:
            return
        for slug in BRANCH_SLUGS:
            for kind in ("people", "posts", "chat"):
                path = f"{kind}/{slug}.json"
                data = _read_remote(path)
                _cache[path] = data if data is not None else []
        _hydrated = True


def _get(path: str):
    with _lock:
        if path not in _cache:
            data = _read_remote(path)
            _cache[path] = data if data is not None else []
        return _cache[path]


def _touch(path: str):
    with _lock:
        _dirty.add(path)


def _flush_once():
    """Commit whatever changed since the last pass, one commit per file."""
    with _lock:
        pending = list(_dirty)
        _dirty.clear()
        snapshot = {p: json.dumps(_cache.get(p, []), indent=1) for p in pending}

    api = _api()
    if api is None or not snapshot:
        return
    for path, body in snapshot.items():
        try:
            api.upload_file(
                path_or_fileobj=body.encode("utf-8"),
                path_in_repo=path,
                repo_id=DATASET_REPO,
                repo_type="dataset",
                commit_message=f"update {path}",
            )
        except Exception as e:
            # Put it back so the next pass retries rather than dropping it.
            print(f"[social] flush failed for {path}: {e}")
            with _lock:
                _dirty.add(path)


def _flusher():
    while True:
        time.sleep(8)
        try:
            _flush_once()
        except Exception as e:
            print(f"[social] flusher error: {e}")


def start_background():
    hydrate()
    t = threading.Thread(target=_flusher, daemon=True, name="social-flush")
    t.start()


def _pair_id(a: str, b: str) -> str:
    """DMs are keyed by the two names sorted, so either person opening the
    thread lands on the same file."""
    x, y = sorted([a.strip().lower(), b.strip().lower()])
    safe = "".join(c if c.isalnum() else "-" for c in f"{x}--{y}")
    return safe[:120]


def _require_branch(slug: str):
    if slug not in BRANCH_SLUGS:
        raise HTTPException(404, "unknown branch")


router = APIRouter(prefix="/api/social")


# ---------------------------------------------------------------- the tree

class PersonIn(BaseModel):
    name: str
    parent_id: str | None = None
    birth_year: str = ""
    death_year: str = ""
    relation: str = ""
    note: str = ""
    photo_url: str = ""
    added_by: str = ""


def _generation(person: dict, by_id: dict) -> tuple[int, str]:
    """How far below Big Ma this person sits, and what the family would call it.

    A branch root is one of Big Ma's nine children, so anyone recorded with no
    parent is her grandchild. Each parent link below that adds a "great". The
    walk is capped because a cycle in the parent chain -- two people recorded as
    each other's parent, which a confused afternoon of data entry can produce --
    would otherwise hang the request.
    """
    depth, seen, cur = 0, set(), person
    while cur.get("parent_id") and cur["parent_id"] in by_id and depth < 20:
        if cur["parent_id"] in seen:
            break
        seen.add(cur["parent_id"])
        cur = by_id[cur["parent_id"]]
        depth += 1
    label = "grandchild" if depth == 0 else ("great-" * depth) + "grandchild"
    return depth, label


@router.get("/{slug}/people")
def get_people(slug: str):
    _require_branch(slug)
    people = _get(f"people/{slug}.json")
    by_id = {p["id"]: p for p in people if "id" in p}
    out = []
    for p in people:
        depth, label = _generation(p, by_id)
        out.append({**p, "depth": depth, "generation": label})
    return {
        "people": out,
        "branch_name": BRANCH_NAMES[slug],
        "deepest": max([p["depth"] for p in out], default=-1) + 1,
    }


@router.post("/{slug}/people")
def add_person(slug: str, person: PersonIn):
    _require_branch(slug)
    if not person.name.strip():
        raise HTTPException(400, "a name is required")
    path = f"people/{slug}.json"
    entry = person.model_dump()
    entry["id"] = uuid.uuid4().hex[:12]
    entry["created_at"] = time.time()
    with _lock:
        _get(path).append(entry)
    _touch(path)

    # A new person is news. Post it to the feed so the branch sees it without
    # anyone having to announce it separately.
    _add_post(slug, {
        "author": person.added_by or "A family member",
        "kind": "birth" if person.birth_year and not person.death_year else "update",
        "text": f"{person.name} was added to the {BRANCH_NAMES[slug]} branch."
                + (f" Born {person.birth_year}." if person.birth_year else ""),
        "media_url": person.photo_url,
        "media_type": "image" if person.photo_url else "",
    })
    return {"ok": True, "person": entry}


@router.delete("/{slug}/people/{person_id}")
def remove_person(slug: str, person_id: str):
    _require_branch(slug)
    path = f"people/{slug}.json"
    with _lock:
        people = _get(path)
        remaining = [p for p in people if p.get("id") != person_id]
        if len(remaining) == len(people):
            raise HTTPException(404, "no such person")
        _cache[path] = remaining
    _touch(path)
    return {"ok": True}


# ---------------------------------------------------------------- the feed

class PostIn(BaseModel):
    author: str = ""
    text: str = ""
    media_url: str = ""
    media_type: str = ""
    kind: str = "post"


def _add_post(slug: str, data: dict):
    path = f"posts/{slug}.json"
    entry = dict(data)
    entry["id"] = uuid.uuid4().hex[:12]
    entry["created_at"] = time.time()
    entry.setdefault("reactions", {})
    with _lock:
        _get(path).insert(0, entry)
    _touch(path)
    return entry


@router.get("/{slug}/feed")
def get_feed(slug: str, limit: int = 60):
    _require_branch(slug)
    return {"posts": _get(f"posts/{slug}.json")[:limit]}


@router.post("/{slug}/feed")
def create_post(slug: str, post: PostIn):
    _require_branch(slug)
    if not post.text.strip() and not post.media_url:
        raise HTTPException(400, "a post needs words or a photo")
    return {"ok": True, "post": _add_post(slug, post.model_dump())}


@router.post("/{slug}/feed/{post_id}/react")
def react(slug: str, post_id: str, emoji: str = Form("heart")):
    _require_branch(slug)
    path = f"posts/{slug}.json"
    with _lock:
        for p in _get(path):
            if p.get("id") == post_id:
                p.setdefault("reactions", {})
                p["reactions"][emoji] = p["reactions"].get(emoji, 0) + 1
                _touch(path)
                return {"ok": True, "reactions": p["reactions"]}
    raise HTTPException(404, "no such post")


@router.get("/news")
def news():
    """Births and passings across every branch, newest first -- the rotating
    clips beside the portrait."""
    items = []
    for slug in BRANCH_SLUGS:
        for p in _get(f"posts/{slug}.json"):
            if p.get("kind") in ("birth", "passing"):
                items.append({**p, "branch": slug, "branch_name": BRANCH_NAMES[slug]})
    items.sort(key=lambda x: x.get("created_at", 0), reverse=True)
    return {"news": items[:20]}


# ---------------------------------------------------------------- chat

class MessageIn(BaseModel):
    author: str
    text: str


@router.get("/{slug}/chat")
def get_chat(slug: str, since: float = 0.0):
    _require_branch(slug)
    msgs = _get(f"chat/{slug}.json")
    return {"messages": [m for m in msgs if m.get("created_at", 0) > since][-200:]}


@router.post("/{slug}/chat")
def send_chat(slug: str, msg: MessageIn):
    _require_branch(slug)
    if not msg.text.strip():
        raise HTTPException(400, "empty message")
    path = f"chat/{slug}.json"
    entry = {
        "id": uuid.uuid4().hex[:12],
        "author": msg.author or "Someone",
        "text": msg.text[:2000],
        "created_at": time.time(),
    }
    with _lock:
        room = _get(path)
        room.append(entry)
        # Keep the room bounded; the dataset holds the full history in git.
        if len(room) > 500:
            _cache[path] = room[-500:]
    _touch(path)
    return {"ok": True, "message": entry}


@router.get("/dm/{me}/{them}")
def get_dm(me: str, them: str, since: float = 0.0):
    path = f"dms/{_pair_id(me, them)}.json"
    msgs = _get(path)
    return {"messages": [m for m in msgs if m.get("created_at", 0) > since][-200:]}


class DmIn(BaseModel):
    sender: str
    recipient: str
    text: str


@router.post("/dm")
def send_dm(dm: DmIn):
    if not dm.text.strip():
        raise HTTPException(400, "empty message")
    path = f"dms/{_pair_id(dm.sender, dm.recipient)}.json"
    entry = {
        "id": uuid.uuid4().hex[:12],
        "author": dm.sender,
        "to": dm.recipient,
        "text": dm.text[:2000],
        "created_at": time.time(),
    }
    with _lock:
        _get(path).append(entry)
    _touch(path)
    return {"ok": True, "message": entry}


# ---------------------------------------------------------------- media

@router.post("/upload")
async def upload_media(file: UploadFile = File(...)):
    """Photos and video go straight to the dataset -- no debounce. Losing one
    to a restart would mean losing the only copy."""
    api = _api()
    if api is None:
        raise HTTPException(503, "media storage is not configured yet")

    ext = ALLOWED_MEDIA.get(file.content_type or "")
    if ext is None:
        raise HTTPException(400, f"unsupported file type: {file.content_type}")

    body = await file.read()
    if len(body) > MAX_MEDIA_BYTES:
        raise HTTPException(413, "file is larger than 60MB")

    name = f"media/{uuid.uuid4().hex}.{ext}"
    try:
        api.upload_file(
            path_or_fileobj=io.BytesIO(body),
            path_in_repo=name,
            repo_id=DATASET_REPO,
            repo_type="dataset",
            commit_message=f"add {name}",
        )
    except Exception as e:
        raise HTTPException(502, f"upload failed: {e}")

    return {
        "ok": True,
        "url": f"{MEDIA_BASE}/{name}",
        "media_type": "video" if ext in ("mp4", "mov", "webm") else "image",
    }


# ------------------------------------------------------- who's who & alerts

def _email_key(email: str) -> str:
    """One file per person, named from their email. Sanitised because this
    becomes a path inside the dataset repo."""
    e = (email or "").strip().lower()
    return "".join(c if c.isalnum() or c in ".-_@" else "-" for c in e)[:120]


class IdentityIn(BaseModel):
    email: str
    name: str = ""
    branch_slug: str = ""
    notify_scope: str = "branch"   # "branch" | "all" | "none"


@router.post("/identity")
def save_identity(idn: IdentityIn):
    key = _email_key(idn.email)
    if not key or "@" not in key:
        raise HTTPException(400, "a real email address is needed")
    if idn.notify_scope not in ("branch", "all", "none"):
        raise HTTPException(400, "notify_scope must be branch, all, or none")
    path = f"identities/{key}.json"
    existing = _get(path)
    record = existing if isinstance(existing, dict) else {}
    record.update({
        "email": idn.email.strip().lower(),
        "name": idn.name.strip(),
        "branch_slug": idn.branch_slug,
        "notify_scope": idn.notify_scope,
        "updated_at": time.time(),
    })
    record.setdefault("created_at", time.time())
    with _lock:
        _cache[path] = record
    _touch(path)
    return {"ok": True, "identity": record}


@router.get("/identity/{email}")
def get_identity(email: str):
    rec = _get(f"identities/{_email_key(email)}.json")
    return {"identity": rec if isinstance(rec, dict) else None}


# ----------------------------------------------- Cuzzo's conversation lake

class CuzzoLogIn(BaseModel):
    email: str = ""
    speaker: str = ""
    branch_slug: str = ""
    role: str = "user"
    text: str = ""


@router.post("/cuzzo-log")
def log_cuzzo(entry: CuzzoLogIn):
    """Every Cuzzo exchange is kept, keyed by email where we have one.

    This is the record of how the tree came to say what it says -- who reported
    a name, when, and in whose words. When two cousins disagree about a spelling
    later, the transcript is what settles it.
    """
    key = _email_key(entry.email) or "anonymous"
    path = f"cuzzo_history/{key}.json"
    rec = _get(path)
    if not isinstance(rec, list):
        rec = []
    rec.append({
        "speaker": entry.speaker,
        "branch_slug": entry.branch_slug,
        "role": entry.role,
        "text": (entry.text or "")[:4000],
        "created_at": time.time(),
    })
    with _lock:
        _cache[path] = rec[-1000:]
    _touch(path)
    return {"ok": True, "entries": len(rec)}


@router.get("/cuzzo-log/{email}")
def get_cuzzo_log(email: str, limit: int = 200):
    rec = _get(f"cuzzo_history/{_email_key(email)}.json")
    rec = rec if isinstance(rec, list) else []
    return {"history": rec[-limit:]}


# ------------------------------------------------------------ change stream

@router.get("/stream")
def stream(since: float = 0.0, slug: str = ""):
    """Everything that changed since a timestamp, across one branch or all.

    Deliberately a poll rather than a websocket: the Space runs on two shared
    cores, and a handful of family members checking in every few seconds costs
    far less here than holding open sockets would.
    """
    slugs = [slug] if slug in BRANCH_SLUGS else BRANCH_SLUGS
    people_new, posts_new = [], []
    for s in slugs:
        for p in _get(f"people/{s}.json"):
            if p.get("created_at", 0) > since:
                people_new.append({**p, "branch": s, "branch_name": BRANCH_NAMES[s]})
        for p in _get(f"posts/{s}.json"):
            if p.get("created_at", 0) > since:
                posts_new.append({**p, "branch": s, "branch_name": BRANCH_NAMES[s]})
    people_new.sort(key=lambda x: x.get("created_at", 0))
    posts_new.sort(key=lambda x: x.get("created_at", 0))
    return {
        "now": time.time(),
        "people": people_new[-40:],
        "posts": posts_new[-40:],
    }


@router.get("/status")
def status():
    return {
        "storage_configured": bool(HF_TOKEN),
        "dataset": DATASET_REPO,
        "branches": [{"slug": s, "name": BRANCH_NAMES[s]} for s in BRANCH_SLUGS],
    }
