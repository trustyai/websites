# websites

## Cursor Cloud specific instructions

This repo contains a single Node.js/Express app in `vgrooving-cms/` (a visual CMS with a public frontend + password-protected admin). There is no database, no lint config, and no automated test suite — content persists to JSON files on disk.

### Running

- All commands run from the `vgrooving-cms/` directory.
- Start the dev server with `npm run dev` (identical to `npm start`: both run `node server.js`). There is no separate build step; it serves static files from `public/` and `admin/`.
- Serves on port 3000 by default; override with `PORT=8080 npm run dev`.
- URLs: frontend `http://localhost:3000`, admin `http://localhost:3000/admin`. Default admin login: `admin` / `admin123`.

### Gotchas

- `node server.js` has no file watcher/hot reload — restart the process after editing `server.js`. Frontend/admin static files (`public/`, `admin/`) just need a browser refresh.
- On first start the server generates `data/content.json` (from `data/content.default.json`) and `data/config.json` (holds the bcrypt password hash). Both are gitignored. Delete `data/config.json` to reset the login back to `admin`/`admin123`; delete `data/content.json` to reset content to the default template.
- Admin content saves overwrite the entire `data/content.json` with the posted object, so an incomplete POST to `/api/content` can blank out the site — reset by copying `data/content.default.json` over `data/content.json`.
