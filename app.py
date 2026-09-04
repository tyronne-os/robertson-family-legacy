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
from fastapi.exceptions import HTTPException as StarletteHTTPException
from fastapi.responses import FileResponse, HTMLResponse, PlainTextResponse, RedirectResponse, Response
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
    ("family-growth",     "Family Growth.dc.html"),
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


@app.post("/api/dev/set-hf-token")
async def dev_set_hf_token(request: Request):
    """Local-only: saves an HF token to ~/.cache/huggingface/token so deploy scripts can use it."""
    from fastapi.responses import JSONResponse
    host = request.client.host if request.client else ""
    if host not in ("127.0.0.1", "::1", "localhost"):
        return JSONResponse({"error": "local only"}, status_code=403)
    data = await request.json()
    token = (data.get("token") or "").strip()
    if not token.startswith("hf_"):
        return JSONResponse({"error": "not an HF token"}, status_code=400)
    token_dir = os.path.join(os.path.expanduser("~"), ".cache", "huggingface")
    os.makedirs(token_dir, exist_ok=True)
    path = os.path.join(token_dir, "token")
    with open(path, "w") as f:
        f.write(token)
    os.chmod(path, 0o600)
    return JSONResponse({"ok": True, "path": path})


# Where each provider's key belongs on this machine, so a key pasted into the
# Vault lands in the file its own CLI already reads -- no copy/paste, and the
# value never leaves localhost.
_HOME = os.path.expanduser("~")
CLI_KEY_TARGETS = {
    "hf":     {"path": os.path.join(_HOME, ".cache", "huggingface", "token"), "fmt": "raw"},
    "gcloud": {"path": os.path.join(_HOME, ".config", "gcloud", "nobility-api-key.env"), "fmt": "env", "var": "GOOGLE_API_KEY"},
    "github": {"path": os.path.join(_HOME, ".config", "gh", "nobility-token.env"), "fmt": "env", "var": "GITHUB_TOKEN"},
    "nim":    {"path": os.path.join(_HOME, ".ngc", "config"), "fmt": "ngc"},
    "nvent":  {"path": os.path.join(_HOME, ".config", "nvidia", "enterprise.env"), "fmt": "env", "var": "NVIDIA_ENTERPRISE_LICENSE"},
}


@app.post("/api/dev/sync-key")
async def dev_sync_key(request: Request):
    """Local-only: writes any vault provider key to the location its CLI reads."""
    from fastapi.responses import JSONResponse
    host = request.client.host if request.client else ""
    if host not in ("127.0.0.1", "::1", "localhost"):
        return JSONResponse({"error": "local only"}, status_code=403)
    data = await request.json()
    provider = (data.get("provider") or "").strip()
    value = (data.get("value") or "").strip()
    target = CLI_KEY_TARGETS.get(provider)
    if not target:
        return JSONResponse({"error": f"unknown provider {provider!r}"}, status_code=400)
    if not value:
        return JSONResponse({"error": "empty value"}, status_code=400)

    # A Google service-account key is a JSON keypair, not a bare string -- it
    # belongs in its own file that GOOGLE_APPLICATION_CREDENTIALS points at,
    # not inlined into an env var.
    if provider == "gcloud" and value.lstrip().startswith("{"):
        import json as _json
        try:
            parsed = _json.loads(value)
        except ValueError as exc:
            return JSONResponse({"error": f"not valid JSON: {exc}"}, status_code=400)
        if parsed.get("type") != "service_account":
            return JSONResponse({"error": "JSON is not a service_account key"}, status_code=400)
        sa_path = os.path.join(_HOME, ".config", "gcloud", "nobility-service-account.json")
        os.makedirs(os.path.dirname(sa_path), exist_ok=True)
        with open(sa_path, "w") as f:
            f.write(value)
        os.chmod(sa_path, 0o600)
        env_path = os.path.join(_HOME, ".config", "gcloud", "nobility-api-key.env")
        with open(env_path, "w") as f:
            f.write(f"GOOGLE_APPLICATION_CREDENTIALS={sa_path}\n")
        os.chmod(env_path, 0o600)
        return JSONResponse({
            "ok": True,
            "path": sa_path.replace(_HOME, "~"),
            "account": parsed.get("client_email"),
            "project": parsed.get("project_id"),
        })

    path = target["path"]
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if target["fmt"] == "raw":
        body = value
    elif target["fmt"] == "env":
        body = f'{target["var"]}={value}\n'
    else:  # ngc
        body = f"[CURRENT]\napikey = {value}\nformat_type = ascii\n"
    with open(path, "w") as f:
        f.write(body)
    os.chmod(path, 0o600)
    return JSONResponse({"ok": True, "path": path.replace(_HOME, "~")})


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


NOT_FOUND_HTML = """<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Page not found — The Big Ma Project</title>
<style>
  html,body{margin:0;background:#14110e;color:#f4efe3;font-family:Helvetica,Arial,sans-serif;
    height:100%;display:flex;align-items:center;justify-content:center;text-align:center}
  a{color:#d9b463;text-decoration:none;font-weight:700}
  a:hover{color:#e9cd88}
  .wrap{padding:24px}
  h1{font-family:Georgia,serif;font-size:26px;margin:0 0 10px;color:#f6f1e6}
  p{font-size:15px;color:#a39685;margin:0 0 22px}
</style></head><body><div class="wrap">
  <h1>That page doesn't exist</h1>
  <p>The link may be old or mistyped. Here's where you can go instead.</p>
  <p><a href="/">Home</a> &nbsp;·&nbsp; <a href="/branches">Branches</a> &nbsp;·&nbsp; <a href="/photo-album">Photo Album</a></p>
</div></body></html>"""


@app.exception_handler(StarletteHTTPException)
async def not_found_handler(request: Request, exc: StarletteHTTPException):
    if exc.status_code == 404:
        return HTMLResponse(NOT_FOUND_HTML, status_code=404)
    return PlainTextResponse(str(exc.detail), status_code=exc.status_code)


# everything else (images, audio, narrator.js, index.html, uploads/*, the
# landing page itself) falls through to the plain static mount, unchanged.
app.mount("/", StaticFiles(directory=ROOT, html=True), name="site")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 7860)))
