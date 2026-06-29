#!/usr/bin/env node
/**
 * Reads content/blog-en/<slug>/{meta.json,body.html} (English) and
 * content/blog-ka/<slug>/{meta.json,body.html} (Georgian), writes:
 *   site/blog/en/index.html, site/blog/ka/index.html — post list only (between HTML markers)
 *   site/blog/en/<slug>/index.html, site/blog/ka/<slug>/index.html, feed.xml per locale
 * No npm dependencies.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SITE_ROOT = path.join(ROOT, "site");

const SITE_ORIGIN = (process.env.SITE_ORIGIN || "https://c-host.site").replace(/\/+$/, "");

const POST_LIST_START = "<!-- blog:posts:start -->";
const POST_LIST_END = "<!-- blog:posts:end -->";

/** Per-language configuration. Each locale is a self-contained blog section. */
const LOCALES = [
  {
    code: "en",
    htmlLang: "en",
    contentDir: path.join(ROOT, "content", "blog-en"),
    outDir: path.join(SITE_ROOT, "blog", "en"),
    basePath: "/blog/en/",
    feedTitle: "c-host — writing",
    strings: {
      backToWriting: "Writing",
      backToWritingAriaLabel: "Back to writing",
      homeAriaLabel: "c-host home",
      emailLabel: "[email]",
      emailAriaLabel: "Email",
      backToTop: "[back to top]",
      backToTopAriaLabel: "Back to top",
      feedFullPostLink: "Open the full post",
      feedFullPostSuffix: "for images, embeds, and the complete layout.",
    },
  },
  {
    code: "ka",
    htmlLang: "ka",
    contentDir: path.join(ROOT, "content", "blog-ka"),
    outDir: path.join(SITE_ROOT, "blog", "ka"),
    basePath: "/blog/ka/",
    feedTitle: "c-host — წერა",
    strings: {
      backToWriting: "წერა",
      backToWritingAriaLabel: "წერაზე დაბრუნება",
      homeAriaLabel: "c-host — მთავარი გვერდი",
      emailLabel: "[ელ.ფოსტა]",
      emailAriaLabel: "ელ. ფოსტა",
      backToTop: "[ზემოთ]",
      backToTopAriaLabel: "ზემოთ დაბრუნება",
      feedFullPostLink: "სრული ჩანაწერის გახსნა",
      feedFullPostSuffix: "გამოსახულებების, ჩართვების და სრული განლაგებისთვის.",
    },
  },
];

function escapeXml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Number of path segments from the site root to a directory (controls ../ depth). */
function depthOf(dir) {
  const rel = path.relative(SITE_ROOT, dir);
  return rel.split(path.sep).filter(Boolean).length;
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

function layout({ htmlLang, title, description, canonicalUrl, feedUrl, feedTitle, homeAriaLabel, emailLabel, emailAriaLabel, backToTop, backToTopAriaLabel, depth, taglineHtml, mainHtml }) {
  const asset = "../".repeat(depth) + "assets/";
  const root = "../".repeat(depth);
  const escTitle = escapeXml(title);
  const escDesc = escapeXml(description);
  return `<!doctype html>
<html lang="${htmlLang}">

<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escTitle}</title>
  <meta name="description" content="${escDesc}" />
  <link rel="canonical" href="${escapeXml(canonicalUrl)}" />
  <link rel="alternate" type="application/rss+xml" title="${escapeXml(feedTitle)}" href="${escapeXml(feedUrl)}" />
  <link rel="icon" href="${asset}favicon.svg" type="image/svg+xml" />
  <link rel="stylesheet" href="${asset}style.css" />
</head>

<body class="page">
  <div class="wrap" id="top">
    <header>
      <a class="site-title" href="${root}" aria-label="${escapeXml(homeAriaLabel)}">c-host</a>
      <p class="tagline small">${taglineHtml}</p>
    </header>

    <main>
${mainHtml}
    </main>

    <footer class="small section">
      <div class="footer-bar footer-bar--post">
        <a href="mailto:centralizedhosting@gmail.com" rel="me" aria-label="${escapeXml(emailAriaLabel)}">${escapeXml(emailLabel)}</a>
        <a class="footer-bar__back-to-top" href="#top" aria-label="${escapeXml(backToTopAriaLabel)}">${escapeXml(backToTop)}</a>
      </div>
    </footer>
  </div>

  <script src="${asset}site.js"></script>
</body>

</html>
`;
}

function collectPosts(contentDir) {
  if (!fs.existsSync(contentDir)) {
    return [];
  }
  const slugs = fs
    .readdirSync(contentDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  const posts = [];
  for (const slug of slugs) {
    const slugDir = path.join(contentDir, slug);
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

function renderPostListItems(posts) {
  return posts
    .map((p) => {
      const url = `./${p.slug}/`;
      const date = escapeXml(p.meta.date);
      const title = escapeXml(p.meta.title);
      return `      <li>
        <a href="${url}"><span class="glyph" aria-hidden="true">▸</span><span><time datetime="${date}">${date}</time> — ${title}</span></a>
      </li>`;
    })
    .join("\n");
}

/** Replace only the post list inside a hand-edited index.html. */
function updateBlogIndex(locale, posts) {
  const indexPath = path.join(locale.outDir, "index.html");
  if (!fs.existsSync(indexPath)) {
    throw new Error(
      `${path.relative(ROOT, indexPath)} is missing. Create it with ${POST_LIST_START} and ${POST_LIST_END} markers around the post list.`
    );
  }

  let html = fs.readFileSync(indexPath, "utf8");
  const startIdx = html.indexOf(POST_LIST_START);
  const endIdx = html.indexOf(POST_LIST_END);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    throw new Error(
      `${path.relative(ROOT, indexPath)} must contain ${POST_LIST_START} and ${POST_LIST_END} markers.`
    );
  }

  const items = renderPostListItems(posts);
  const before = html.slice(0, startIdx + POST_LIST_START.length);
  const after = html.slice(endIdx);
  html = items ? `${before}\n${items}\n${after}` : `${before}\n${after}`;
  fs.writeFileSync(indexPath, html, "utf8");
}

function writePost(locale, post) {
  const s = locale.strings;
  const { slug, slugDir, meta, body } = post;
  const canonicalUrl = `${SITE_ORIGIN}${locale.basePath}${slug}/`;
  const updated = meta.updated || meta.date;
  const mainHtml = `      <article class="blog-post">
        <p class="blog-meta small">
          <a href="../" aria-label="${escapeXml(s.backToWritingAriaLabel)}">&larr; ${escapeXml(s.backToWriting)}</a>
          &nbsp;&middot;&nbsp;
          <time datetime="${escapeXml(updated)}">${escapeXml(meta.date)}</time>
        </p>
        <h1>${escapeXml(meta.title)}</h1>
        <div class="blog-body">
${body.split("\n").map((line) => `          ${line}`).join("\n")}
        </div>
      </article>`;

  const outDir = path.join(locale.outDir, slug);
  const html = layout({
    htmlLang: locale.htmlLang,
    title: `${meta.title} — c-host`,
    description: meta.summary || meta.title,
    canonicalUrl,
    feedUrl: `${SITE_ORIGIN}${locale.basePath}feed.xml`,
    feedTitle: locale.feedTitle,
    emailLabel: s.emailLabel,
    emailAriaLabel: s.emailAriaLabel,
    backToTop: s.backToTop,
    backToTopAriaLabel: s.backToTopAriaLabel,
    homeAriaLabel: s.homeAriaLabel,
    depth: depthOf(outDir),
    taglineHtml: `<a href="../" aria-label="${escapeXml(s.backToWritingAriaLabel)}">${escapeXml(s.backToWriting)}</a>`,
    mainHtml,
  });

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), html, "utf8");

  // Copy per-post static assets if present: <slugDir>/assets/* → <outDir>/assets/*
  copyDirRecursive(path.join(slugDir, "assets"), path.join(outDir, "assets"));
}

function renderFeedEntryContent(locale, post) {
  const url = `${SITE_ORIGIN}${locale.basePath}${post.slug}/`;
  const s = locale.strings;
  const excerpt = post.rssBody
    ? post.rssBody.trim()
    : `<p>${escapeXml(post.meta.summary || post.meta.title)}</p>`;
  const linkPara = `<p><a href="${escapeXml(url)}">${escapeXml(s.feedFullPostLink)}</a> ${escapeXml(s.feedFullPostSuffix)}</p>`;
  return `${excerpt}\n${linkPara}`;
}

/** Remove generated post folders that no longer exist in content (e.g. after a slug rename). */
function pruneStalePosts(locale, posts) {
  if (!fs.existsSync(locale.outDir)) return;
  const activeSlugs = new Set(posts.map((p) => p.slug));
  for (const entry of fs.readdirSync(locale.outDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || activeSlugs.has(entry.name)) continue;
    fs.rmSync(path.join(locale.outDir, entry.name), { recursive: true, force: true });
    console.log(`blog[${locale.code}]: removed stale ${path.relative(ROOT, path.join(locale.outDir, entry.name))}/`);
  }
}

function atomFeed(locale, posts) {
  const feedUpdated =
    posts.length > 0 ? posts[0].meta.updated || posts[0].meta.date : new Date().toISOString().slice(0, 10);

  const entries = posts
    .map((p) => {
      const url = `${SITE_ORIGIN}${locale.basePath}${p.slug}/`;
      const updated = p.meta.updated || p.meta.date;
      const id = url;
      const title = escapeXml(p.meta.title);
      const sum = escapeXml(p.meta.summary || "");
      const contentInner = renderFeedEntryContent(locale, p);

      return `  <entry xml:lang="${locale.htmlLang}">
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
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${locale.htmlLang}">
  <title>${escapeXml(locale.feedTitle)}</title>
  <link href="${escapeXml(SITE_ORIGIN)}${locale.basePath}feed.xml" rel="self" />
  <link href="${escapeXml(SITE_ORIGIN)}${locale.basePath}" />
  <id>${escapeXml(SITE_ORIGIN)}${locale.basePath}feed.xml</id>
  <updated>${escapeXml(feedUpdated)}T12:00:00Z</updated>
  <author><name>c-host</name></author>
${entries}
</feed>
`;
}

function buildLocale(locale) {
  const posts = collectPosts(locale.contentDir);
  fs.mkdirSync(locale.outDir, { recursive: true });
  pruneStalePosts(locale, posts);
  updateBlogIndex(locale, posts);
  for (const p of posts) writePost(locale, p);
  fs.writeFileSync(path.join(locale.outDir, "feed.xml"), atomFeed(locale, posts), "utf8");
  console.log(`blog[${locale.code}]: ${posts.length} post(s) → ${path.relative(ROOT, locale.outDir)}/`);
}

function main() {
  for (const locale of LOCALES) buildLocale(locale);
}

main();
