# Heritage Tree

Fill in your family tree — couples, their children, and the children's children —
and keep a note on each person's life. English and Italian.

It is a **local-first web app**: everything you type is stored in your own
browser and never sent anywhere. There is no account, no server and no database.
Backing up and moving between devices is done by exporting a JSON file.

## Why a web app and not an Android app

Installed from Chrome via *Add to Home screen*, this gets its own icon, opens
without browser chrome and works offline — so on a phone it behaves like a
native app. It also runs on any laptop or tablet, which matters for something
you will want to show relatives, and it deploys with a `git push`. If it ever
needs to be in the Play Store, the same code can be wrapped in a Trusted Web
Activity without a rewrite.

## Features

- Couples, their children, and unlimited generations below.
- Grow the tree upwards: **Add parents above** puts a new couple over the root.
- Second marriages and single parents.
- Click anyone to open their card: dates of birth and death, place of birth,
  notes on their life, and — once a date of death is entered — notes on their
  death.
- Dates are free text, so partial genealogical dates work: `1923`,
  `12/05/1923`, `about 1923`.
- **Colour by surname.** The colour is derived from the surname itself, so
  siblings, cousins and anyone else sharing a surname always match. Deceased
  people keep their family colour but are drawn desaturated with a dashed
  border. Any surname's colour can be overridden by hand.
- **Surname inheritance.** A new child starts with the father's surname — the
  partner marked *Male* — falling back to whichever partner has a surname. It is
  a default applied once, so it is always editable afterwards and renaming an
  ancestor never rewrites descendants who are already named.
- Undo/redo (⌘Z / Ctrl+Z), pan, pinch-zoom, fit-to-screen.
- English and Italian, following the browser's language by default.
- Works offline; installable to a phone home screen.

## Running locally

```bash
npm install
npm run dev
```

## Deploying to GitHub Pages

`.github/workflows/deploy.yml` builds and publishes on every push to `main`.
One-time setup:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. Push to `main`.

The site then lives at `https://<your-username>.github.io/heritagetree/`.

The base path comes from the `BASE_PATH` environment variable at build time and
defaults to `/heritagetree/`. To host at a domain root instead, build with
`BASE_PATH=/ npm run build`.

## Your data

| | |
|---|---|
| Where it lives | IndexedDB, in the browser on the device you typed it into |
| Leaves the device | Never — there is no network call after the page loads |
| Backup | **Export** writes a `.json` file; **Import** reads it back |
| Different device | Export, move the file across, import |

Because the data is per-browser, clearing site data or uninstalling the app will
delete the tree. Export from time to time.

## How it is built

| | |
|---|---|
| React + TypeScript + Vite | app and build |
| `vite-plugin-pwa` | offline support and the installable manifest |
| `zustand` | state, with undo/redo and debounced autosave |
| `idb` | IndexedDB persistence |
| `react-i18next` | English/Italian |
| custom layout in `src/lib/layout.ts` | tree geometry |

### The data model

The tree is not a plain parent→children tree. A **`Union`** (a couple) is a
first-class record, and children belong to a union rather than to a person:

```
Person { id, firstName, surname, gender, birthDate, deathDate, notes…, parentUnionId }
Union  { id, partnerIds[], childIds[], marriageDate, notes }
```

That is what makes remarriage, single parents and "add a couple above the root"
all fall out of one code path instead of three special cases.

`src/lib/layout.ts` turns that into coordinates. Each person is laid out with
their partners in a row and their descendants beneath; a couple is centred over
its children's *anchor points* rather than over their bounding box, so a lone
child sits directly under its parents instead of being pushed aside by its own
spouse and descendants.
