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

## A3 feature: Custom cat walks
For A3 I will add a starting-point box and 2km, 3km, and 5km___ route options, so that my reader __can build a cat walk that visits as many nearby cats, or an option that focuses more on nature walk. 

It has depth because ___it computes a walking route from the reader's chosen starting point and responds to the selected distance____

I will know it works when ____each option draws a route from the chosen start and shows the mapped cats and places the walk passes____

My edge case is a ___starting point outside the walking network or with no mapped features nearby.____

## TESTS 

**Inspection (before testing):** the code uses my real file, `data/walks.geojson`, and its real property names, checked with `print(walks.columns.tolist())`: `start`, `km`, `theme`, `length_km`, `cats`, `green_m`, `gardens`, `fountains`. No library was added (only Leaflet, as before). Nothing that already worked was rewritten: the walk box is a new section 10 at the end of `app.js`.
- **Event:** `walkForm.addEventListener("change", showWalk)` (`app.js` line 438), fired when any of the three menus changes.
- **Handler:** `showWalk()` (line 405) reads the start, length and theme, and finds the matching walk.
- **Update:** `walkLayer.clearLayers()` (line 406) removes the old route, `L.geoJSON(walk, ...)` (line 422) draws the new one, and `walkSummary.innerHTML` (line 428) writes the summary.

**Test 1**. 
   Type a starting point (maybe just, mont-royal metro ,  and laurier metro  and laurier park as options for now), in the starting box and choose 3km. 
   **Expected**: A route is drawn on the map from that point. A summary shows the walks length , and lists the cats, green alleys, fountains and gardens it will pass. 
   **Result: passed, with one difference.** The start is picked from a menu, not typed. Métro Mont-Royal, 3 km, Cat walk draws a pink dashed loop from the metro and back. The summary says "3.0 km loop", then 24 cats, 7 m of green alleys, 0 community gardens and 2 water fountains. It gives how many of each, not their names. **I've since added an option to pick your own spot on the map, so my tests have changed slightly** 

**Test 2**. I keep the same starting point, but switch it to  2km or 5km 
   **Expected**: The old route disappears and a new one is drawn each time. 
   **Result: passed.** Each change removes the old loop and draws the new one, and the summary updates to match, for every start and both themes. For example, Métro Mont-Royal Cat walk: 2 km = "2.1 km loop", 21 cats; 3 km = "3.0 km loop", 24 cats; 5 km = "4.9 km loop", 27 cats.

**Test 3**. I type a starting point outsdie the walking network or far from nay mapped feature (like ottawa), 
   **Expected**: no route is drawn, and a message like "sorry no cats or green places iwthin 2km of this spot, try another adress" 
   **Result: passed.** Since adding the option to create your own route, when you type in an adress that is either outside the scope of the map, or somewhere else in montreal that has <1 cat on the walk, an error message like this pops up: "Sorry, that spot is outside the area these walks cover. Try a spot closer to the Plateau or Mile End" 
## Running tests again - lab 7 
Test 1 : works great, picked mont-royal, 3km, as expected it drew a route and no errors in console. 
Test 2: works, as expected the old route gets erased, a new one with the updated route is visible on the map. 
Test 3: *"My own spot…"** option. The reader types an address (looked up with OpenStreetMap's Nominatim address search) or taps the map, picks 2, 3 or 5 km and a theme, and the page plans a loop from that spot.

## Since adding option to pick your own walking route : 
**Inspection:** the website can't run Python, so `walks_pipeline.ipynb` has a new **step 8** that exports the walking network to `data/walk_network.json` (13,372 street corners and 18,861 street pieces, 0.77 MB), and the page plans the loop itself with the same method as the notebook's step 5. No library was added (still only Leaflet). The ready-made walks still work the same way; their drawing code was only moved into a shared `drawWalk()` (line 489) so both kinds of walk use it. Everything new is section 11 at the end of `app.js`.
- **Event:** choosing "My own spot…" in the menu (`walkForm` "change", line 515), pressing Find or Enter (`walkForm` "submit", line 863), or tapping the map (`map.on("click")`, line 894).
- **Handler:** `setCustomStart()` (line 855) saves the spot, then `showCustomWalk()` (line 818) loads the network once and calls `planLoop()` (line 736), which snaps the spot to the nearest street corner, tries 120 loops and keeps the best one that passes at least one cat.
- **Update:** `walkLayer.clearLayers()` removes the old route, and `drawWalk()` draws the new loop and writes the summary, or `walkSummary` shows a "sorry" message.

**Test 3 again**: I type "Ottawa" as my starting point.
   **Expected**: no route is drawn, and a message tells me to try somewhere closer.
   **Result: passed.** No route, and the box says "Sorry, that spot is outside the area these walks cover. Try a spot closer to the Plateau or Mile End." Same for a tap in the Old Port, which is outside the walking network.

**More checks of the new part:**
- Typed address "4300 rue Saint-Denis", 2 km cat walk: 1.9 km loop from 4300 rue Saint-Denis and back, 18 cats.
- Taps in the Plateau, Mile End, Parc La Fontaine and the east and south edges, every length and both themes (30 walks): every one drew a loop of about the right length that passes 1 to 26 cats. Each takes about 20 to 60 ms to plan. #yassssss!!!!
- An address that doesn't exist ("zzqqxx nowhere 999"): "Sorry, I couldn't find 'zzqqxx nowhere 999'. Try a street address in Montréal, or tap the map."
- A walk that passes no cats (forced by blocking the cat file): "Sorry, a 2 km walk from that spot doesn't pass any cats. Try a spot closer to the Plateau or Mile End."
- The same spot twice gives the same walk. 

## Pre-flight report (Lab 7)
| Check | Result | What I did |
| --- | --- | --- |
| 1. Cold start | pass | In incognito I first got "Failed to load resource: the server responded with a status of 404 ()". It was one missing OpenStreetMap tile (`tile.openstreetmap.org/14/4842/5858.png`), not one of my files, and it was gone on refresh. Nothing to fix: known issue on OSM's side. |
| 2. Read every label | pass | Passed with flying colours! No changes needed. |
| 3. Ask twice | pass | Clicking one cat and then another closes the first popup. Same with the walks: picking a new one erases the old route. "My own spot" walks too: a new spot, length or theme replaces the old loop, and the same spot twice gives the same walk. No changes needed. |
| 4. The edge | fault, now fixed | At first there was no way to type my own starting point (only a menu of three starts), so the edge from Test 3 couldn't be tried. I added "My own spot…": typing "Ottawa" or tapping outside the walking network now says "Sorry, that spot is outside the area these walks cover. Try a spot closer to the Plateau or Mile End.", and a walk that passes no cats says the same. Fixed in commit "added my own spot walks". |
| 5. The data does not come | fault, now fixed | Blocking a GeoJSON in the Network tab made its layer silently disappear. Now a red notice appears on the map ("Sorry, some layers couldn't load: Communal gardens. Try reloading the page."), and the layer stays in the layer switcher, greyed out and marked "couldn't load". Error messages were also reworded for readers. Blocking the new `walk_network.json` says "Sorry, walks from your own spot couldn't be loaded. Try reloading the page, or pick one of the starts above." Fixed in commits "error messages update" and "Updated error messages for missing data". |
| 6. On a phone (size view and my phone) | fault, now fixed | Looks great on my phone, except the legend was under all the text instead of right under the map frame, so I moved it. I also swapped the generic layers icon for the white paw with "Layers" under it. Fixed in commits "moved legend to below map frame" and "changed legend pop up & readme". |
| 7. Mouse in my pocket | pass | Tab goes through every clickable button, including all of the cats and data points, which is useful. No changes needed. |
| 8. Accessibility audit | pass | Lighthouse accessibility score: 100 (up from 96 on 10/21/26). |

   ## November 10th Updated AI disclosure 
   As of November 10th, before the testing session on Wednesday, my feature works (the suggested walks), however I think it's super important to mention that Claude majorly assisted me through this process. I performed vibe coding with Claude Opus 5.5 to finalize the suggested walks,  but in all honesty did not write most of hte lines and don't fully understand the coding logic behind the suggested walks / process. This is something I plan on educating myself about in the coming days, at it is not something we discussed in class. 


   ## Part 3: what I found, and one fix
**Evidence**: 
   Round 1: 
      **Main problem identified**: scrolling on the page was not easy, would zoom in and out of map isntead of scrolling down to map key. 
      **Severity**: 2, didn't prohibit her, but slowed her down. 
      **My change**: Made my map frame slightly smalle so theres room on the side to properly scroll down with your cursor. 
   Round 2: 
      **Main problem identified**: 
      Water fountain icon blended in with the stm / bixi stops, hard to find on map 
      **Severity**: 2 , didn't prohibit but slowed him down. 
      **My change** : Made the water fountain ia darker blue in the shape of a water droplet., and the same size when you zoom in so they don't disapear. 


Recheck: 
Asked Destin to check on the waterfountain box and find the nearest water fountain from Mont-Royal, was able to do it no problem.