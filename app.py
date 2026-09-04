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

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, PlainTextResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
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

# Branch social layer -- feed, chat, DMs, and the tree itself. Its storage is a
# private HF Dataset rather than local disk, because this Space runs on
# cpu-basic and loses its filesystem on every restart.
import social
from cuzzo import router as cuzzo_router
social.start_background()
app.include_router(social.router)
app.include_router(cuzzo_router)


# Owner-only Vault gear -- injected into every HTML page so it's always
# reachable no matter which page you're on. Hidden by default; JS reveals it
# only when the page is loaded from the Hugging Face Spaces domain, never on
# the public bigmaproject.family site. Skipped on /branches-admin, which
# already has its own full gear + Vault panel.
GEAR_SNIPPET = b"""
<button id="__siteVaultGear" title="Branches Admin" style="display:none;position:fixed;top:22px;right:26px;z-index:9999;width:40px;height:40px;border-radius:50%;align-items:center;justify-content:center;background:rgba(16,13,10,.85);border:1px solid rgba(201,162,74,.38);box-shadow:0 4px 18px rgba(0,0,0,.45);cursor:pointer;color:#c9a24a;font-size:17px;font-family:sans-serif">&#9881;</button>
<script>
(function(){
  if (/(^|\\.)hf\\.space$/.test(location.hostname) || /(^|\\.)huggingface\\.co$/.test(location.hostname)) {
    var btn = document.getElementById('__siteVaultGear');
    if (btn) {
      btn.style.display = 'flex';
      btn.addEventListener('click', function(){ window.location.href = '/branches-admin'; });
    }
  }
})();
</script>
"""


class InjectGearMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        content_type = response.headers.get("content-type", "")
        if request.url.path == "/branches-admin" or not content_type.startswith("text/html"):
            return response
        body = b""
        async for chunk in response.body_iterator:
            body += chunk
        if b"</body>" in body:
            body = body.replace(b"</body>", GEAR_SNIPPET + b"</body>", 1)
        headers = dict(response.headers)
        headers.pop("content-length", None)
        return Response(content=body, status_code=response.status_code, headers=headers, media_type=response.media_type)


app.add_middleware(InjectGearMiddleware)


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


# Each branch gets its own social page at /branch/<slug>. One file serves all
# nine; the page reads the slug off its own URL and loads that branch's people,
# feed, and chat. Registered before the static mount so it wins the path.
@app.get("/branch/{slug}")
async def branch_social(slug: str):
    if slug not in social.BRANCH_SLUGS:
        return RedirectResponse(url="/branches", status_code=307)
    return FileResponse(
        os.path.join(ROOT, "Branch Social.dc.html"), media_type="text/html"
    )


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
