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
// ============================================================


// ---------- 1. Settings ----------
// Where each GeoJSON file lives (made by the Python notebooks) and where the map starts
const DATA_URL = "../data/cat_photos.geojson";            // made by mvp_pipeline.ipynb
const ALLEYS_URL = "../data/ruelles_cat_distance.geojson"; // made by ruelles_cat_distance.ipynb
const FOUNTAINS_URL = "../data/water_fountains.geojson";  // made by fountains_pipeline.ipynb
const GARDENS_URL = "../data/communal_gardens.geojson";   // made by gardens_pipeline.ipynb
const COOL_URL = "../data/cool_places.geojson";           // made by ac_pipeline.ipynb
const WALKS_URL = "../data/walks.geojson";                // made by walks_pipeline.ipynb
const MONTREAL = [45.522, -73.59]; // roughly the Plateau / Mile End


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
    note.textContent = `Photo not found: site/${img.getAttribute("src")}. Run step 6 of photos_to_csv.ipynb.`;
    img.replaceWith(note);
  }, { once: true });
  img.addEventListener("load", () => e.popup.update(), { once: true }); // resize popup to fit the photo
});


// ---------- 5. Load the cats (shown when the map opens) ----------
// The status line under the story ("Loading cats…")
const status = document.getElementById("status");

// Download the GeoJSON file; stop with an error if the server says it is missing
fetch(DATA_URL)
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((data) => {
    // **COREACTION**Draw each cat as a cat pin and attach its popup with bind.popup!!!
    const layer = L.geoJSON(data, {
      pointToLayer: (feature, latlng) => L.marker(latlng, { icon: catIcon }),// draw a cat pin at the photo's coordinates
      onEachFeature: (feature, marker) => {// attach the popup to that pin
        marker.bindPopup(popupHtml(feature.properties), { maxWidth: 260, minWidth: 220 }); // popups are a bit wider than the cat icon
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
  })
  // If anything above failed, turn the status line red and explain how to fix it
  .catch((err) => {
    console.error(err);
    status.className = "error";
    status.textContent =
      `Couldn't load ${DATA_URL}. Run mvp_pipeline.ipynb to create it, ` +
      "then open this page with Live Server.";
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
        shape.bindPopup(alleyPopupHtml(feature.properties), { maxWidth: 260, minWidth: 220 });
      },
    }).addTo(map);
    layerSwitcher.addOverlay(alleys, "Green alleys");
  })
  // If the alleys fail, the cats still work: just log why in the browser console
  .catch((err) => {
    console.error(`Couldn't load ${ALLEYS_URL}. Run ruelles_pipeline.ipynb, then ruelles_cat_distance.ipynb, to create it.`, err);
  });


// ---------- 7. Load the water fountains (hidden until ticked: no .addTo(map)) ----------
fetch(FOUNTAINS_URL)
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((data) => {
    // Draw each fountain as a blue dot and attach its popup
    const fountains = L.geoJSON(data, {
      pointToLayer: (feature, latlng) => L.circleMarker(latlng, fountainStyle),
      onEachFeature: (feature, dot) => {
        dot.bindPopup(fountainPopupHtml(feature.properties), { maxWidth: 260, minWidth: 220 });
      },
    });
    layerSwitcher.addOverlay(fountains, "Water fountains");
  })
  // If the fountains fail, the rest of the map still works: just log why in the browser console
  .catch((err) => {
    console.error(`Couldn't load ${FOUNTAINS_URL}. Run fountains_pipeline.ipynb to create it.`, err);
  });


// ---------- 8. Load the communal gardens (hidden until ticked) ----------
fetch(GARDENS_URL)
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((data) => {
    // Draw each garden as a green dot and attach its popup
    const gardens = L.geoJSON(data, {
      pointToLayer: (feature, latlng) => L.circleMarker(latlng, gardenStyle),
      onEachFeature: (feature, dot) => {
        dot.bindPopup(gardenPopupHtml(feature.properties), { maxWidth: 260, minWidth: 220 });
      },
    });
    layerSwitcher.addOverlay(gardens, "Communal gardens");
  })
  // If the gardens fail, the rest of the map still works: just log why in the browser console
  .catch((err) => {
    console.error(`Couldn't load ${GARDENS_URL}. Run gardens_pipeline.ipynb to create it.`, err);
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
        dot.bindPopup(coolPopupHtml(feature.properties), { maxWidth: 260, minWidth: 220 });
      },
    });
    layerSwitcher.addOverlay(coolPlaces, "Free AC (cool places)");
  })
  // If the cool places fail, the rest of the map still works: just log why in the browser console
  .catch((err) => {
    console.error(`Couldn't load ${COOL_URL}. Run ac_pipeline.ipynb to create it.`, err);
  });


// ---------- 10. Suggested walks (the box in the bottom left corner of the map) ----------
// The walks are loops along the streets, planned in walks_pipeline.ipynb: one per start, length (2, 3 or 5 km)
// and theme (cats: as many cats as possible; nature: as much green alley as possible).
// Here the reader picks all three; we draw that loop and say what it passes.
const walkForm = document.getElementById("walk-form");
const walkSummary = document.getElementById("walk-summary");
const walkLayer = L.layerGroup().addTo(map); // the drawn walks, emptied before each new choice
let catWalks = [];   // every walk in the file, once it has loaded

// Move the walk box from the page into the map's bottom left corner.
// Clicks and scrolling inside it don't move the map.
const WalkBox = L.Control.extend({
  onAdd: () => {
    const box = document.getElementById("walk-box");
    L.DomEvent.disableClickPropagation(box);
    L.DomEvent.disableScrollPropagation(box);
    return box;
  },
});
new WalkBox({ position: "bottomleft" }).addTo(map);

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
  if (!start) {
    walkSummary.textContent = "Pick a starting point to see its walk.";
    return;
  }
  const walk = catWalks.find((f) => f.properties.start === start && f.properties.km === km && f.properties.theme === theme);
  if (!walk) {
    walkSummary.textContent = `Sorry, there's no ${km} km ${theme} walk from ${start} yet. Try another length or theme.`;
    return;
  }

  // Draw the loop and a dot where it starts and ends
  const [lon, lat] = walk.geometry.coordinates[0];
  const line = L.geoJSON(walk, { style: { color: "#de889d", weight: 5, dashArray: "6 6" } }).addTo(walkLayer);
  L.circleMarker([lat, lon], { radius: 7, fillColor: "#e65100", fillOpacity: 1, color: "#ffffff", weight: 2 }).addTo(walkLayer);
  map.fitBounds(line.getBounds(), { padding: [40, 40], maxZoom: 18 });

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

walkForm.addEventListener("change", showWalk);   // any of the three menus

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
    console.error(`Couldn't load ${WALKS_URL}. Run walks_pipeline.ipynb to create it.`, err);
    walkSummary.textContent = "Couldn't load the walks. Run walks_pipeline.ipynb to create them.";
  });
