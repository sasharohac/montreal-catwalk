# The Montréal CatWalk

A web map that leads you to Montréal's quieter, greener corners one cat at a time. Every pin is a cat I photographed around the city. Around them you can switch on green alleys, community gardens, drinking fountains and free air-conditioned places, and plan a short walk from one cat to the next.

**This map is for**\ Montrealers who need a break from the noise and want a short nature walk close to home, with no car or trip to the mountain required.

**What you can do here:** find a cat near you and click it to meet them. Then switch on the other layers and plan a wandering walk from cat to cat.

GEOG 464, Assignment 2 (MVP).
## How to run it

1. **Make the cat data.** In `notebooks/`, run these top to bottom:
   - `photos_to_csv.ipynb`: reads the location and date from each photo in `photos_raw/`, writes `data/cat_photos.csv`, and makes web-ready JPEGs in `site/photos/`.
   - `mvp_pipeline.ipynb`: turns `data/cat_photos.csv` into `data/cat_photos.geojson`.
2. **Make the other layers.** Run each of these once (any order):
   - `ruelles_pipeline.ipynb` → `data/ruelles_vertes.geojson`
   - `fountains_pipeline.ipynb` → `data/water_fountains.geojson`
   - `gardens_pipeline.ipynb` → `data/communal_gardens.geojson`
   - `ac_pipeline.ipynb` → `data/cool_places.geojson`
   - `ruelles_cat_distance.ipynb` → `data/ruelles_cat_distance.geojson` (run this one last: it needs the cats and the alleys)
3. **Open the map.** In VS Code, right-click `site/index.html` and choose **Open with Live Server**. (Opening the file directly won't work: browsers block `fetch` from local files.)

To add new cats, put the photos in `photos_raw/` and re-run step 1. Names and descriptions typed into the CSV are kept.

### Python packages

```
pip install pandas pillow pillow-heif geopandas osmnx scipy
```

`pillow-heif` is needed to read iPhone `.HEIC` photos. `osmnx` and `scipy` are only needed for the walks notebook.

---

## What each file does

```
geog464-starter/
  photos_raw/          original phone photos (in HEIC FORMAT) (not published: they contain GPS data)
  data/                CSV and GeoJSON files made by the notebooks....
  notebooks/           Python pipelines, one per layer
  site/
    index.html         map page: the words and the order they appear in
    style.css          colours, fonts, layout and map size (shared by both pages)
    app.js             loads each layer, draws it, and builds the popups
    gallery.html       photo gallery page, photos in a larger format . 
    gallery.css        gallery layout and the full-screen photo view
    gallery.js         builds the gallery, grouped by month, newest first
    icons/             cat pin and the gallery's paw animation
    photos/            web copies of the photos (metadata removed)
```

| I want to... | Open |
|---|---|
| Reword text, add a section or link | `site/index.html` |
| Change colours, layout or the map's size | `site/style.css` |
| Change a popup, a layer's colour, or what loads | `site/app.js` |

A layer's colour is set in two places which is improtant to remember, if you want the legend to match the dots on the map : its style in `app.js` and its `.swatch` in `style.css`. need to change both if you change one. 

---

## Data sources

| Layer | Source | Licence | Accessed |
|---|---|---|---|
| Cats | My own photos, taken around Montréal | — | — |
| Green alleys | [Ruelles vertes](https://www.donneesquebec.ca/recherche/dataset/vmtl-ruelles-vertes), Ville de Montréal | CC BY 4.0 | 23 Sept 2026 |
| Community gardens | [Jardins communautaires](https://www.donneesquebec.ca/recherche/dataset/vmtl-jardins-communautaires), Ville de Montréal | CC BY 4.0 | 30 Sept 2026 |
| Drinking fountains | [Fontaines à boire extérieures](https://www.donneesquebec.ca/recherche/dataset/vmtl-fontaines-a-boire-eau-exterieures), Ville de Montréal | CC BY 4.0 | 30 Sept 2026 |
| Air-conditioned places | [Lieux publics climatisés](https://www.donneesquebec.ca/recherche/dataset/vmtl-lieux-publics-climatises), Ville de Montréal | CC BY 4.0 | 30 Sept 2026 |
| Base map and walking network | [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) | ODbL | — |
| Mental health statistics | [Nature can have a nurturing effect on your mental health](https://www.camh.ca/en/camh-news-and-stories/nature-can-have-a-nurturing-effect-on-your-mental-health), CAMH | © CAMH | 19 Oct 2026 |
| Gallery paw animation | [White paw GIF](https://tenor.com/view/whitepaw-cute-paws-paw-white-gif-9808874833446807951), via Tenor | — | 21 Oct 2026 |

What I changed: each city dataset was cut down to the columns the popups show, with short English column names. Values stay in French as the city wrote them. The alleys use the JSON download, because the CSV has no coordinates. The city updates the alleys dataset every autumn.

### Computed layer: green alleys by distance to the nearest cat

**How it was computed:** in `ruelles_cat_distance.ipynb`, the alleys and the cats are both converted to metres (MTM zone 8, `EPSG:2950`). Then `sjoin_nearest` measures the straight-line distance from each alley's edge to the closest cat photo, and a 500 m buffer around each alley counts how many cats fall inside it. These are straight-line distances, not walking distances. (All from the lab #5 notebook, just imported my own data)

**Total check:** all 1,262 alley segments got a distance (1,262 of 1,262). The two measures agree: no alley under 500 m from its nearest cat has 0 cats within 500 m, and no alley over 500 m away has any.

**What the colours mean:** darker green alleys are closer to a cat I photographed. The darkest are less than 100 m from one, and the palest are 1 km or more from any cat. The five classes are under 100 m, 100–249 m, 250–499 m, 500–999 m and 1 km or more, which is roughly a 3, 6 and 12 minute walk.

---

## Current state

**Working:** 73 cats on the map (2 of 75 photos have no location and are skipped cause they were taken in ottawa, did this on purpose to check make sure the notebook properly filters it out. ), with popups showing the photo, date and coordinates. Green alleys show by default; fountains, gardens and cool places can be switched on in the layer switcher. The gallery links to each cat on the map and back.

**Not in this iteration:** suggested walking routes. `walks_pipeline.ipynb` already builds 18 loops (3 starting points in the Plateau × 2, 3 and 5 km × a cat theme and a nature theme) into `data/walks.geojson`, but they are not on the page yet, because it needs some tweaking / i dont fully understand what it does yet lol .

**Next working state:** the walks appear on the map. You choose a start, a length and a theme, and that walk is drawn with its distance and the number of cats, metres of green alley, gardens and fountains it passes. I'll know it works when all  combinations draw correctly. 

**Known limitations**
- The cats are my own sightings, so they cluster where I walk (Plateau and Mile End), not where cats actually are. cats are not statues. 
- A pin marks where I saw a cat, not where it lives.

## **AI Disclosure##
- **Lane:** Blue  
- To get where i got to today with my MVP,, I used Claude AI tool with Opus 5.5. It certainly guided me pretty heavily throughout this process, in all honesty, since I do not have a ton of experience with pyton, let alone with image metadata. I used it mainly at the beginning with converting my HEIC iphone images, extracting the metadata and with help displaying it on my map, since this is a bit of a different pipeline that we covered in class. From the beginning i could visualize the pipleine step by step, and used Claude in VS code to help me move from step to step, especially with what to prioritize, etc. An example of a question I asked claude : "How could I make the map zoom in to general cluster of all my cat points and not the whole island of Montreal...?". , it would spit out an answer and I would look it through, approve / deny it, run it , visualize how it looks in my map, and then adjust the code as fit. 

---
## After the demo
- At my demo, Everything went pretty smoothly, just working on fully understanding and grasping each line taking it step by step. Also going to work on adding a gradient to the alleyways depending on how close they are to a reported cat, which is what I will accomplish in lab #5 today. 

## Suggestions from a classmate 
- Leo reviewed my site, and he critiques the color gradient of the alleys in relation to the nearest cat, the green gradient is not super evident especially considering that the alleys are so thin. 
Going forward, I'm not sure if i want this  feature on my final map because it doesn't necessarily add to what I am trying to do.... 


## Test evidence

- [ ] Lighthouse accessibility score: **[96]** on [10/21/26]. haven't fixed anything yet. 
- [x] Every map colour has a text label in the map key.
- [x] Body text is at least 16 px; one `h1`, then `h2`s.
- [x] Checked on a narrow window: the map moves below the story.
- [x] If the cat data fails to load, the status line turns red and says which file is missing.
- [x] All notebook check cells pass (feature count, coordinates in longitude and latitude, inside Montréal, under 5 MB).
