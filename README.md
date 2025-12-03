# Bifacial Boost Estimator (Netlify-ready) — STC Column Parser v3

This package implements a strict STC table column parser:
- Finds the STC header row with multiple wattages (WP/Pmax)
- Extracts corresponding Imp and Isc columns
- Ignores W/m2, bifacial boost notes, and percent signs
- Returns modules: [{watts, model, isc, imp}]

Deploy:
1. Push to GitHub and import into Netlify
2. Netlify will install pdf-parse and deploy functions
3. Test with datasheets that have columnar STC tables (like your screenshot)

If extraction fails, enter values manually in the UI.
