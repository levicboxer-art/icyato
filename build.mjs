/**
 * Static site builder.
 * Assembles src/pages + src/partials + hashed CSS/JS into dist/.
 */
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(root, "src");
const distDir = path.join(root, "dist");

const SITE_URL = "https://cyatotea.net";
const YEAR = new Date().getFullYear();
const TODAY = new Date().toISOString().slice(0, 10);

const hash = (text) => crypto.createHash("sha256").update(text).digest("hex").slice(0, 8);

const read = (file) => readFile(file, "utf8");

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const render = (template, tokens) =>
  template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(tokens, key) ? tokens[key] : match
  );

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: "Cyato Tea Plantation & Factory Ltd",
  alternateName: "Cyato Tea",
  url: `${SITE_URL}/`,
  logo: `${SITE_URL}/assets/img/logo.png`,
  image: `${SITE_URL}/assets/img/og-cyato.jpg`,
  description:
    "Single-origin Rwandan tea grown, processed and manufactured in Nyamasheke District. Bulk tea supply, CTC tea grades, private label, co-packaging and custom blending for international buyers.",
  telephone: "+250 788 310 481",
  address: {
    "@type": "PostalAddress",
    streetAddress: "J5M6+45, Colline Mpage",
    addressLocality: "Nyamasheke",
    addressRegion: "Western Province",
    addressCountry: "RW",
  },
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "+250 788 310 481",
    contactType: "sales",
    areaServed: "Worldwide",
    availableLanguage: ["English", "Kinyarwanda"],
  },
  sameAs: [SITE_URL],
};

async function build() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(path.join(distDir, "assets", "styles"), { recursive: true });
  await mkdir(path.join(distDir, "assets", "scripts"), { recursive: true });

  // Hashed presentation assets
  const cssSource = await read(path.join(srcDir, "styles", "main.css"));
  const cinematicSource = await read(path.join(srcDir, "scripts", "cinematic.js"));
  const siteSource = await read(path.join(srcDir, "scripts", "site.js"));
  const tunnelSource = await read(path.join(srcDir, "scripts", "tunnel.js"));

  const cssFile = `main.${hash(cssSource)}.css`;
  const cinematicFile = `cinematic.${hash(cinematicSource)}.js`;
  const siteFile = `site.${hash(siteSource)}.js`;
  const tunnelFile = `tunnel.${hash(tunnelSource)}.js`;

  await writeFile(path.join(distDir, "assets", "styles", cssFile), cssSource);
  await writeFile(path.join(distDir, "assets", "scripts", cinematicFile), cinematicSource);
  await writeFile(path.join(distDir, "assets", "scripts", siteFile), siteSource);
  await writeFile(path.join(distDir, "assets", "scripts", tunnelFile), tunnelSource);

  // Partials
  const partialsDir = path.join(srcDir, "partials");
  const headPartial = await read(path.join(partialsDir, "head.html"));
  const headerPartial = await read(path.join(partialsDir, "header.html"));
  const footerPartial = await read(path.join(partialsDir, "footer.html"));
  const ctaPartial = await read(path.join(partialsDir, "cta.html"));

  const pagesDir = path.join(srcDir, "pages");
  const pageFiles = (await readdir(pagesDir)).filter((file) => file.endsWith(".html")).sort();

  const builtPages = [];

  for (const file of pageFiles) {
    const raw = await read(path.join(pagesDir, file));
    const match = raw.match(/^<!--meta\s*([\s\S]*?)-->\s*/);
    if (!match) throw new Error(`Missing <!--meta ...--> block in ${file}`);

    const meta = JSON.parse(match[1]);
    const body = raw.slice(match[0].length);

    const outPath = (meta.out || "").replace(/^\/+|\/+$/g, "");
    const pagePath = outPath ? `/${outPath}/` : "/";
    const isNotFound = meta.out === "__404";
    // A standalone 404 document is served under arbitrary URLs, so it is
    // explicitly excluded from indexing and never canonicalised to a fake path.
    const canonical = isNotFound ? `${SITE_URL}/404.html` : `${SITE_URL}${pagePath}`;

    const tokens = {
      YEAR: String(YEAR),
      TITLE: escapeHtml(meta.title),
      DESCRIPTION: escapeHtml(meta.description),
      CANONICAL: canonical,
      ROBOTS: isNotFound ? '<meta name="robots" content="noindex, follow" />' : "",
      OG_TITLE: escapeHtml(meta.ogTitle || meta.title),
      OG_DESCRIPTION: escapeHtml(meta.ogDescription || meta.description),
      OG_TYPE: meta.ogType || "website",
      BODY_CLASS: meta.bodyClass || "",
      CSS_URL: `/assets/styles/${cssFile}`,
      CINEMATIC_JS: `/assets/scripts/${cinematicFile}`,
      SITE_JS: `/assets/scripts/${siteFile}`,
      TUNNEL_JS: meta.tunnel ? `<script src="/assets/scripts/${tunnelFile}" defer></script>` : "",
      SCHEMA: JSON.stringify(organizationSchema),
      PRELOAD_IMAGE: meta.preloadImage || "",
      CTA: render(ctaPartial, { YEAR: String(YEAR) }),
    };

    // Head partial is rendered last so nested partials can use tokens too.
    tokens.HEADER = render(headerPartial, tokens);
    tokens.FOOTER = render(footerPartial, tokens);

    const head = render(headPartial, tokens);
    const content = render(body, tokens);
    const html = `${head}\n${tokens.HEADER}\n${content}\n${tokens.FOOTER}\n</body>\n</html>\n`;

    const outDir = isNotFound ? distDir : path.join(distDir, outPath);
    const outFile = isNotFound ? path.join(distDir, "404.html") : path.join(outDir, "index.html");

    await mkdir(outDir, { recursive: true });
    await writeFile(outFile, html);
    builtPages.push({ pagePath, file: outFile, notFound: isNotFound });
  }

  // sitemap.xml
  const sitemapEntries = builtPages
    .filter((page) => !page.notFound)
    .map(
      (page) =>
        `  <url>\n    <loc>${SITE_URL}${page.pagePath}</loc>\n    <lastmod>${TODAY}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>${page.pagePath === "/" ? "1.0" : "0.8"}</priority>\n  </url>`
    )
    .join("\n");

  await writeFile(
    path.join(distDir, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries}\n</urlset>\n`
  );

  await writeFile(
    path.join(distDir, "robots.txt"),
    `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`
  );

  console.log(`Built ${builtPages.length} pages`);
  builtPages.forEach((page) => {
    console.log(`  ${(page.notFound ? "/404.html" : page.pagePath).padEnd(24)} -> ${path.relative(root, page.file)}`);
  });
  console.log(`  CSS ${cssFile} · cinematic ${cinematicFile} · site ${siteFile} · tunnel ${tunnelFile}`);
}

build().catch((error) => {
  console.error("Build failed:", error);
  process.exitCode = 1;
});
