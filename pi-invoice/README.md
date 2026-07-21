# Kingpack Docs — PI & Invoice

Create **Proforma Invoice (PI)** and **Commercial Invoice** documents with per-equipment:

- Parameters / specs
- Image URL
- Video URL

Export to **PDF** or **Excel**. Both formats keep **clickable links** so customers can open each machine’s video or image directly.

## Quick start

```bash
cd pi-invoice
npm install
npm run dev
```

Build for production:

```bash
npm run build
npm run preview
```

## Features

- Toggle between PI and Invoice
- Seller / buyer party details
- Line items: name, model, parameters, qty, unit price, remarks
- Media fields: video link + image link (validated `http`/`https`)
- Live preview panel
- Draft auto-saved in `localStorage`
- **PDF**: media column + appendix with `textWithLink` hyperlinks
- **Excel**: hyperlinks on the main sheet + dedicated **Media Links** sheet

## Deploy

Static site — upload `dist/` to any static host (Nginx, OSS, Cloudflare Pages, etc.).
