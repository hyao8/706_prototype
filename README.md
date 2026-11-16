# Orphadata Rare-Disease Explorer

Interactive, web-based explorer for [Orphadata](https://sciences.orphadata.com/), the open data release of the
Orphanet rare-disease knowledge base. It links diseases to their genes, clinical signs (HPO terms), medical
specialties, prevalence and age of onset.

BMI 706 visualization project, Group 7 (Haozhe Yao, Haolin Wan, Junhan Yang, Jerry Wan). Prototype **v0.1** (Step 4).

**Live app:** https://hyao8.github.io/706_prototype/ (served by GitHub Pages from `main`)

## What it does

The header holds one search box (diseases, genes, clinical signs), three page tabs and the data release label.
A filter panel on the left is the same on every page.

| Task (Step 2) | Where |
| --- | --- |
| T1 Specialties with the most disorders, and their overlap | Overview: specialty bars + overlap matrix |
| T2 One disease's genes, signs, prevalence, age of onset | Disease: profile |
| T3 A gene, all its diseases and their specialties | Gene: gene–disease links + specialty bars |
| T4 Filter diseases by clinical sign frequency | Filter panel: signs + minimum frequency; Overview: ranked candidates |
| T5 Compare the signs that distinguish related diseases | Disease: sign comparison matrix |
| T6 Compare prevalence distributions across specialties | Overview: one 100% stacked bar per specialty |

## Run it locally

Requirements: [Node.js](https://nodejs.org/) 20 or newer. The processed data file is committed, so Python is not
needed just to run the app.

```bash
git clone https://github.com/hyao8/706_prototype.git
cd 706_prototype
npm ci          # installs the exact versions in package-lock.json
npm run dev     # dev server on http://localhost:5173
```

`npm run build` writes the static site to `dist/`; `npm run preview` serves that build.

## Rebuild the data (optional)

`public/data/orphadata.json` is generated from the Orphadata XML files. To regenerate it you need Python 3.10+.

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt    # macOS/Linux: .venv/bin/python
.venv/Scripts/python scripts/download_data.py              # about 200 MB of XML into data/raw/ (git-ignored)
.venv/Scripts/python scripts/build_data.py                 # writes public/data/orphadata.json (about 4.6 MB)
```

The pipeline uses the full dataset, with no sampling: 10,101 active entities (6,659 disorders, 2,264 groups,
1,178 subtypes), 4,623 genes with 8,503 disease–gene links, and 8,758 HPO signs with 116,664 disease–sign
annotations. Inactive entities are dropped.

## Architecture

```
Orphadata XML (6 products + 35 classification files)
   |  scripts/download_data.py      download into data/raw/
   v
scripts/build_data.py               parse with lxml, keep the needed fields, join on ORPHAcode
   v
public/data/orphadata.json          one compact file: diseases, genes, signs, specialties, vocabularies
   v
src/data.js                         load once, build indices; filtering, scoring, search
   v
src/state.js                        one shared state; views read it and write to it through update()
   v
src/main.js                         shell (header, search, selection bar); redraws the current page
src/filters.js                      left filter panel
src/views/overview.js               specialty bars, overlap matrix, prevalence bars, candidate list
src/views/disease.js                disease profile, sign comparison matrix
src/views/gene.js                   ranked genes, bipartite graph / matrix, specialty bars
```

- **No server.** The processed data is about 1 MB gzipped, so the browser loads all of it and filters in memory.
- **How the views are linked.** There is one shared state object (`src/state.js`): filters (signs, minimum
  frequency, classification level, onset, inheritance, prevalence class, data completeness) and selections
  (specialty or exact specialty combination, focused disease, comparison set, focused gene). A view never talks to
  another view. It calls `update()`, and every visible view is redrawn from the new state. For example, clicking
  a specialty row scopes the candidate list; ticking candidates fills the comparison matrix; clicking a gene symbol
  anywhere opens the Gene page on that gene; clicking a disease there returns to its profile.
- **Stack.** Plain JavaScript (ES modules), [D3](https://d3js.org/) for scales and SVG, [Vite](https://vite.dev/)
  as the build tool. Deployed as a static site by `.github/workflows/deploy.yml`.

## Design decisions worth knowing

- **Multi-specialty diseases.** By default each disease is counted once, under its preferential specialty
  (Orphanet linearisation). A toggle counts it in every specialty it belongs to, and the overlap matrix shows the
  largest exact combinations. In this release 89.8% of disorders belong to more than one of the 35 classifications
  (the 67.7% quoted in Step 2 comes from the literature, on an earlier release).
- **Missing is not zero.** Prevalence has two explicit missing states: *Unknown* (records exist, none gives a
  class) and *No record*. A mean value of 0 in the source means "class only" and is never plotted as zero. A disease
  without sign annotations is labelled as missing data in the matrix.
- **Representative prevalence class.** One class per disease: point prevalence first, then prevalence at birth,
  then lifetime prevalence; Worldwide before Europe before other regions; validated records first. The basis and
  all source records are shown on the disease profile.
- **Sign score.** Score = sum of frequency weights of the matched signs ÷ number of signs asked for. Weights are
  the midpoints of the HPO frequency classes (Obligate 1, Very frequent 0.9, Frequent 0.55, Occasional 0.17,
  Very rare 0.025). The score, the matched count and one shaded square per sign are shown next to every candidate.
- **Colour.** 35 specialties are too many for colour, so colour is used only for selection (orange), sign frequency
  (blue ramp) and prevalence class (viridis).

## Known limitations of the prototype

- Grouping signs by body system (planned for the overview) is not implemented yet.
- Functional consequences are not used, and prevalence geography is only listed in the profile's source records.
- Designed for desktop screens of 1280 px and wider.
- The state is not stored in the URL beyond the page tab.

## Third-party libraries

| Library | Version | License | Used for |
| --- | --- | --- | --- |
| [d3](https://github.com/d3/d3) | 7.9.2 | ISC | scales, SVG rendering |
| [vite](https://github.com/vitejs/vite) | 8.3.8 | MIT | dev server and build (dev dependency) |
| [lxml](https://github.com/lxml/lxml) | 6.1.3 | BSD-3-Clause | XML parsing in the data pipeline |

Exact versions of all transitive JavaScript dependencies are pinned in `package-lock.json`.

## Data and attribution

Orphadata Science: Free access data from Orphanet. © INSERM 1999. Available on https://sciences.orphadata.com/.
Data version July 2026 (source files extracted 2026-06-23). Licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The processed file in `public/data/` is a derived,
reduced copy of that data.

## AI use statement

Claude Code (Anthropic, model Claude Fable 5.2) was used to write the code

## License

Code: MIT (see `LICENSE`). Data: CC BY 4.0, see above.
