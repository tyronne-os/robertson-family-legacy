"""
Cuzzo -- the family's cousin on the inside.

Most people who open the Branches page know exactly who they want to add and
freeze anyway, because a blank form asks for a shape of answer they don't
have: which node is the parent, whether a step-child goes on the same line,
what to do about a name that changed with a marriage. Cuzzo exists to take
that in conversation instead, one question at a time, and to do the writing
himself once he's sure.

He runs on Hugging Face's serverless inference rather than a model on the
Space, because the Space is cpu-basic: no GPU, and a disk that empties on
restart. A local model would re-download every restart and still answer too
slowly to feel like chat.

He is given the branch's current tree on every turn, so he can spot that a
"Ray" already exists and ask whether this is the same Ray before creating a
duplicate -- which is the failure that actually corrupts a family tree.
"""
import json
import os

import requests
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import social

HF_TOKEN = os.environ.get("HF_TOKEN", "")
CUZZO_MODEL = os.environ.get("CUZZO_MODEL", "meta-llama/Llama-3.3-70B-Instruct")
ROUTER_URL = "https://router.huggingface.co/v1/chat/completions"

MAX_TOOL_TURNS = 4


SYSTEM = """You are Cuzzo, the Robertson family's helper on the Big Ma Project \
family tree site. Your name is a play on "cousin" -- that is exactly your \
manner: a warm, capable younger cousin who is good with names and never makes \
anyone feel slow.

You are talking to a family member who wants to add someone to the {branch_name} \
branch, or fix something already there.

How you work:
- Ask ONE question at a time. Never present a list of fields to fill in.
- Keep replies to a sentence or two. This is a phone conversation, not a form.
- Before adding anyone, you need their name and who their parent is in this \
branch. Birth year is worth asking for once; if they don't know it, let it go \
and move on. Never block an addition on a detail nobody remembers.
- Check the existing tree below before you add. If a similar name is already \
there, ask whether it's the same person BEFORE creating a second entry. \
Duplicates are the one thing that genuinely damages a family tree.
- When you have a name and a parent, call add_person. Don't ask permission to \
do the thing they already asked you to do.
- After adding, confirm warmly and briefly, then ask if there's anyone else.
- If someone has passed, use the death_year field. Speak about it gently and \
don't ask follow-up questions about it.

The {branch_name} branch descends from one of Big Ma's nine children. Everyone \
in it is a descendant of Magnolia "Big Ma" Robertson.

People currently in this branch:
{tree}
"""


TOOLS = [{
    "type": "function",
    "function": {
        "name": "add_person",
        "description": (
            "Add a person to this branch of the family tree. Call this once you "
            "know at minimum the person's name and who their parent is. Do not "
            "call it twice for the same person."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Full name as the family says it.",
                },
                "parent_name": {
                    "type": "string",
                    "description": (
                        "Name of this person's parent, who should already be in "
                        "the branch. Empty only if they attach directly to the "
                        "branch's first-generation ancestor."
                    ),
                },
                "birth_year": {
                    "type": "string",
                    "description": "Year of birth if known, else empty.",
                },
                "death_year": {
                    "type": "string",
                    "description": "Year of death if the person has passed, else empty.",
                },
                "relation": {
                    "type": "string",
                    "description": "e.g. son, daughter, grandson, spouse.",
                },
                "note": {
                    "type": "string",
                    "description": "Anything else the family shared worth keeping.",
                },
            },
            "required": ["name"],
        },
    },
}]


def _tree_summary(slug: str) -> str:
    people = social._get(f"people/{slug}.json")
    if not people:
        return "  (nobody added yet -- this branch is empty)"
    by_id = {p["id"]: p for p in people}
    lines = []
    for p in people:
        parent = by_id.get(p.get("parent_id") or "", {}).get("name", "")
        bits = [f"  - {p['name']}"]
        if p.get("birth_year"):
            bits.append(f"b.{p['birth_year']}")
        if p.get("death_year"):
            bits.append(f"d.{p['death_year']}")
        if parent:
            bits.append(f"(child of {parent})")
        elif p.get("relation"):
            bits.append(f"({p['relation']})")
        lines.append(" ".join(bits))
    return "\n".join(lines)


def _resolve_parent(slug: str, parent_name: str) -> str | None:
    if not parent_name:
        return None
    target = parent_name.strip().lower()
    people = social._get(f"people/{slug}.json")
    for p in people:
        if p["name"].strip().lower() == target:
            return p["id"]
    # Fall back to a loose match so "Ray" finds "Ray Junior" rather than
    # silently orphaning the new person.
    for p in people:
        if target in p["name"].strip().lower():
            return p["id"]
    return None


def _call_model(messages, tools=None):
    if not HF_TOKEN:
        raise HTTPException(503, "Cuzzo is not configured yet -- HF_TOKEN is missing.")
    payload = {
        "model": CUZZO_MODEL,
        "messages": messages,
        "max_tokens": 600,
        "temperature": 0.6,
    }
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = "auto"
    try:
        r = requests.post(
            ROUTER_URL,
            headers={"Authorization": f"Bearer {HF_TOKEN}"},
            json=payload,
            timeout=60,
        )
    except requests.RequestException as e:
        raise HTTPException(502, f"Cuzzo couldn't be reached: {e}")
    if r.status_code >= 400:
        raise HTTPException(502, f"Cuzzo error {r.status_code}: {r.text[:200]}")
    return r.json()["choices"][0]["message"]


router = APIRouter(prefix="/api/cuzzo")


class Turn(BaseModel):
    role: str
    content: str


class CuzzoIn(BaseModel):
    branch_slug: str
    message: str
    history: list[Turn] = []
    speaker: str = ""


@router.post("/chat")
def chat(body: CuzzoIn):
    slug = body.branch_slug
    if slug not in social.BRANCH_SLUGS:
        raise HTTPException(404, "unknown branch")

    system = SYSTEM.format(
        branch_name=social.BRANCH_NAMES[slug],
        tree=_tree_summary(slug),
    )
    messages = [{"role": "system", "content": system}]
    for t in body.history[-12:]:
        if t.role in ("user", "assistant") and t.content:
            messages.append({"role": t.role, "content": t.content})
    messages.append({"role": "user", "content": body.message})

    added = []
    for _ in range(MAX_TOOL_TURNS):
        msg = _call_model(messages, TOOLS)
        calls = msg.get("tool_calls") or []
        if not calls:
            return {
                "reply": (msg.get("content") or "").strip(),
                "added": added,
            }

        messages.append({
            "role": "assistant",
            "content": msg.get("content") or "",
            "tool_calls": calls,
        })

        for call in calls:
            fn = call.get("function", {})
            try:
                args = json.loads(fn.get("arguments") or "{}")
            except json.JSONDecodeError:
                args = {}

            if fn.get("name") != "add_person" or not args.get("name"):
                result = "That tool call was malformed; ask the family member to clarify."
            else:
                person = social.PersonIn(
                    name=args["name"],
                    parent_id=_resolve_parent(slug, args.get("parent_name", "")),
                    birth_year=str(args.get("birth_year") or ""),
                    death_year=str(args.get("death_year") or ""),
                    relation=args.get("relation", ""),
                    note=args.get("note", ""),
                    added_by=body.speaker or "Cuzzo",
                )
                created = social.add_person(slug, person)["person"]
                added.append(created)
                result = f"Added {created['name']} to the branch."

            messages.append({
                "role": "tool",
                "tool_call_id": call.get("id", ""),
                "content": result,
            })

    # Tool loop exhausted -- answer in words rather than leaving them hanging.
    final = _call_model(messages)
    return {"reply": (final.get("content") or "").strip(), "added": added}


@router.get("/status")
def status():
    return {"configured": bool(HF_TOKEN), "model": CUZZO_MODEL}
