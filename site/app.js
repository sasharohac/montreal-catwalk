// ============================================================
// app.js = BEHAVIOUR: what loads on the map, how it is drawn, and what the popups say.
//
// The Montréal CatWalk: every cat photo in data/cat_photos.geojson as a cat pin,
// on top of Montréal's green alleys, coloured by how far each is from the nearest cat
// (dark green = a cat close by). Drinking fountains, communal gardens and
// free air-conditioned public places stay hidden until ticked in the layer switcher.
// Click a cat to see its photo, date and coordinates; click anything else for its details.
//
// Sections:
//   1. Settings: where the data files are, where the map starts
//   2. Base map and layer switcher
//   3. Map styles: how each layer looks
//   4. Popup content: what each popup says
//   5. Load the cats
//   6. Load the green alleys
//   7. Load the water fountains
//   8. Load the communal gardens
//   9. Load the free air-conditioned places
//  10. Suggested walks: pick a start, a length and a theme
//  11. "My own spot": plan a loop from an address or a tap on the map
// ============================================================


// ---------- 1. Settings ----------
// Where each GeoJSON file lives (made by the Python notebooks) and where the map starts
const DATA_URL = "../data/cat_photos.geojson";            // made by mvp_pipeline.ipynb
const ALLEYS_URL = "../data/ruelles_cat_distance.geojson"; // made by ruelles_cat_distance.ipynb
const FOUNTAINS_URL = "../data/water_fountains.geojson";  // made by fountains_pipeline.ipynb
const GARDENS_URL = "../data/communal_gardens.geojson";   // made by gardens_pipeline.ipynb
const COOL_URL = "../data/cool_places.geojson";           // made by ac_pipeline.ipynb
const WALKS_URL = "../data/walks.geojson";                // made by walks_pipeline.ipynb
const NETWORK_URL = "../data/walk_network.json";          // made by step 8 of walks_pipeline.ipynb
const GEOCODE_URL = "https://nominatim.openstreetmap.org/search"; // OpenStreetMap's free address search
const MONTREAL = [45.522, -73.59]; // roughly the Plateau / Mile End

// Where each cat, garden and fountain is, as [longitude, latitude]. Filled in as each file loads,
// and used to count what a "My own spot" walk passes (section 11).
const walkStops = { cats: [], gardens: [], fountains: [] };

// Phones: true when the page is in its one-column layout (same 800px break as style.css section 5)
function isPhone() {
  return window.matchMedia("(max-width: 800px)").matches;
}

// Every popup uses these settings. autoPanPadding keeps a popup at least 20px
// inside the edges of the map, so on a small phone screen it never opens half off-screen.
const POPUP_OPTIONS = { maxWidth: 260, minWidth: 220, autoPanPadding: [20, 20] };


// ---------- 2. Base map and layer switcher ----------
// Turn the empty <div id="map"> into a Leaflet map, centred on Montréal at zoom 14
const map = L.map("map").setView(MONTREAL, 14);

// Background map: OpenStreetMap image tiles ({z} = zoom, {x}/{y} = tile position), plus the required credit
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

// A separate layer level ("pane") for the alleys, just below the default one,
// so the cat pins are always drawn on top whichever file finishes loading first
map.createPane("alleys");
map.getPane("alleys").style.zIndex = 350;

// Layer switcher (top right): checkboxes to show or hide each layer.
// Each layer is added to it once its file has loaded. On phones it folds into an icon.
const layerSwitcher = L.control.layers(null, null, { collapsed: window.innerWidth < 500 }).addTo(map);//creates the layer switcher


// ---------- 3. Map styles ----------
// If you change a colour here, change the matching .swatch colour in style.css too,
// so the map key still matches the map.

// Cat pins: the cat silhouette in icons/cat.png, standing on the spot where the photo was taken
const catIcon = L.icon({
  iconUrl: "icons/cat.png",
  iconSize: [30, 35],      // size on screen in pixels (width, height): same shape as the image
  iconAnchor: [15, 35],    // bottom centre: the cat's feet sit on the location
  popupAnchor: [0, -35],   // popups open just above the cat's head
  className: "cat-icon",   // lets style.css add a shadow
});

// Alleys: coloured by dist_m, the distance in metres to the nearest cat (from ruelles_cat_distance.ipynb).
// Darkest green = a cat right here, palest = more than 1 km from any cat.
// The breaks are in walking time (about 80 m a minute) and must match the map key in index.html.
function alleyColour(dist) {
  if (dist < 100) return "#006d2c";    // under 100 m: a cat right here
  if (dist < 250) return "#31a354";    // 100 to 249 m: under 3 minutes' walk
  if (dist < 500) return "#74c476";    // 250 to 499 m: under 6 minutes
  if (dist < 1000) return "#bae4b3";   // 500 to 999 m: under 12 minutes
  return "#edf8e9";                    // 1 km or more: far from any cat
}

// Leaflet calls this once per alley, so each one gets its own fill colour.
// Semi-transparent so the street map shows through; the dark outline keeps the palest ones visible.
function alleyStyle(feature) {
  return {
    pane: "alleys",
    color: "#2e7d32",   // outline
    weight: 1,
    fillColor: alleyColour(feature.properties.dist_m),   // inside
    fillOpacity: 0.8,
  };
}

// Fountains: small blue dots with a white outline, drawn above the alleys and below the cats
const fountainStyle = {
  radius: 5,
  fillColor: "#1e88e5",
  fillOpacity: 1,
  color: "#ffffff",
  weight: 1.5,
};

// Gardens: green dots with a white outline, a little bigger than the fountains
const gardenStyle = {
  radius: 7,
  fillColor: "#79b968",
  fillOpacity: 1,
  color: "#ffffff",
  weight: 1.5,
};

// Cool places: purple dots with a white outline, the same size as the gardens
const coolStyle = {
  radius: 7,
  fillColor: "#8e24aa",
  fillOpacity: 1,
  color: "#ffffff",
  weight: 1.5,
};


// ---------- 4. Popup content ----------
// Helpers first, then one function per layer that builds its popup's HTML.

// Make text safe to put inside HTML, so characters like < can't break the page
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

// Turn "2026-04-30 13:23" into a readable date like "30 April 2026, 1:23 p.m."
function formatDate(dateText) {
  if (!dateText) return "Date unknown";
  const d = new Date(dateText.replace(" ", "T")); // "2026-04-30 13:23" -> a real date
  if (isNaN(d)) return dateText;
  return d.toLocaleString("en-CA", {
    day: "numeric", month: "long", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

// A short ID for each photo, made from its file name: "FullSizeRender 2.HEIC" -> "FullSizeRender_2".
// gallery.js makes the same ID, so the map and the gallery can link to each other.
function catId(p) {
  return (p.photo || "").replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_-]/g, "_");
}

// Cat popup: photo (a link to it in the gallery), name (if it has a real one),
// date, description (if any) and coordinates rounded to 5 decimals (about 1 m)
function popupHtml(p) {
  const hasName = p.name && p.name !== "Cat sighting";
  return `
    <a class="popup-photo-link" href="gallery.html#${catId(p)}" title="See it in the gallery">
      <img class="popup-photo" src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name || "Cat photo")}">
    </a>
    <div class="popup-text">
      ${hasName ? `<h2>${escapeHtml(p.name)}</h2>` : ""}
      <p><strong class="when">${escapeHtml(formatDate(p.date))}</strong></p>
      ${p.description ? `<p>${escapeHtml(p.description)}</p>` : ""}
      <p class="coords">${Number(p.lat).toFixed(5)}, ${Number(p.lon).toFixed(5)}</p>
    </div>`;
}

// Distance for people: "80 m" under 1 km, "1.4 km" above
function formatDistance(m) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

// Alley popup: how far the nearest cat is (with a link to meet it), how many cats are within 500 m,
// then borough, year greened, type of greening, whether cars can use it, and its area. Blank values are left out.
function alleyPopupHtml(p) {
  const nearby = p.cats_500m === 1 ? "1 cat" : `${p.cats_500m} cats`;
  return `
    <div class="popup-text alley-popup">
      <h2>Ruelle verte</h2>
      <p><strong>${p.dist_m === 0 ? "A cat was seen right here" : `Nearest cat: ${formatDistance(p.dist_m)} away`}</strong>
        · <a href="#cat=${encodeURIComponent(p.nearest_cat)}">meet this cat</a></p>
      <p>${nearby} within 500 m</p>
      <p>${escapeHtml(p.borough)}</p>
      ${p.year ? `<p>Greened in ${p.year}</p>` : ""}
      ${p.greening ? `<p>${escapeHtml(p.greening)}</p>` : ""}
      ${p.circulation ? `<p>Circulation: ${escapeHtml(p.circulation)}</p>` : ""}
      <p class="coords">${escapeHtml(p.alley_id)}${p.area_m2 ? ` · ${Math.round(p.area_m2)} m²` : ""}</p>
    </div>`;
}

// Fountain popup: park, what it's near, intersection, borough
// and any note (e.g. "accès restreint"). Blank values are left out.
function fountainPopupHtml(p) {
  return `
    <div class="popup-text fountain-popup">
      <h2>Fontaine d'eau</h2>
      ${p.park ? `<p>Parc ${escapeHtml(p.park)}</p>` : ""}
      ${p.near ? `<p>Near: ${escapeHtml(p.near)}</p>` : ""}
      ${p.intersection ? `<p>${escapeHtml(p.intersection)}</p>` : ""}
      ${p.note ? `<p>Note: ${escapeHtml(p.note)}</p>` : ""}
      <p class="coords">${escapeHtml(p.borough)}</p>
    </div>`;
}

// Garden popup: its name, address and borough
function gardenPopupHtml(p) {
  return `
    <div class="popup-text garden-popup">
      <h2>${escapeHtml(p.name || "Jardin communautaire")}</h2>
      ${p.address ? `<p>${escapeHtml(p.address)}</p>` : ""}
      <p class="coords">${escapeHtml(p.borough)}</p>
    </div>`;
}

// Cool place popup: its name, address, phone number, whether it is
// wheelchair accessible, and its borough. Blank values are left out.
function coolPopupHtml(p) {
  return `
    <div class="popup-text cool-popup">
      <h2>${escapeHtml(p.name || "Lieu climatisé")}</h2>
      <p>Free air conditioning</p>
      ${p.address ? `<p>${escapeHtml(p.address)}</p>` : ""}
      ${p.phone ? `<p>${escapeHtml(p.phone)}</p>` : ""}
      ${p.wheelchair ? `<p>Wheelchair accessible</p>` : ""}
      <p class="coords">${escapeHtml(p.borough)}</p>
    </div>`;
}

// When a cat popup opens: if its photo file is missing, say which one instead of showing a broken image
map.on("popupopen", (e) => {
  const img = e.popup.getElement().querySelector(".popup-photo");
  if (!img) return;
  img.addEventListener("error", () => {
    const note = document.createElement("div");
    note.className = "popup-missing";
    console.error(`Photo not found: site/${img.getAttribute("src")}. Run step 6 of photos_to_csv.ipynb.`);
    note.textContent = "Sorry, this cat's photo couldn't be loaded.";
    img.replaceWith(note);
  }, { once: true });
  img.addEventListener("load", () => e.popup.update(), { once: true }); // resize popup to fit the photo
});


// ---------- 5. Load the cats (shown when the map opens) ----------
// The status line under the story ("Loading cats…")
const status = document.getElementById("status");

// When a data file fails to load (missing, blocked, or no connection), the rest of the map still works,
// but the reader should be told which layer is missing rather than see it silently disappear. So:
//   1. a red notice appears on the map itself (top left, under the zoom buttons) naming every layer that failed;
//   2. the layer still appears in the layer switcher, greyed out and marked "couldn't load";
//   3. the fix for the developer goes to the browser console.
const MapAlert = L.Control.extend({
  onAdd: () => {
    const box = L.DomUtil.create("div", "map-alert");
    box.setAttribute("role", "alert"); // screen readers announce it
    return box;
  },
});
const mapAlert = new MapAlert({ position: "topleft" });
const failedLayers = [];

function layerFailed(name, url, fix, err, inSwitcher = true) {
  console.error(`Couldn't load ${url}. ${fix}`, err);
  failedLayers.push(name);
  if (!mapAlert.getContainer()) mapAlert.addTo(map); // show the notice the first time something fails
  mapAlert.getContainer().textContent =
    `Sorry, some layers couldn't load: ${failedLayers.join(", ")}. Try reloading the page.`;
  // An empty stand-in layer, so the name stays in the switcher (style.css greys it out and hides its checkbox)
  if (inSwitcher) layerSwitcher.addOverlay(L.layerGroup(), `<span class="layer-failed">${name} (couldn't load)</span>`);
}

// Download the GeoJSON file; stop with an error if the server says it is missing
fetch(DATA_URL)
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((data) => {
    walkStops.cats = data.features.map((f) => f.geometry.coordinates);
    // **COREACTION**Draw each cat as a cat pin and attach its popup with bind.popup!!!
    const layer = L.geoJSON(data, {
      pointToLayer: (feature, latlng) => L.marker(latlng, { icon: catIcon }),// draw a cat pin at the photo's coordinates
      onEachFeature: (feature, marker) => {// attach the popup to that pin
        marker.bindPopup(popupHtml(feature.properties), POPUP_OPTIONS); // popups are a bit wider than the cat icon
      },
    }).addTo(map);
    layerSwitcher.addOverlay(layer, "Cats");

    // Show how many cats were loaded ("1 cat" vs "N cats")
    const count = data.features.length;
    status.textContent = `${count} ${count === 1 ? "cat" : "cats"} photographed around Montréal`;

    // Zoom and pan so every pin is in view (no closer than zoom 16)
    if (count > 0) map.fitBounds(layer.getBounds(), { padding: [40, 40], maxZoom: 16 });

    // If the address ends in #cat=IMG_1234, zoom in on that cat and open its popup.
    // This happens when we come from the gallery's "Show on map" link,
    // and again whenever an alley's "meet this cat" link changes the address.
    function showWantedCat() {
      const wanted = new URLSearchParams(location.hash.slice(1)).get("cat");
      layer.eachLayer((marker) => {
        if (wanted && catId(marker.feature.properties) === wanted) {
          map.setView(marker.getLatLng(), 18);
          marker.openPopup();
        }
      });
    }
    showWantedCat();
    window.addEventListener("hashchange", showWantedCat);

    // On a phone the map sits just under the title; scroll it fully into view so
    // someone arriving from the gallery sees the whole map and the open popup.
    if (location.hash.includes("cat=") && isPhone()) {
      document.getElementById("map").scrollIntoView({ behavior: "smooth" });
    }
  })
  // If anything above failed, turn the status line red and tell the reader; log the fix in the console
  .catch((err) => {
    layerFailed("Cats", DATA_URL, "Run mvp_pipeline.ipynb to create it, then open this page with Live Server.", err);
    status.className = "error";
    status.textContent =
      "Sorry, the cats couldn't be loaded, so the map has no cat pins right now. " +
      "Try reloading the page in a minute.";
  });


// ---------- 6. Load the green alleys (shown when the map opens, under the cat pins) ----------
fetch(ALLEYS_URL)
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((data) => {
    // Draw each alley as a green shape (shade = distance to the nearest cat) and attach its popup
    const alleys = L.geoJSON(data, {
      style: alleyStyle,
      onEachFeature: (feature, shape) => {
        shape.bindPopup(alleyPopupHtml(feature.properties), POPUP_OPTIONS);
      },
    }).addTo(map);
    layerSwitcher.addOverlay(alleys, "Green alleys");
  })
  // If the alleys fail, the cats still work: tell the reader under the status line, and log the fix
  .catch((err) => {
    layerFailed("Green alleys", ALLEYS_URL, "Run ruelles_pipeline.ipynb, then ruelles_cat_distance.ipynb, to create it.", err);
  });


// ---------- 7. Load the water fountains (hidden until ticked: no .addTo(map)) ----------
fetch(FOUNTAINS_URL)
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((data) => {
    // Draw each fountain as a blue dot and attach its popup
    walkStops.fountains = data.features.map((f) => f.geometry.coordinates);
    const fountains = L.geoJSON(data, {
      pointToLayer: (feature, latlng) => L.circleMarker(latlng, fountainStyle),
      onEachFeature: (feature, dot) => {
        dot.bindPopup(fountainPopupHtml(feature.properties), POPUP_OPTIONS);
      },
    });
    layerSwitcher.addOverlay(fountains, "Water fountains");
  })
  // If the fountains fail, the rest of the map still works: tell the reader under the status line, and log the fix
  .catch((err) => {
    layerFailed("Water fountains", FOUNTAINS_URL, "Run fountains_pipeline.ipynb to create it.", err);
  });


// ---------- 8. Load the communal gardens (hidden until ticked) ----------
fetch(GARDENS_URL)
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((data) => {
    // Draw each garden as a green dot and attach its popup
    walkStops.gardens = data.features.map((f) => f.geometry.coordinates);
    const gardens = L.geoJSON(data, {
      pointToLayer: (feature, latlng) => L.circleMarker(latlng, gardenStyle),
      onEachFeature: (feature, dot) => {
        dot.bindPopup(gardenPopupHtml(feature.properties), POPUP_OPTIONS);
      },
    });
    layerSwitcher.addOverlay(gardens, "Communal gardens");
  })
  // If the gardens fail, the rest of the map still works: tell the reader under the status line, and log the fix
  .catch((err) => {
    layerFailed("Communal gardens", GARDENS_URL, "Run gardens_pipeline.ipynb to create it.", err);
  });


// ---------- 9. Load the free air-conditioned public places (hidden until ticked) ----------
fetch(COOL_URL)
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((data) => {
    // Draw each cool place as a purple dot and attach its popup
    const coolPlaces = L.geoJSON(data, {
      pointToLayer: (feature, latlng) => L.circleMarker(latlng, coolStyle),
      onEachFeature: (feature, dot) => {
        dot.bindPopup(coolPopupHtml(feature.properties), POPUP_OPTIONS);
      },
    });
    layerSwitcher.addOverlay(coolPlaces, "Free AC (cool places)");
  })
  // If the cool places fail, the rest of the map still works: tell the reader under the status line, and log the fix
  .catch((err) => {
    layerFailed("Free AC (cool places)", COOL_URL, "Run ac_pipeline.ipynb to create it.", err);
  });


// ---------- 10. Suggested walks (the box in the bottom left corner of the map) ----------
// The walks are loops along the streets, planned in walks_pipeline.ipynb: one per start, length (2, 3 or 5 km)
// and theme (cats: as many cats as possible; nature: as much green alley as possible).
// Here the reader picks all three; we draw that loop and say what it passes.
const walkForm = document.getElementById("walk-form");
const walkSummary = document.getElementById("walk-summary");
const walkLayer = L.layerGroup().addTo(map); // the drawn walks, emptied before each new choice
let catWalks = [];   // every walk in the file, once it has loaded

const walkBox = document.getElementById("walk-box");

// Move the walk box from the page into the map's bottom left corner.
// Clicks and scrolling inside it don't move the map.
const WalkBox = L.Control.extend({
  onAdd: () => {
    L.DomEvent.disableClickPropagation(walkBox);
    L.DomEvent.disableScrollPropagation(walkBox);
    return walkBox;
  },
});
new WalkBox({ position: "bottomleft" }).addTo(map);

// On a phone the open box would cover most of the map, so it starts folded into
// just its title; tapping "Suggested cat walks" opens it and the ✕ folds it again. Opening it on a phone also folds
// the layer switcher, so the two boxes never sit on top of each other.
walkBox.open = !isPhone();
walkBox.addEventListener("toggle", () => {
  if (walkBox.open && isPhone()) layerSwitcher.collapse();
});

// "1 cat" vs "3 cats"
function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

// Runs whenever any of the three menus changes
function showWalk() {
  walkLayer.clearLayers();   // remove the previous walk
  const start = document.getElementById("walk-start").value;
  const km = Number(document.getElementById("walk-km").value);
  const theme = document.getElementById("walk-theme").value;
  customStartBox.hidden = start !== "custom";   // the address box only shows for "My own spot…"
  if (start === "custom") {
    showCustomWalk(km, theme);                  // section 11
    return;
  }
  if (!start) {
    walkSummary.textContent = "Pick a starting point to see its walk.";
    return;
  }
  const walk = catWalks.find((f) => f.properties.start === start && f.properties.km === km && f.properties.theme === theme);
  if (!walk) {
    walkSummary.textContent = `Sorry, there's no ${km} km ${theme} walk from ${start} yet. Try another length or theme.`;
    return;
  }
  drawWalk(walk);
}

// Draws one walk (a GeoJSON line with start, length_km, cats, green_m, gardens and fountains)
// and writes its summary. Used by the ready-made walks and by "My own spot" walks.
function drawWalk(walk) {
  // Draw the loop and a dot where it starts and ends
  const [lon, lat] = walk.geometry.coordinates[0];
  const line = L.geoJSON(walk, { style: { color: "#de889d", weight: 5, dashArray: "6 6" } }).addTo(walkLayer);
  L.circleMarker([lat, lon], { radius: 7, fillColor: "#e65100", fillOpacity: 1, color: "#ffffff", weight: 2 }).addTo(walkLayer);
  // Zoom to the loop, keeping it clear of the walk box: on a phone the box spans the
  // bottom of the map, so leave room under the loop; on a computer it sits on the left
  const boxRoom = isPhone()
    ? { paddingTopLeft: [20, 20], paddingBottomRight: [20, walkBox.offsetHeight + 30] }
    : { paddingTopLeft: [walkBox.offsetWidth + 30, 20], paddingBottomRight: [20, 20] };
  map.fitBounds(line.getBounds(), { ...boxRoom, maxZoom: 18 });

  // Summary: length, then what the loop passes
  const p = walk.properties;
  walkSummary.innerHTML = `
    <p><strong>${p.length_km.toFixed(1)} km loop</strong> from ${escapeHtml(p.start)} and back. It passes:</p>
    <ul>
      <li>${plural(p.cats, "cat")}</li>
      <li>${formatDistance(p.green_m)} of green alleys</li>
      <li>${plural(p.gardens, "community garden")}</li>
      <li>${plural(p.fountains, "water fountain")}</li>
    </ul>`;
}

// Any of the three menus. (Typing in the address box also fires "change" when you leave it:
// ignore that, the walk is only planned when you press Find or Enter.)
walkForm.addEventListener("change", (e) => {
  if (e.target.id !== "custom-address") showWalk();
});

fetch(WALKS_URL)
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((data) => {
    catWalks = data.features;
    walkSummary.textContent = "Pick a starting point to see its walk.";
  })
  // If the walks fail, the rest of the map still works: say so in the box and log why
  .catch((err) => {
    layerFailed("Suggested walks", WALKS_URL, "Run walks_pipeline.ipynb to create it.", err, false); // not in the switcher
    walkSummary.textContent = "Sorry, the suggested walks couldn't be loaded. Try reloading the page.";
  });


// ---------- 11. "My own spot": a walk from anywhere the reader chooses ----------
// The ready-made walks above were planned in Python. Here the page plans a loop itself, from an
// address the reader types or a spot they tap, with the same method as step 5 of walks_pipeline.ipynb:
//   1. snap the start to the nearest street corner of the walking network (data/walk_network.json);
//   2. find the "ring": corners about a third of the walk's length away along the streets;
//   3. try loops start → a → b → start through corners of the ring (cat walks favour corners next
//      to a cat, nature walks favour gardens and green alleys), each leg the shortest route;
//   4. keep the best loop within 15% of the chosen length that repeats at most a quarter of its streets.
// If the spot is outside the network, or the best loop passes no cats, the reader is told to try a spot
// closer to the Plateau or Mile End instead.

const WALK_TOLERANCE = 0.15;  // a "3 km" walk can be 2.55 to 3.45 km (same as the notebook)
const WALK_MAX_REPEAT = 0.25; // at most a quarter of a walk can go back over streets it already used
const WALK_NEAR_M = 50;       // a cat, garden or fountain within 50 m of the route counts as "passed"
const WALK_MAX_SNAP_M = 300;  // a start more than 300 m from any street corner is outside the network
const RING_CORNERS = 12;      // how many "a" corners to try (each needs one route search)...
const TRIES_PER_CORNER = 10;  // ...and how many "b" corners with each: 120 loops in all

const customStartBox = document.getElementById("custom-start");
const customAddress = document.getElementById("custom-address");
const customFind = document.getElementById("custom-find");
let customStart = null;  // { lat, lng, label } once the reader has chosen a spot
let planNumber = 0;      // so a slow, older plan never overwrites a newer one

// Distances in metres: longitude and latitude turned into x and y metres from the middle of the map.
// Close enough over a few kilometres (the notebook uses MTM zone 8 for the same job).
const M_PER_DEG_LAT = 111320;
const M_PER_DEG_LON = 111320 * Math.cos((MONTREAL[0] * Math.PI) / 180);
function toXY([lon, lat]) {
  return [(lon - MONTREAL[1]) * M_PER_DEG_LON, (lat - MONTREAL[0]) * M_PER_DEG_LAT];
}

// Download the walking network once, the first time someone picks "My own spot…",
// and list the street pieces at each corner so routes can be followed from corner to corner
let networkPromise = null;
function loadNetwork() {
  if (!networkPromise) {
    networkPromise = fetch(NETWORK_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        const net = { nodes: data.nodes, xy: data.nodes.map(toXY), pieces: [], at: data.nodes.map(() => []) };
        data.edges.forEach(([u, v, length, green, bends], i) => {
          net.pieces.push({ u, v, length, green, bends });
          net.at[u].push(i);
          net.at[v].push(i);
        });
        return net;
      })
      .catch((err) => {
        networkPromise = null;  // let a later try download it again
        throw err;
      });
  }
  return networkPromise;
}

// The street corner nearest a point [x, y], and how far away it is
function nearestCorner(net, [x, y]) {
  let best = -1, bestD = Infinity;
  net.xy.forEach(([cx, cy], i) => {
    const d = (cx - x) ** 2 + (cy - y) ** 2;
    if (d < bestD) { best = i; bestD = d; }
  });
  return { corner: best, metres: Math.sqrt(bestD) };
}

// Dijkstra's shortest routes from one corner to every corner within `cutoff` (in the units of `cost`).
// Returns how far each corner is, and the last street piece on the way to it (to trace the route back).
function shortestRoutes(net, from, cost, cutoff) {
  const dist = new Map([[from, 0]]);
  const via = new Map();
  const queue = [[0, from]];   // a min-heap of [distance, corner]
  while (queue.length) {
    const [d, n] = heapPop(queue);
    if (d > dist.get(n)) continue;   // an old, longer entry for a corner already done
    if (d > cutoff) break;
    for (const i of net.at[n]) {
      const piece = net.pieces[i];
      const next = piece.u === n ? piece.v : piece.u;
      const nd = d + cost(piece);
      if (nd < (dist.get(next) ?? Infinity)) {
        dist.set(next, nd);
        via.set(next, i);
        heapPush(queue, [nd, next]);
      }
    }
  }
  return { from, dist, via };
}

// The street pieces from routes.from to `to`, in walking order (null if `to` wasn't reached)
function traceRoute(net, routes, to) {
  if (!routes.dist.has(to)) return null;
  const pieces = [];
  for (let n = to; n !== routes.from; ) {
    const i = routes.via.get(n);
    pieces.push(i);
    n = net.pieces[i].u === n ? net.pieces[i].v : net.pieces[i].u;
  }
  return pieces.reverse();
}

// A tiny min-heap, so Dijkstra always takes the nearest corner next
function heapPush(heap, item) {
  heap.push(item);
  for (let i = heap.length - 1; i > 0; ) {
    const parent = (i - 1) >> 1;
    if (heap[parent][0] <= heap[i][0]) break;
    [heap[parent], heap[i]] = [heap[i], heap[parent]];
    i = parent;
  }
}
function heapPop(heap) {
  const top = heap[0];
  const last = heap.pop();
  if (heap.length) {
    heap[0] = last;
    for (let i = 0; ; ) {
      const l = 2 * i + 1, r = l + 1;
      let small = i;
      if (l < heap.length && heap[l][0] < heap[small][0]) small = l;
      if (r < heap.length && heap[r][0] < heap[small][0]) small = r;
      if (small === i) break;
      [heap[small], heap[i]] = [heap[i], heap[small]];
      i = small;
    }
  }
  return top;
}

// Random choices that are the same every time for the same spot, length and theme,
// so asking twice gives the same walk (like random.seed(464) in the notebook)
function seededRandom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pick(list, random) {
  return list[Math.floor(random() * list.length)];
}

// The corner nearest each cat and each garden (worked out once per network and data)
const stopCornerCache = new Map();
function stopCorners(net, name) {
  const points = walkStops[name];
  const cached = stopCornerCache.get(name);
  if (cached && cached.points === points) return cached.corners;
  const corners = new Set(points.map((p) => nearestCorner(net, toXY(p)).corner));
  stopCornerCache.set(name, { points, corners });
  return corners;
}

// How many of `points` ([lon, lat]) are within WALK_NEAR_M of the route line (a list of [x, y])
function countNear(points, line, box) {
  let count = 0;
  for (const p of points) {
    const [x, y] = toXY(p);
    if (x < box[0] || x > box[2] || y < box[1] || y > box[3]) continue;   // quick skip: nowhere near
    for (let i = 1; i < line.length; i++) {
      if (distanceToSegment(x, y, line[i - 1], line[i]) <= WALK_NEAR_M) { count++; break; }
    }
  }
  return count;
}
function distanceToSegment(x, y, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const t = dx || dy ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

// Turns a loop (street pieces in walking order) into its numbers and its line, like score() in the notebook
function scoreLoop(net, loop) {
  const length = loop.reduce((sum, i) => sum + net.pieces[i].length, 0);
  const unique = [...new Set(loop)];
  const uniqueLength = unique.reduce((sum, i) => sum + net.pieces[i].length, 0);
  const repeat = 1 - uniqueLength / length;
  return { loop, length, repeat, green: unique.reduce((sum, i) => sum + net.pieces[i].green, 0) };
}

// The line of a loop as [lon, lat] points, following each street's bends in the walking direction
function loopLine(net, startCorner, loop) {
  const coords = [net.nodes[startCorner]];
  let at = startCorner;
  for (const i of loop) {
    const { u, v, bends } = net.pieces[i];
    const middle = [];
    for (let k = 0; k < bends.length; k += 2) middle.push([bends[k], bends[k + 1]]);
    if (at === v) middle.reverse();          // walking this piece from v to u
    at = at === u ? v : u;
    coords.push(...middle, net.nodes[at]);
  }
  return coords;
}

// Plans the best loop from a spot. Returns { walk } or { problem: "outside" | "noloop" | "nocats" }.
function planLoop(net, spot, km, theme) {
  const target = km * 1000;
  const snap = nearestCorner(net, toXY([spot.lng, spot.lat]));
  if (snap.metres > WALK_MAX_SNAP_M) return { problem: "outside" };
  const start = snap.corner;

  // 1. The ring: corners about a third of the walk away (and a wider band to look for cats and gardens in)
  const byLength = shortestRoutes(net, start, (p) => p.length, 0.45 * target);
  const ring = [], wide = [];
  for (const [n, d] of byLength.dist) {
    if (d >= 0.22 * target && d <= 0.38 * target) ring.push(n);
    if (d >= 0.15 * target && d <= 0.45 * target) wide.push(n);
  }
  if (ring.length < 2) return { problem: "noloop" };
  const catCorners = stopCorners(net, "cats");
  const gardenCorners = stopCorners(net, "gardens");
  const ringCats = wide.filter((n) => catCorners.has(n));
  const ringGardens = wide.filter((n) => gardenCorners.has(n));

  // Cat walks take the shortest streets; nature walks count green alley metres as cheaper, so routes
  // lean into them (the notebook's nature_cost: length - 0.6 × green metres)
  const cost = theme === "cats" ? (p) => p.length : (p) => p.length - 0.6 * p.green;
  const fromStart = theme === "cats" ? byLength : shortestRoutes(net, start, cost, 0.45 * target);

  // 2 and 3. Try loops start → a → b → start
  const random = seededRandom(Math.round(spot.lat * 1e5) * 31 + Math.round(spot.lng * 1e5) + km * 7 + theme.length);
  const pickCorner = (forA) => {
    if (theme === "cats" && ringCats.length >= 2 && random() < 0.7) return pick(ringCats, random);
    if (theme === "nature" && forA && ringGardens.length && random() < 0.5) return pick(ringGardens, random);
    return pick(ring, random);
  };
  const candidates = [];
  for (let t = 0; t < RING_CORNERS; t++) {
    const a = pickCorner(true);
    const fromA = shortestRoutes(net, a, cost, target);
    const leg1 = traceRoute(net, fromStart, a);
    for (let k = 0; k < TRIES_PER_CORNER; k++) {
      const b = pickCorner(false);
      if (b === a) continue;
      const leg2 = traceRoute(net, fromA, b);
      const leg3 = traceRoute(net, fromStart, b);
      if (!leg1 || !leg2 || !leg3) continue;
      const s = scoreLoop(net, [...leg1, ...leg2, ...leg3.slice().reverse()]);
      // 4. Only loops of about the right length that don't double back too much
      if (Math.abs(s.length - target) <= WALK_TOLERANCE * target && s.repeat <= WALK_MAX_REPEAT) candidates.push(s);
    }
  }
  if (!candidates.length) return { problem: "noloop" };

  // Count what each good loop passes, then keep the best: one with at least one cat if there is one,
  // then by the notebook's scores (cats: cats × 100 + green metres ÷ 10; nature: green metres + 300 × gardens)
  let best = null, bestValue = -Infinity;
  for (const s of candidates) {
    s.coords = loopLine(net, start, s.loop);
    const line = s.coords.map(toXY);
    const xs = line.map((p) => p[0]), ys = line.map((p) => p[1]);
    const box = [Math.min(...xs) - WALK_NEAR_M, Math.min(...ys) - WALK_NEAR_M, Math.max(...xs) + WALK_NEAR_M, Math.max(...ys) + WALK_NEAR_M];
    s.cats = countNear(walkStops.cats, line, box);
    s.gardens = countNear(walkStops.gardens, line, box);
    s.fountains = countNear(walkStops.fountains, line, box);
    const value = (s.cats > 0 ? 1e9 : 0) + (theme === "cats" ? s.cats * 100 + s.green / 10 : s.green + 300 * s.gardens);
    if (value > bestValue) { best = s; bestValue = value; }
  }
  if (best.cats < 1) return { problem: "nocats" };

  return {
    walk: {
      type: "Feature",
      geometry: { type: "LineString", coordinates: best.coords },
      properties: {
        start: spot.label || "your spot",
        length_km: best.length / 1000,
        cats: best.cats,
        green_m: Math.round(best.green),
        gardens: best.gardens,
        fountains: best.fountains,
      },
    },
  };
}

// Runs from showWalk() when "My own spot…" is chosen, and again when the length or theme changes
function showCustomWalk(km, theme) {
  if (!customStart) {
    walkSummary.textContent = "Type an address and press Find, or tap the map where you want to start.";
    return;
  }
  const thisPlan = ++planNumber;
  const spot = customStart;
  // Mark the chosen spot straight away, so the reader sees where the walk will start
  const pin = L.circleMarker([spot.lat, spot.lng], { radius: 7, fillColor: "#e65100", fillOpacity: 1, color: "#ffffff", weight: 2 }).addTo(walkLayer);
  walkSummary.textContent = "Planning your walk…";

  loadNetwork()
    .then((net) => new Promise((done) => setTimeout(() => done(net), 30)))   // let "Planning…" appear first
    .then((net) => {
      if (thisPlan !== planNumber) return;    // the reader has already asked for something else
      const result = planLoop(net, spot, km, theme);
      if (result.walk) {
        walkLayer.clearLayers();
        drawWalk(result.walk);
        return;
      }
      const sorry = {
        outside: "Sorry, that spot is outside the area these walks cover.",
        noloop: `Sorry, there's no ${km} km loop from that spot.`,
        nocats: `Sorry, a ${km} km walk from that spot doesn't pass any cats.`,
      };
      walkSummary.textContent = `${sorry[result.problem]} Try a spot closer to the Plateau or Mile End.`;
      if (result.problem !== "outside") map.panTo(pin.getLatLng());
    })
    .catch((err) => {
      console.error(`Couldn't load ${NETWORK_URL}. Run step 8 of walks_pipeline.ipynb to create it.`, err);
      if (thisPlan !== planNumber) return;
      walkSummary.textContent = "Sorry, walks from your own spot couldn't be loaded. Try reloading the page, or pick one of the starts above.";
    });
}

// Sets the start and plans the walk. `label` is the typed address, or null for a tap on the map.
function setCustomStart(lat, lng, label) {
  customStart = { lat, lng, label };
  if (!label) customAddress.value = "";
  showWalk();
}

// Typed address: look it up with OpenStreetMap's address search (Nominatim), preferring places
// around the Plateau. Pressing Enter in the box submits the form, the same as pressing Find.
walkForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const address = customAddress.value.trim();
  if (!address) {
    walkSummary.textContent = "Type an address first, or tap the map where you want to start.";
    return;
  }
  walkLayer.clearLayers();
  walkSummary.textContent = "Looking up that address…";
  customFind.disabled = true;   // one search at a time (Nominatim asks for at most one a second)
  const params = new URLSearchParams({ q: address, format: "json", limit: 1, viewbox: "-73.64,45.56,-73.54,45.49" });
  fetch(`${GEOCODE_URL}?${params}`)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((results) => {
      if (!results.length) {
        walkSummary.textContent = `Sorry, I couldn't find "${address}". Try a street address in Montréal, or tap the map.`;
        return;
      }
      setCustomStart(Number(results[0].lat), Number(results[0].lon), address);
    })
    .catch((err) => {
      console.error("The address search (Nominatim) didn't answer.", err);
      walkSummary.textContent = "Sorry, the address search isn't working right now. Tap the map where you want to start instead.";
    })
    .finally(() => { customFind.disabled = false; });
});

// Tapped spot: only while "My own spot…" is chosen, so tapping the map normally does nothing new
map.on("click", (e) => {
  if (document.getElementById("walk-start").value !== "custom") return;
  map.closePopup();   // tapping an alley or a dot also opens its popup: close it, the reader meant "start here"
  setCustomStart(e.latlng.lat, e.latlng.lng, null);
});
