# Bifacial Boost Estimator (Netlify-ready) — Module Variant Selection

This package improves module datasheet extraction by detecting multiple module variants
in one PDF and presenting a manual wattage-only selector for the user to pick the variant.
It explicitly ignores lines mentioning bifacial/gain/boost so the manufacturer-provided
boost figures are not used.

Deployment:
1. Push to GitHub and import into Netlify (Import from Git).
2. Netlify will install dependencies and deploy functions.
3. Test by uploading a real module datasheet with multiple Pmax variants.

Local dev:
- npm install
- npm i -g netlify-cli
- netlify dev
