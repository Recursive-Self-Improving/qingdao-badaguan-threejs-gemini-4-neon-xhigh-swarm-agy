# AGENTS.md

## Lessons

- Vite 6 preview inherits `server.host`. With this repository's `host: true` setting, use `npm run dev -- --host 127.0.0.1` or `npm run preview -- --host 127.0.0.1` for a loopback-only session.
- On Linux x64, the lockfile at commit `760997a` includes the native esbuild and Rollup packages. A fresh `npm ci --ignore-scripts --include=dev --include=optional` followed by `npm run build` with Node 24.22.3 reproduced all six files in `dist/` byte for byte.
- The existing Vite `base: './'` keeps built asset URLs relative, so GitHub Pages can serve `dist/` under the repository subpath without a Pages-specific build flag.
