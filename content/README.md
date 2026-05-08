# Site content (blog source)

Authoring lives here. HTML is generated in `site/blog/` and should not be edited. Run the build (below) so listing pages, permalinks, and the RSS feed stay in sync.

## New post

1. Copy `blog/example-post/` to `blog/<your-slug>/` (folder name = URL slug).
2. Edit `meta.json`: set `slug` to match the folder, plus `title`, `date`, and `summary` (plain text, used in RSS).
3. Write **`body.html`** — using HTML (including iframes, figures, etc.).
4. Optionally add **`rss.html`** — HTML for feed readers only; skip embeds readers strip anyway. If omitted, the feed uses `summary` plus a link to the full post.

Optional **`meta.json`** field: `updated` (ISO date) if you revise a post later.

## Build

From the repo root:

```bash
node tools/build-blog.mjs
```

Writes `site/blog/index.html`, `site/blog/<slug>/index.html`, `site/blog/feed.xml`, and copies static assets from `content/blog/<slug>/assets/` to `site/blog/<slug>/assets/`.

Use a different base URL for canonical links and Atom IDs (e.g. staging):

```bash
SITE_ORIGIN=https://example.com node tools/build-blog.mjs
```

Production deploy uses `SITE_ORIGIN=https://c-host.site` in `.github/workflows/pages.yml`.

## Preview locally

After building, serve **`site/`** (not `content/`) so paths resolve correctly:

```bash
npx --yes serve site -p 4321
```

Then open `http://localhost:4321/blog/`.

## Deploy

Push to `main`. GitHub Actions runs the same build command, then uploads **`site/`** to Pages. Commit **`content/blog/`** changes; committing the regenerated **`site/blog/`** files keeps the repo aligned with what you previewed, but CI will regenerate them from `content/` either way.
