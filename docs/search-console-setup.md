# Google Search Console setup

The verification file belongs at `public/google673ab1b38fc73443.html`. Next.js copies it unchanged to `out/google673ab1b38fc73443.html`; Firebase Hosting serves `out/`.

After deploying the hosting build:

1. Open `https://eshwe.com/google673ab1b38fc73443.html` without signing in. It must return `google-site-verification: google673ab1b38fc73443.html`.
2. In the Search Console account that supplied the file, select the **URL-prefix** property `https://eshwe.com/` and complete **HTML file** verification. A **Domain** property uses DNS verification instead. Keep the file on the site after verification.
3. Submit `https://eshwe.com/sitemap.xml` under **Sitemaps**.
4. Inspect `https://eshwe.com/` and `https://eshwe.com/saree-culture/` with **URL inspection**. Run a live test and request indexing once the new build is live.
5. Review Page indexing and Performance over time. Search Console reports the queries that actually bring impressions; use those to identify useful follow-up guides and collection improvements.

The saree guide is statically rendered, has a canonical URL, Article and BreadcrumbList structured data, and links from both storefronts. Its regional overview is educational, not a claim that every mentioned weave is stocked. Its publication dates should change only when the article is actually updated.

The mobile homepage at `/app/` overrides the PWA layout's `noindex` default and points canonically to `/`. The desktop homepage declares `/app/` as its mobile alternate. Other PWA screens and owner pages keep their existing indexing restrictions.

Validate the exported output after a build:

```sh
npm run build:hosting
node scripts/check-seo-export.cjs
```

This work does not itself verify the property, submit the sitemap, or guarantee indexing or rankings. Use useful, accurate descriptions rather than repeated keyword lists.

Official guidance: [Search Console verification](https://support.google.com/webmasters/answer/9008080), [Google's SEO starter guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide), and [mobile-first indexing](https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing).
