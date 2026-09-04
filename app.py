"""
Raw-mode Gradio Space -- The Big Ma Project.

Gradio only satisfies the SDK requirement (mounted internally, never
rendered). The real site is plain static files, served with a thin
FastAPI routing layer on top so every family member gets a clean,
permanent, indexable URL:

    /big-ma
    /ethel-robertson
    /leola-robertson
    /johnnie-robertson
    /mary-robertson
    /beulah-robertson
    /lydia-robertson
    /beatrice-robertson
    /lemar-robertson
    /susianna-robertson

Each clean route serves the underlying .dc.html file's bytes directly
(no redirect -- search engines see one canonical 200, not a hop).

The OLD .dc.html filenames (already possibly bookmarked/shared/texted)
301-redirect to the new clean URL so nothing already sent out breaks
and any SEO credit already earned carries forward.

/sitemap.xml and /robots.txt are generated so search engines have an
explicit map instead of relying on nav-link crawling alone.

BASE_URL controls the domain used inside sitemap.xml. It defaults to
the current HF Space host; once BigMaProject.family's DNS is live and
mapped to this Space, set BASE_URL to "https://bigmaproject.family"
(env var on the Space's Settings > Variables page) and restart -- no
code change needed.
"""
import os
from urllib.parse import quote

from fastapi import FastAPI
from fastapi.responses import FileResponse, PlainTextResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

ROOT = os.path.dirname(os.path.abspath(__file__))
BASE_URL = os.environ.get("BASE_URL", "https://aibruh-magnolia-branches.hf.space").rstrip("/")

# slug -> underlying file. Order mirrors birth order (Big Ma first, then
# the nine children eldest to youngest) so it doubles as the sitemap's
# priority order.
PAGES = [
    ("big-ma",            "The Foreword - Big Ma.dc.html"),
    ("ethel-robertson",   "Chapter One - Ethel Brown.dc.html"),
    ("leola-robertson",   "Chapter Two - Leola Robertson.dc.html"),
    ("johnnie-robertson", "Chapter Three - Johnnie Robertson.dc.html"),
    ("mary-robertson",    "Chapter Four - Mary Robertson.dc.html"),
    ("beulah-robertson",  "Chapter Five - Beulah Barabino.dc.html"),
    ("lydia-robertson",   "Voice Narrator Widget.dc.html"),
    ("beatrice-robertson","Chapter Seven - Beatrice Bowman.dc.html"),
    ("lemar-robertson",   "Chapter Eight - Lamar Robertson.dc.html"),
    ("susianna-robertson","Chapter Nine - Susianna Duchane.dc.html"),
    ("reunion-2026",      "Reunion 2026.dc.html"),
    ("photo-album",       "Photo Album.dc.html"),
    ("submit-a-chapter",  "Submit a Chapter.dc.html"),
    ("branches",          "Branches - Family Tree.dc.html"),
    ("branches-admin",    "Branches Admin.dc.html"),
]

app = FastAPI()

from backend import router as api_router, init_db
init_db()
app.include_router(api_router)


def _make_page_route(filename):
    path = os.path.join(ROOT, filename)

    async def handler():
        return FileResponse(path, media_type="text/html")

    return handler


def _make_redirect_route(new_slug):
    async def handler():
        return RedirectResponse(url=f"/{new_slug}", status_code=308)

    return handler


for slug, filename in PAGES:
    app.add_api_route(f"/{slug}", _make_page_route(filename), methods=["GET"])
    # old bookmarked/shared URL -> permanent redirect to the clean slug
    app.add_api_route(f"/{filename}", _make_redirect_route(slug), methods=["GET"])

# the home page used to be a differently-named file -- redirect that old URL too
app.add_api_route("/Magnolia Book Landing.dc.html", _make_redirect_route(""), methods=["GET"])


@app.get("/sitemap.xml")
async def sitemap():
    urls = [BASE_URL + "/"]
    urls += [f"{BASE_URL}/{slug}" for slug, _ in PAGES]
    body = ['<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for u in urls:
        body.append(f"  <url><loc>{u}</loc></url>")
    body.append("</urlset>")
    return PlainTextResponse("\n".join(body), media_type="application/xml")


@app.get("/robots.txt")
async def robots():
    return PlainTextResponse(
        f"User-agent: *\nAllow: /\nSitemap: {BASE_URL}/sitemap.xml\n"
    )


# everything else (images, audio, narrator.js, index.html, uploads/*, the
# landing page itself) falls through to the plain static mount, unchanged.
app.mount("/", StaticFiles(directory=ROOT, html=True), name="site")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 7860)))
