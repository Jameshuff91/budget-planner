if (!self.define) {
  let e,
    s = {};
  const i = (i, n) => (
    (i = new URL(i + '.js', n).href),
    s[i] ||
      new Promise((s) => {
        if ('document' in self) {
          const e = document.createElement('script');
          ((e.src = i), (e.onload = s), document.head.appendChild(e));
        } else ((e = i), importScripts(i), s());
      }).then(() => {
        let e = s[i];
        if (!e) throw new Error(`Module ${i} didn’t register its module`);
        return e;
      })
  );
  self.define = (n, c) => {
    const a = e || ('document' in self ? document.currentScript.src : '') || location.href;
    if (s[a]) return;
    let t = {};
    const r = (e) => i(e, a),
      o = { module: { uri: a }, exports: t, require: r };
    s[a] = Promise.all(n.map((e) => o[e] || r(e))).then((e) => (c(...e), t));
  };
}
define(['./workbox-c18c662b'], function (e) {
  'use strict';
  (importScripts(),
    self.skipWaiting(),
    e.clientsClaim(),
    e.precacheAndRoute(
      [
        {
          url: '/_next/static/chunks/app/_not-found/page-6461b74aab6426b6.js',
          revision: 'lpE0PNQFgL57m91NlYghH',
        },
        {
          url: '/_next/static/chunks/app/layout-fc0228f25fbdd8f2.js',
          revision: 'lpE0PNQFgL57m91NlYghH',
        },
        {
          url: '/_next/static/chunks/app/page-8300002455014af4.js',
          revision: 'lpE0PNQFgL57m91NlYghH',
        },
        {
          url: '/_next/static/chunks/common-951ec5ad24fe23b8.js',
          revision: 'lpE0PNQFgL57m91NlYghH',
        },
        { url: '/_next/static/chunks/main-0669f5cb6af886bd.js', revision: 'lpE0PNQFgL57m91NlYghH' },
        {
          url: '/_next/static/chunks/main-app-0bd59d1cb5abab47.js',
          revision: 'lpE0PNQFgL57m91NlYghH',
        },
        {
          url: '/_next/static/chunks/pages/_app-e2c8b7d1403dc44d.js',
          revision: 'lpE0PNQFgL57m91NlYghH',
        },
        {
          url: '/_next/static/chunks/pages/_error-e3422949f9a6751a.js',
          revision: 'lpE0PNQFgL57m91NlYghH',
        },
        { url: '/_next/static/chunks/pdf-cdd6edcfa2bd4722.js', revision: 'lpE0PNQFgL57m91NlYghH' },
        {
          url: '/_next/static/chunks/polyfills-42372ed130431b0a.js',
          revision: '846118c33b2c0e922d7b3a7676f81f6f',
        },
        {
          url: '/_next/static/chunks/recharts-83690679473926c0.js',
          revision: 'lpE0PNQFgL57m91NlYghH',
        },
        { url: '/_next/static/chunks/ui-e4de72cfed7adf79.js', revision: 'lpE0PNQFgL57m91NlYghH' },
        {
          url: '/_next/static/chunks/vendor-da0f3295f7d6a8b5.js',
          revision: 'lpE0PNQFgL57m91NlYghH',
        },
        {
          url: '/_next/static/chunks/webpack-8e3ad48884d05607.js',
          revision: 'lpE0PNQFgL57m91NlYghH',
        },
        { url: '/_next/static/css/961bada56c2b8623.css', revision: '961bada56c2b8623' },
        {
          url: '/_next/static/lpE0PNQFgL57m91NlYghH/_buildManifest.js',
          revision: 'd4eae83d64c15dc9a42a07676de2f733',
        },
        {
          url: '/_next/static/lpE0PNQFgL57m91NlYghH/_ssgManifest.js',
          revision: 'b6652df95db52feb4daf4eca35380933',
        },
        {
          url: '/_next/static/media/4473ecc91f70f139-s.p.woff',
          revision: '78e6fc13ea317b55ab0bd6dc4849c110',
        },
        {
          url: '/_next/static/media/463dafcda517f24f-s.p.woff',
          revision: 'cbeb6d2d96eaa268b4b5beb0b46d9632',
        },
        { url: '/apple-touch-icon.png', revision: '3dc7a6d785f4a9f959201716e5dc034f' },
        { url: '/favicon-16x16.png', revision: 'c7d1137a20b049e5192b37fb75a129f7' },
        { url: '/favicon-32x32.png', revision: '84fda3cfbdef09caf63f3e36d3885a42' },
        { url: '/favicon.png', revision: '84fda3cfbdef09caf63f3e36d3885a42' },
        { url: '/icon-192x192.png', revision: '95ac3a7fa284b948b3528f68ca74df61' },
        { url: '/icon-512x512.png', revision: '6315a3138af64324f56fbb1591b5aef7' },
        { url: '/icon.svg', revision: '576b50d648803847a00652386fd301e1' },
        { url: '/offline.html', revision: 'b087eeac282f4443e9300c8b2fb1d805' },
        { url: '/pdf.worker.min.js', revision: 'c7e417206a259cbb0a814cb4e9ccb348' },
        { url: '/sw.js', revision: 'e652bae0ecdbd679578f9d6cd5af5d0a' },
        { url: '/swe-worker-5c72df51bb1f6ee0.js', revision: '5a47d90db13bb1309b25bdf7b363570e' },
      ],
      { ignoreURLParametersMatching: [/^utm_/, /^fbclid$/] },
    ),
    e.cleanupOutdatedCaches(),
    e.registerRoute(
      '/',
      new e.NetworkFirst({
        cacheName: 'start-url',
        plugins: [
          {
            cacheWillUpdate: async ({ response: e }) =>
              e && 'opaqueredirect' === e.type
                ? new Response(e.body, { status: 200, statusText: 'OK', headers: e.headers })
                : e,
          },
        ],
      }),
      'GET',
    ),
    e.registerRoute(
      /^https:\/\/fonts\.googleapis\.com\/.*/i,
      new e.CacheFirst({
        cacheName: 'google-fonts-stylesheets',
        plugins: [new e.ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 31536e3 })],
      }),
      'GET',
    ),
    e.registerRoute(
      /^https:\/\/fonts\.gstatic\.com\/.*/i,
      new e.CacheFirst({
        cacheName: 'google-fonts-webfonts',
        plugins: [new e.ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 31536e3 })],
      }),
      'GET',
    ),
    e.registerRoute(
      /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
      new e.CacheFirst({
        cacheName: 'static-images',
        plugins: [new e.ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 2592e3 })],
      }),
      'GET',
    ),
    e.registerRoute(
      /\.(?:js|css)$/i,
      new e.StaleWhileRevalidate({
        cacheName: 'static-resources',
        plugins: [new e.ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 604800 })],
      }),
      'GET',
    ),
    e.registerRoute(
      /^\/api\/.*/i,
      new e.NetworkFirst({
        cacheName: 'api-cache',
        networkTimeoutSeconds: 10,
        plugins: [new e.ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 300 })],
      }),
      'GET',
    ),
    (self.__WB_DISABLE_DEV_LOGS = !0));
});
