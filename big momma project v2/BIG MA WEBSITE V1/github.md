repo: tyronne-os/robertson-family-legacy
branch: master

## Last sync
date: 2026-08-28T11:40:01Z
notes: Read-only audit — confirmed master's chapters.js/siblings.js are already fully wired (all 10 entries status:'complete', done:true). Pulled the per-chapter Kokoro voice assignments from chapters.js into this project's DC narrator widgets (browser TTS voice names matching af_/bf_ ids) and added autoplay-on-load to each.

### Voice map pulled from chapters.js
- Foreword -> heart, Chapter I Ethel -> bella, Chapter II Leola -> nova, Chapter III Johnnie -> isabella,
  Chapter IV Mary -> sarah, Chapter V Beulah -> nicole, Chapter VI Lydia -> heart, Chapter VII Beatrice -> emma,
  Chapter VIII Lamar -> sky, Chapter IX Susianna -> bella

## Screen map
| Page (this project) | Repo file |
|---|---|
| The Foreword - Big Ma.dc.html | src/data/chapters.js (id 0), src/components/Landing.jsx |
| Chapter One - Ethel Brown.dc.html | src/data/chapters.js (id 1) |
| Chapter Two - Leola Robertson.dc.html | src/data/chapters.js (id 2) |
| Chapter Three - Johnnie Robertson.dc.html | src/data/chapters.js (id 3) |
| Chapter Four - Mary Robertson.dc.html | src/data/chapters.js (id 4) |
| Chapter Five - Beulah Barabino.dc.html | src/data/chapters.js (id 5) |
| Voice Narrator Widget.dc.html (Chapter Six / Lydia) | src/data/chapters.js (id 6) |
| Chapter Seven - Beatrice Bowman.dc.html | src/data/chapters.js (id 7) |
| Chapter Eight - Lamar Robertson.dc.html | src/data/chapters.js (id 8) |
| Chapter Nine - Susianna Duchane.dc.html | src/data/chapters.js (id 9) |
| Magnolia Book Landing.dc.html | src/components/Landing.jsx, src/data/siblings.js |
