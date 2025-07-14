# Page snapshot

```yaml
- alert
- dialog "Server Error":
  - navigation:
    - button "previous" [disabled]:
      - img "previous"
    - button "next" [disabled]:
      - img "next"
    - text: 1 of 1 error Next.js (14.2.16) is outdated
    - link "(learn more)":
      - /url: https://nextjs.org/docs/messages/version-staleness
  - heading "Server Error" [level=1]
  - paragraph: "Error: Cannot find module '/Users/jimhuff/Documents/Github/budget-planner/.next/server/app/page.js' Require stack: - /Users/jimhuff/Documents/Github/budget-planner/node_modules/next/dist/server/require.js - /Users/jimhuff/Documents/Github/budget-planner/node_modules/next/dist/server/load-components.js - /Users/jimhuff/Documents/Github/budget-planner/node_modules/next/dist/build/utils.js - /Users/jimhuff/Documents/Github/budget-planner/node_modules/next/dist/server/dev/hot-middleware.js - /Users/jimhuff/Documents/Github/budget-planner/node_modules/next/dist/server/dev/hot-reloader-webpack.js - /Users/jimhuff/Documents/Github/budget-planner/node_modules/next/dist/server/lib/router-utils/setup-dev-bundler.js - /Users/jimhuff/Documents/Github/budget-planner/node_modules/next/dist/server/lib/router-server.js - /Users/jimhuff/Documents/Github/budget-planner/node_modules/next/dist/server/lib/start-server.js"
  - text: This error happened while generating the page. Any console logs will be displayed in the terminal window.
  - heading "Call Stack" [level=2]
  - group:
    - img
    - img
    - text: Next.js
  - heading "TracingChannel.traceSync" [level=3]
  - text: node:diagnostics_channel (322:14)
  - group:
    - img
    - img
    - text: Next.js
```