if (!self.define) {
  let e,
    n = {};
  const s = (s, a) => (
    (s = new URL(s + '.js', a).href),
    n[s] ||
      new Promise((n) => {
        if ('document' in self) {
          const e = document.createElement('script');
          ((e.src = s), (e.onload = n), document.head.appendChild(e));
        } else ((e = s), importScripts(s), n());
      }).then(() => {
        let e = n[s];
        if (!e) throw new Error(`Module ${s} didn’t register its module`);
        return e;
      })
  );
  self.define = (a, i) => {
    const t = e || ('document' in self ? document.currentScript.src : '') || location.href;
    if (n[t]) return;
    let c = {};
    const r = (e) => s(e, t),
      o = { module: { uri: t }, exports: c, require: r };
    n[t] = Promise.all(a.map((e) => o[e] || r(e))).then((e) => (i(...e), c));
  };
}
define(['./workbox-f1770938'], function (e) {
  'use strict';
  (importScripts(),
    self.skipWaiting(),
    e.clientsClaim(),
    e.precacheAndRoute(
      [
        {
          url: '/_next/static/On6H9GYPaoTYOnrdZH_ly/_buildManifest.js',
          revision: '172e769da91baa11de9b258fb2d92f86',
        },
        {
          url: '/_next/static/On6H9GYPaoTYOnrdZH_ly/_ssgManifest.js',
          revision: 'b6652df95db52feb4daf4eca35380933',
        },
        { url: '/_next/static/chunks/188-c826dc3a9438e585.js', revision: 'On6H9GYPaoTYOnrdZH_ly' },
        { url: '/_next/static/chunks/254-a0400d2c2770aec1.js', revision: 'On6H9GYPaoTYOnrdZH_ly' },
        { url: '/_next/static/chunks/279-d0d078fd148bf13c.js', revision: 'On6H9GYPaoTYOnrdZH_ly' },
        { url: '/_next/static/chunks/928-d155880381293225.js', revision: 'On6H9GYPaoTYOnrdZH_ly' },
        { url: '/_next/static/chunks/997-b17863ef5a7a5f87.js', revision: 'On6H9GYPaoTYOnrdZH_ly' },
        {
          url: '/_next/static/chunks/9b0008ae-04209a5d44d64794.js',
          revision: 'On6H9GYPaoTYOnrdZH_ly',
        },
        {
          url: '/_next/static/chunks/app/_not-found/page-bd80b54d3408eddb.js',
          revision: 'On6H9GYPaoTYOnrdZH_ly',
        },
        {
          url: '/_next/static/chunks/app/layout-10657cb8bdd7abd6.js',
          revision: 'On6H9GYPaoTYOnrdZH_ly',
        },
        {
          url: '/_next/static/chunks/app/page-db4c68f5cde62d96.js',
          revision: 'On6H9GYPaoTYOnrdZH_ly',
        },
        {
          url: '/_next/static/chunks/fd9d1056-fe992f465c928a17.js',
          revision: 'On6H9GYPaoTYOnrdZH_ly',
        },
        {
          url: '/_next/static/chunks/framework-00a8ba1a63cfdc9e.js',
          revision: 'On6H9GYPaoTYOnrdZH_ly',
        },
        { url: '/_next/static/chunks/main-6c077be21a624c64.js', revision: 'On6H9GYPaoTYOnrdZH_ly' },
        {
          url: '/_next/static/chunks/main-app-7abeeb00d99de937.js',
          revision: 'On6H9GYPaoTYOnrdZH_ly',
        },
        {
          url: '/_next/static/chunks/pages/_app-15e2daefa259f0b5.js',
          revision: 'On6H9GYPaoTYOnrdZH_ly',
        },
        {
          url: '/_next/static/chunks/pages/_error-28b803cb2479b966.js',
          revision: 'On6H9GYPaoTYOnrdZH_ly',
        },
        {
          url: '/_next/static/chunks/polyfills-42372ed130431b0a.js',
          revision: '846118c33b2c0e922d7b3a7676f81f6f',
        },
        {
          url: '/_next/static/chunks/webpack-3e0d035b9605ec2e.js',
          revision: 'On6H9GYPaoTYOnrdZH_ly',
        },
        { url: '/_next/static/css/366ef2cab3e9a87d.css', revision: '366ef2cab3e9a87d' },
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
        { url: '/pdf.worker.min.js', revision: 'c7e417206a259cbb0a814cb4e9ccb348' },
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
      /^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,
      new e.CacheFirst({
        cacheName: 'google-fonts-webfonts',
        plugins: [new e.ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 31536e3 })],
      }),
      'GET',
    ),
    e.registerRoute(
      /^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,
      new e.StaleWhileRevalidate({
        cacheName: 'google-fonts-stylesheets',
        plugins: [new e.ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 604800 })],
      }),
      'GET',
    ),
    e.registerRoute(
      /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
      new e.StaleWhileRevalidate({
        cacheName: 'static-font-assets',
        plugins: [new e.ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 604800 })],
      }),
      'GET',
    ),
    e.registerRoute(
      /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
      new e.StaleWhileRevalidate({
        cacheName: 'static-image-assets',
        plugins: [new e.ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 2592e3 })],
      }),
      'GET',
    ),
    e.registerRoute(
      /\/_next\/static.+\.js$/i,
      new e.CacheFirst({
        cacheName: 'next-static-js-assets',
        plugins: [new e.ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 86400 })],
      }),
      'GET',
    ),
    e.registerRoute(
      /\/_next\/image\?url=.+$/i,
      new e.StaleWhileRevalidate({
        cacheName: 'next-image',
        plugins: [new e.ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 86400 })],
      }),
      'GET',
    ),
    e.registerRoute(
      /\.(?:mp3|wav|ogg)$/i,
      new e.CacheFirst({
        cacheName: 'static-audio-assets',
        plugins: [
          new e.RangeRequestsPlugin(),
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET',
    ),
    e.registerRoute(
      /\.(?:mp4|webm)$/i,
      new e.CacheFirst({
        cacheName: 'static-video-assets',
        plugins: [
          new e.RangeRequestsPlugin(),
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET',
    ),
    e.registerRoute(
      /\.(?:js)$/i,
      new e.StaleWhileRevalidate({
        cacheName: 'static-js-assets',
        plugins: [new e.ExpirationPlugin({ maxEntries: 48, maxAgeSeconds: 86400 })],
      }),
      'GET',
    ),
    e.registerRoute(
      /\.(?:css|less)$/i,
      new e.StaleWhileRevalidate({
        cacheName: 'static-style-assets',
        plugins: [new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 })],
      }),
      'GET',
    ),
    e.registerRoute(
      /\/_next\/data\/.+\/.+\.json$/i,
      new e.StaleWhileRevalidate({
        cacheName: 'next-data',
        plugins: [new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 })],
      }),
      'GET',
    ),
    e.registerRoute(
      /\.(?:json|xml|csv)$/i,
      new e.NetworkFirst({
        cacheName: 'static-data-assets',
        plugins: [new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 })],
      }),
      'GET',
    ),
    e.registerRoute(
      ({ sameOrigin: e, url: { pathname: n } }) =>
        !(!e || n.startsWith('/api/auth/callback') || !n.startsWith('/api/')),
      new e.NetworkFirst({
        cacheName: 'apis',
        networkTimeoutSeconds: 10,
        plugins: [new e.ExpirationPlugin({ maxEntries: 16, maxAgeSeconds: 86400 })],
      }),
      'GET',
    ),
    e.registerRoute(
      ({ request: e, url: { pathname: n }, sameOrigin: s }) =>
        '1' === e.headers.get('RSC') &&
        '1' === e.headers.get('Next-Router-Prefetch') &&
        s &&
        !n.startsWith('/api/'),
      new e.NetworkFirst({
        cacheName: 'pages-rsc-prefetch',
        plugins: [new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 })],
      }),
      'GET',
    ),
    e.registerRoute(
      ({ request: e, url: { pathname: n }, sameOrigin: s }) =>
        '1' === e.headers.get('RSC') && s && !n.startsWith('/api/'),
      new e.NetworkFirst({
        cacheName: 'pages-rsc',
        plugins: [new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 })],
      }),
      'GET',
    ),
    e.registerRoute(
      ({ url: { pathname: e }, sameOrigin: n }) => n && !e.startsWith('/api/'),
      new e.NetworkFirst({
        cacheName: 'pages',
        plugins: [new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 })],
      }),
      'GET',
    ),
    e.registerRoute(
      ({ sameOrigin: e }) => !e,
      new e.NetworkFirst({
        cacheName: 'cross-origin',
        networkTimeoutSeconds: 10,
        plugins: [new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 3600 })],
      }),
      'GET',
    ),
    (self.__WB_DISABLE_DEV_LOGS = !0));
});
