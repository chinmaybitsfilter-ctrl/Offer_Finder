# 🍕 Pizza Offers Near Me

Android app that shows **today's offers from every pizza shop near you**.

- **Where you are**: uses your phone's GPS (or an area/city you type) and finds pizza places around you from OpenStreetMap: Domino's, Pizza Hut, La Pino'z, Oven Story, Mojo and local shops.
- **What's on offer today**: a GitHub Action (`.github/workflows/offers.yml`) opens each chain's official ordering website in a headless mobile browser 3× a day (6:07 AM, 11:37 AM, 5:37 PM IST), picks up the offers and coupon codes those sites show (the same backend their official apps use), and saves them to `data/offers.json`.
- The app downloads that file each time you open it, so offers stay fresh without reinstalling.

## Install
1. Open **Releases → latest** in this repo on your phone.
2. Download `PizzaOffers.apk`, open it, allow "install unknown apps" if asked.
3. Allow location when the app asks.

## Refresh offers right now
Actions → **Fetch today's pizza offers** → **Run workflow**.

## Add another chain
Add an entry to `scraper/brands.mjs` (name, name-match regex, official offers URL).

## Notes
- Offers can vary by store/city. Tap **Order on …** to confirm in the official app/site.
- If a chain's site blocks the robot on a given day, the app shows that chain's last-known offers marked with the date.
- Local shops without online listings show "no online offers"; use **Call** to ask.
