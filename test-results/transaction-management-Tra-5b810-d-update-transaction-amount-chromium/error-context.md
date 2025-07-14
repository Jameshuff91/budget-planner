# Page snapshot

```yaml
- dialog "Unhandled Runtime Error":
  - navigation:
    - button "previous" [disabled]:
      - img "previous"
    - button "next" [disabled]:
      - img "next"
    - text: 1 of 1 error
  - button "Close"
  - heading "Unhandled Runtime Error" [level=1]
  - paragraph: "ChunkLoadError: Loading chunk app/page failed. (missing: http://localhost:3000/_next/static/chunks/app/page.js)"
  - heading "Call Stack" [level=2]
  - group:
    - img
    - img
    - text: Next.js
  - heading "Array.reduce" [level=3]
  - text: <anonymous>
  - group:
    - img
    - img
    - text: Next.js
  - group:
    - img
    - img
    - text: React
```