# Bifacial Boost Estimator (Netlify-ready)

This project is a polished UI for estimating bifacial boost and supports uploading a module datasheet (PDF),
extracting Isc/Imp/fuse values, and calculating conservative bifacial boost using geometry multipliers.

## Deploy on Netlify (from Git)
1. Create a GitHub repo and push this folder.
2. In Netlify, choose "Import from Git" and select the repo.
3. Netlify will detect functions in `netlify/functions`.
4. Deploy.

## Local dev with Netlify CLI
- `npm i -g netlify-cli`
- `npm install` (to install pdf-parse)
- `netlify dev`
