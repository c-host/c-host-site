#!/usr/bin/env node
/**
 * Reads content/blog/<slug>/{meta.json,body.html}, writes:
 *   site/blog/index.html, site/blog/<slug>/index.html, site/blog/feed.xml
 * No npm dependencies.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CONTENT_DIR = path.join(ROOT, "content", "blog");
const SITE_BLOG = path.join(ROOT, "site", "blog");

const SITE_ORIGIN = (process.env.SITE_ORIGIN || "https://c-host.site").replace(/\/+$/, "");

function escapeXml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function readMeta(slugDir, slug) {
  const metaPath = path.join(slugDir, "meta.json");
  const raw = fs.readFileSync(metaPath, "utf8");
  const meta = JSON.parse(raw);
  if (!meta.title || !meta.date || !meta.slug) {
    throw new Error(`${metaPath}: meta.json requires title, date, slug`);
  }
  if (meta.slug !== slug) {
    throw new Error(`${metaPath}: slug "${meta.slug}" must match folder "${slug}"`);
  }
  return meta;
}

function readBody(slugDir) {
  const bodyPath = path.join(slugDir, "body.html");
  return fs.readFileSync(bodyPath, "utf8").trim();
}

/** Optional HTML snippet for Atom <content>; omit iframes — readers strip them anyway. */
function readRssBody(slugDir) {
  const p = path.join(slugDir, "rss.html");
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, "utf8").trim();
}

function copyDirRecursive(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of entries) {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(src, dest);
      continue;
    }
    if (entry.isFile()) {
      fs.copyFileSync(src, dest);
    }
  }
}

function layout({ title, description, canonicalUrl, depth, mainHtml }) {
  const asset = "../".repeat(depth) + "assets/";
  const root = "../".repeat(depth);
  const escTitle = escapeXml(title);
  const escDesc = escapeXml(description);
  return `<!doctype html>
<html lang="en">

<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escTitle}</title>
  <meta name="description" content="${escDesc}" />
  <link rel="canonical" href="${escapeXml(canonicalUrl)}" />
  <link rel="alternate" type="application/rss+xml" title="c-host — writing" href="${escapeXml(
    `${SITE_ORIGIN}/blog/feed.xml`
  )}" />
  <link rel="icon" href="${asset}favicon.svg" type="image/svg+xml" />
  <link rel="stylesheet" href="${asset}style.css" />
</head>

<body class="page">
  <div class="wrap">
    <header>
      <a class="site-title" href="${root}">c-host</a>
      <p class="tagline small">${depth === 1 ? "Essays, notes, and reflections" : `<a href="../">Writing</a>`}</p>
    </header>

    <main>
${mainHtml}
    </main>

    <footer class="small section">
      <div class="footer-bar">
        <a href="mailto:centralizedhosting@gmail.com" rel="me">[email]</a>
      </div>
    </footer>
  </div>

  <script src="${asset}site.js"></script>
</body>

</html>
`;
}

function collectPosts() {
  if (!fs.existsSync(CONTENT_DIR)) {
    return [];
  }
  const slugs = fs
    .readdirSync(CONTENT_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  const posts = [];
  for (const slug of slugs) {
    const slugDir = path.join(CONTENT_DIR, slug);
    const metaPath = path.join(slugDir, "meta.json");
    if (!fs.existsSync(metaPath)) continue;
    const meta = readMeta(slugDir, slug);
    const body = readBody(slugDir);
    const rssBody = readRssBody(slugDir);
    posts.push({ slug, slugDir, meta, body, rssBody });
  }

  posts.sort((a, b) => String(b.meta.date).localeCompare(String(a.meta.date)));
  return posts;
}

function writeBlogIndex(posts) {
  const items = posts
    .map((p) => {
      const url = `./${p.slug}/`;
      const date = escapeXml(p.meta.date);
      const title = escapeXml(p.meta.title);
      return `      <li>
        <a href="${url}"><span class="glyph">▸</span><span><time datetime="${date}">${date}</time> — ${title}</span></a>
      </li>`;
    })
    .join("\n");

  const mainHtml = `      <p class="blog-lede small">
        <a class="inline-link" href="./feed.xml">RSS</a>
      </p>
      <h1>Writing</h1>
      <ul class="nav blog-list" aria-label="Posts">
${items}
      </ul>`;

  const html = layout({
    title: "Writing — c-host",
    description: "Essays and notes.",
    canonicalUrl: `${SITE_ORIGIN}/blog/`,
    depth: 1,
    mainHtml,
  });

  fs.mkdirSync(SITE_BLOG, { recursive: true });
  fs.writeFileSync(path.join(SITE_BLOG, "index.html"), html, "utf8");
}

function writePost(post) {
  const { slug, slugDir, meta, body } = post;
  const canonicalUrl = `${SITE_ORIGIN}/blog/${slug}/`;
  const updated = meta.updated || meta.date;
  const mainHtml = `      <article class="blog-post">
        <p class="blog-meta small">
          <a href="../">&larr; Writing</a>
          &nbsp;&middot;&nbsp;
          <time datetime="${escapeXml(updated)}">${escapeXml(meta.date)}</time>
        </p>
        <h1>${escapeXml(meta.title)}</h1>
        <div class="blog-body">
${body.split("\n").map((line) => `          ${line}`).join("\n")}
        </div>
      </article>`;

  const html = layout({
    title: `${meta.title} — c-host`,
    description: meta.summary || meta.title,
    canonicalUrl,
    depth: 2,
    mainHtml,
  });

  const outDir = path.join(SITE_BLOG, slug);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), html, "utf8");

  // Copy per-post static assets if present: content/blog/<slug>/assets/* → site/blog/<slug>/assets/*
  const assetsSrc = path.join(slugDir, "assets");
  const assetsDest = path.join(outDir, "assets");
  copyDirRecursive(assetsSrc, assetsDest);
}

function atomFeed(posts) {
  const feedUpdated =
    posts.length > 0 ? posts[0].meta.updated || posts[0].meta.date : new Date().toISOString().slice(0, 10);

  const entries = posts
    .map((p) => {
      const url = `${SITE_ORIGIN}/blog/${p.slug}/`;
      const updated = p.meta.updated || p.meta.date;
      const id = url;
      const title = escapeXml(p.meta.title);
      const sum = escapeXml(p.meta.summary || "");
      const contentInner =
        p.rssBody ||
        `<p>${escapeXml(p.meta.summary || p.meta.title)}</p><p><a href="${escapeXml(url)}">Full post (including embeds)</a></p>`;

      return `  <entry>
    <title>${title}</title>
    <link href="${escapeXml(url)}" rel="alternate" />
    <id>${escapeXml(id)}</id>
    <updated>${escapeXml(updated)}T12:00:00Z</updated>
    <published>${escapeXml(p.meta.date)}T12:00:00Z</published>
    <summary>${sum}</summary>
    <content type="html"><![CDATA[
${contentInner}
    ]]></content>
  </entry>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>c-host — writing</title>
  <link href="${escapeXml(SITE_ORIGIN)}/blog/feed.xml" rel="self" />
  <link href="${escapeXml(SITE_ORIGIN)}/blog/" />
  <id>${escapeXml(SITE_ORIGIN)}/blog/feed.xml</id>
  <updated>${escapeXml(feedUpdated)}T12:00:00Z</updated>
  <author><name>c-host</name></author>
${entries}
</feed>
`;
}

function main() {
  const posts = collectPosts();
  writeBlogIndex(posts);
  for (const p of posts) writePost(p);
  fs.writeFileSync(path.join(SITE_BLOG, "feed.xml"), atomFeed(posts), "utf8");
  console.log(`blog: ${posts.length} post(s) → site/blog/`);
}

main();
