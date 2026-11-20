// ============================================================
// app.js = BEHAVIOUR: what loads on the map, how it is drawn, and what the popups say.
//
// The Montréal CatWalk: every cat photo in data/cat_photos.geojson as a cat pin,
// on top of Montréal's green alleys. Drinking fountains, communal gardens and
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
//  10. Suggested walks: pick a start, a length and the stops to include
//  11. Planning the loop (from a fixed start, an address or a tap on the map)
//  12. "Take me there": the walk as Google Maps directions and Street View links
//  13. My cats: the reader's own list of cats to visit, ticked off as they meet them (remember.js)
// ============================================================


// ---------- 1. Settings ----------
// Where each GeoJSON file lives (made by the Python notebooks) and where the map starts
const DATA_URL = "../data/cat_photos.geojson";            // made by mvp_pipeline.ipynb
const ALLEYS_URL = "../data/ruelles_vertes.geojson";      // made by ruelles_pipeline.ipynb
const FOUNTAINS_URL = "../data/water_fountains.geojson";  // made by fountains_pipeline.ipynb
const GARDENS_URL = "../data/communal_gardens.geojson";   // made by gardens_pipeline.ipynb
const COOL_URL = "../data/cool_places.geojson";           // made by ac_pipeline.ipynb
const NETWORK_URL = "../data/walk_network.json";          // made by step 8 of walks_pipeline.ipynb
const GEOCODE_URL = "https://nominatim.openstreetmap.org/search"; // OpenStreetMap's free address search
const MONTREAL = [45.522, -73.59]; // roughly the Plateau / Mile End

// Every cat, garden, fountain and cool place, as GeoJSON features. Filled in as each file loads,
// and used to plan walks through the stops the reader ticks (section 11).
const walkStops = { cats: [], gardens: [], fountains: [], cool: [] };

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

// Alleys: all one green (the same as .swatch.alley in style.css), semi-transparent so the
// street map shows through, with a darker outline so the thin ones stay visible
const alleyStyle = {
  pane: "alleys",
  color: "#2e7d32",     // outline
  weight: 1,
  fillColor: "#31a354", // inside
  fillOpacity: 0.7,
};

// Fountains: dark navy water droplets with a white outline (the same drop as the map key in index.html).
// The droplet shape keeps them apart from the map's small round or square STM and BIXI symbols
// (feedback from the test session).
const DROP_SVG =
  '<svg viewBox="0 0 24 32" width="100%" height="100%" aria-hidden="true">' +
  '<path d="M12 2 C12 2 3 14 3 21 a9 9 0 0 0 18 0 C21 14 12 2 12 2 Z" fill="#0d3b8c" stroke="#ffffff" stroke-width="2.5"/>' +
  '<ellipse cx="8.5" cy="21" rx="2" ry="3.5" fill="#ffffff" opacity="0.5"/>' +   // little shine
  "</svg>";

// Droplets grow as you zoom in, so they don't look tiny next to the streets:
// 16px tall at zoom 14 or less, then 4px more per zoom level, up to 32px
function fountainHeight(zoom) {
  return Math.min(32, Math.max(16, 16 + (zoom - 14) * 4));
}

// The droplet icon at a given height; its round bottom sits on the fountain's location
function fountainIcon(zoom) {
  const h = fountainHeight(zoom);
  const w = Math.round(h * 0.75);
  return L.divIcon({
    className: "fountain-icon",
    html: DROP_SVG,
    iconSize: [w, h],
    iconAnchor: [w / 2, h * 0.66],
    popupAnchor: [0, -h * 0.6],
  });
}

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
// date, description (if any), who submitted it (if someone else did) and coordinates rounded to 5 decimals (about 1 m)
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
      ${p.submitted_by ? `<p>Submitted by ${escapeHtml(p.submitted_by)}</p>` : ""}
      <p class="coords">${Number(p.lat).toFixed(5)}, ${Number(p.lon).toFixed(5)}</p>
    </div>`;
}

// Distance for people: "80 m" under 1 km, "1.4 km" above
function formatDistance(m) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

// Alley popup: borough, year greened, type of greening, whether cars can use it, and its area.
// Blank values are left out.
function alleyPopupHtml(p) {
  return `
    <div class="popup-text alley-popup">
      <h2>Ruelle verte</h2>
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
  // Resize the popup to fit the photo once it has loaded. Not with e.popup.update(): that redraws the
  // popup's content and removes the "Cats to visit" / "Mark as visited" buttons remember.js added.
  // These three are the resize steps of update() without the redraw.
  img.addEventListener("load", () => {
    e.popup._updateLayout();
    e.popup._updatePosition();
    e.popup._adjustPan();
  }, { once: true });
});


// ---------- 5. Load the cats (shown when the map opens) ----------
// The status line under the page title ("Loading cats…")
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
    walkStops.cats = data.features;
    // **COREACTION**Draw each cat as a cat pin and attach its popup with bind.popup!!!
    const layer = L.geoJSON(data, {
      pointToLayer: (feature, latlng) => L.marker(latlng, { icon: catIcon }),// draw a cat pin at the photo's coordinates
      onEachFeature: (feature, marker) => {// attach the popup to that pin
        marker.bindPopup(popupHtml(feature.properties), POPUP_OPTIONS); // popups are a bit wider than the cat icon
      },
    }).addTo(map);
    layerSwitcher.addOverlay(layer, "Cats");

    // "My cats": the cats this reader saved, each with a tick for the ones they've met (section 13)
    setUpMyCats(layer);

    // Show how many cats were loaded ("1 cat" vs "N cats")
    const count = data.features.length;
    status.textContent = `${count} ${count === 1 ? "cat" : "cats"} photographed around Montréal`;

    // Zoom and pan so every pin is in view (no closer than zoom 16)
    if (count > 0) map.fitBounds(layer.getBounds(), { padding: [40, 40], maxZoom: 16 });

    // If the address ends in #cat=IMG_1234, zoom in on that cat and open its popup.
    // This happens when we come from the gallery's "Show on map" link,
    // and again whenever the address changes.
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
    // Draw each alley as a green shape and attach its popup
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
    layerFailed("Green alleys", ALLEYS_URL, "Run ruelles_pipeline.ipynb to create it.", err);
  });


// ---------- 7. Load the water fountains (hidden until ticked: no .addTo(map)) ----------
fetch(FOUNTAINS_URL)
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((data) => {
    // Draw each fountain as a droplet, sized for the current zoom, and attach its popup.
    // zIndexOffset keeps the droplets underneath the cat pins where they overlap.
    walkStops.fountains = data.features;
    const fountains = L.geoJSON(data, {
      pointToLayer: (feature, latlng) =>
        L.marker(latlng, { icon: fountainIcon(map.getZoom()), zIndexOffset: -1000, alt: "Water fountain" }),
      onEachFeature: (feature, drop) => {
        drop.bindPopup(fountainPopupHtml(feature.properties), POPUP_OPTIONS);
      },
    });
    layerSwitcher.addOverlay(fountains, "Water fountains");
    // Resize the droplets every time the zoom changes
    map.on("zoomend", () => {
      const icon = fountainIcon(map.getZoom());
      fountains.eachLayer((drop) => drop.setIcon(icon));
    });
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
    walkStops.gardens = data.features;
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
    walkStops.cool = data.features;
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
// The reader picks a start, a length (2, 3 or 5 km) and ticks every kind of stop the walk must pass:
// cats, water fountains, nature (green alleys or community gardens) and free AC. The page plans a loop
// along the streets through those stops (section 11), draws it and says what it passes.
const walkForm = document.getElementById("walk-form");
const walkSummary = document.getElementById("walk-summary");
const walkLayer = L.layerGroup().addTo(map); // the drawn walks, emptied before each new choice
walkSummary.textContent = "Pick a starting point to see its walk.";

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

// The kinds of stop that are ticked, e.g. ["cats", "cool"]
function tickedStops() {
  return [...walkForm.querySelectorAll('input[name="stop"]:checked')].map((box) => box.value);
}

// Runs whenever the start, the length or a checkbox changes
function showWalk() {
  walkLayer.clearLayers();   // remove the previous walk
  const select = document.getElementById("walk-start");
  const start = select.value;
  const km = Number(document.getElementById("walk-km").value);
  customStartBox.hidden = start !== "custom";   // the address box only shows for "My own spot…"
  if (!start) {
    walkSummary.textContent = "Pick a starting point to see its walk.";
    return;
  }
  if (start === "custom") {
    if (!customStart) {
      walkSummary.textContent = "Type an address and press Find, or tap the map where you want to start.";
      return;
    }
    planWalk(customStart, km, tickedStops());   // section 11
    return;
  }
  // A fixed start: its street corner is written on its <option> in index.html
  const option = select.selectedOptions[0];
  planWalk({ lat: Number(option.dataset.lat), lng: Number(option.dataset.lng), label: start }, km, tickedStops());
}

// The stops a walk passes that aren't on the map already (fountains, gardens and cool places
// stay hidden until ticked in the layer switcher), drawn with the walk so the reader can find them
function drawPassedStops(walk) {
  const stops = walk.stops;
  stops.fountains.forEach((f) => {
    const [lon, lat] = f.geometry.coordinates;
    L.marker([lat, lon], { icon: fountainIcon(16), alt: "Water fountain" })
      .bindPopup(fountainPopupHtml(f.properties), POPUP_OPTIONS).addTo(walkLayer);
  });
  stops.gardens.forEach((f) => {
    const [lon, lat] = f.geometry.coordinates;
    L.circleMarker([lat, lon], gardenStyle).bindPopup(gardenPopupHtml(f.properties), POPUP_OPTIONS).addTo(walkLayer);
  });
  stops.cool.forEach((f) => {
    const [lon, lat] = f.geometry.coordinates;
    L.circleMarker([lat, lon], coolStyle).bindPopup(coolPopupHtml(f.properties), POPUP_OPTIONS).addTo(walkLayer);
  });
}

// What each kind of stop is called when the walk couldn't fit one in
const STOP_NAMES = {
  cats: "a cat",
  fountains: "a water fountain",
  nature: "a bit of nature",
  cool: "a free AC place",
};

// Draws one walk (a GeoJSON line with start, length_km, cats, green_m, gardens, fountains, cool,
// the ticked kinds and any it couldn't fit in) and writes its summary
function drawWalk(walk) {
  // Draw the loop and a dot where it starts and ends
  const [lon, lat] = walk.geometry.coordinates[0];
  const line = L.geoJSON(walk, { style: { color: "#cf3d62", weight: 5, dashArray: "6 6" } }).addTo(walkLayer);
  L.circleMarker([lat, lon], { radius: 7, fillColor: "#e65100", fillOpacity: 1, color: "#ffffff", weight: 2 }).addTo(walkLayer);
  // Zoom to the loop, keeping it clear of the walk box: on a phone the box spans the
  // bottom of the map, so leave room under the loop; on a computer it sits on the left
  const boxRoom = isPhone()
    ? { paddingTopLeft: [20, 20], paddingBottomRight: [20, walkBox.offsetHeight + 30] }
    : { paddingTopLeft: [walkBox.offsetWidth + 30, 20], paddingBottomRight: [20, 20] };
  map.fitBounds(line.getBounds(), { ...boxRoom, maxZoom: 18 });

  drawPassedStops(walk);

  // Summary: length, then what the loop passes (the ticked kinds in bold),
  // then any ticked kind that didn't fit in a loop this long
  const p = walk.properties;
  const wanted = (kind) => (p.kinds.includes(kind) ? ' class="wanted"' : "");
  const missing = p.missing.map((kind) => STOP_NAMES[kind]);
  walkSummary.innerHTML = `
    <p><strong>${p.length_km.toFixed(1)} km loop</strong> from ${escapeHtml(p.start)} and back. It passes:</p>
    <ul>
      <li${wanted("cats")}>${plural(p.cats, "cat")}</li>
      <li${wanted("fountains")}>${plural(p.fountains, "water fountain")}</li>
      <li${wanted("nature")}>${formatDistance(p.green_m)} of green alleys</li>
      <li${wanted("nature")}>${plural(p.gardens, "community garden")}</li>
      <li${wanted("cool")}>${plural(p.cool, "free AC place")}</li>
    </ul>
    ${missing.length ? `<p class="walk-missing">Sorry, I couldn't fit ${new Intl.ListFormat("en", { type: "disjunction" }).format(missing)} into a loop this long from here. Try a longer walk or another start.</p>` : ""}
    <p class="walk-go">
      <a href="${escapeHtml(directionsUrl(walk))}" target="_blank" rel="noopener">Take me there</a>
      <a href="${escapeHtml(streetViewUrl(walk))}" target="_blank" rel="noopener">Start in Street View</a>
    </p>
    <p class="hint">Opens Google Maps in a new tab, with turn-by-turn directions on a phone. Google picks its own streets between the points, so it can differ a little from the pink line.</p>`;
}

// Any menu or checkbox. (Typing in the address box also fires "change" when you leave it:
// ignore that, the walk is only planned when you press Find or Enter.)
walkForm.addEventListener("change", (e) => {
  if (e.target.id !== "custom-address") showWalk();
});


// ---------- 11. Planning the loop ----------
// The page plans every walk itself, from a fixed start, an address the reader types or a spot they tap,
// with the method of step 5 of walks_pipeline.ipynb, stretched to pass the ticked kinds of stop:
//   1. snap the start to the nearest street corner of the walking network (data/walk_network.json);
//   2. for each ticked kind, list the corners within reach that are next to one (a cat, a fountain,
//      a garden or green alley, a cool place), plus the "ring": corners about a third of the walk away;
//   3. try loops start → stop → stop → … → start, one corner of each ticked kind (plus ring corners to
//      make up the length), visited in order around the start, each leg the shortest route;
//   4. keep loops within 15% of the chosen length that repeat at most a quarter of their streets, and of
//      those the one that passes the most ticked kinds, then the most of them.
// If a ticked kind can't fit, the walk is still shown and the summary says what's missing.

const WALK_TOLERANCE = 0.15;  // a "3 km" walk can be 2.55 to 3.45 km (same as the notebook)
const WALK_MAX_REPEAT = 0.25; // at most a quarter of a walk can go back over streets it already used
const WALK_NEAR_M = 50;       // a cat, garden, fountain or cool place within 50 m of the route counts as "passed"
const WALK_MAX_SNAP_M = 300;  // a start more than 300 m from any street corner is outside the network
const NATURE_MIN_GREEN_M = 100; // "nature" is passed with a community garden or at least 100 m of green alley
const POOL_SIZE = 8;          // corners to try for each ticked kind, and for the ring (each needs one route search)
const WALK_TRIES = 160;       // loops to try

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

// Random choices that are the same every time for the same spot, length and ticked stops,
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

// Up to `n` different items from a list, picked at random
function sample(list, n, random) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

// A number made from a word, so each set of ticked stops gets its own random choices
function hashText(text) {
  return [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0);
}

// The corner nearest each cat, garden, fountain or cool place (worked out once per network and data).
// Stops more than WALK_NEAR_M from any corner (outside the network) are left out.
const stopCornerCache = new Map();
function stopCorners(net, name) {
  const features = walkStops[name];
  const cached = stopCornerCache.get(name);
  if (cached && cached.features === features) return cached.corners;
  const corners = new Set();
  for (const f of features) {
    const snap = nearestCorner(net, toXY(f.geometry.coordinates));
    if (snap.metres <= WALK_NEAR_M) corners.add(snap.corner);
  }
  stopCornerCache.set(name, { features, corners });
  return corners;
}

// The corners next to each kind of stop the reader can tick. "nature" is any community garden
// or either end of a street piece with some green alley along it.
function kindCorners(net, kind) {
  if (kind !== "nature") return stopCorners(net, kind);
  if (!net.greenCorners) {
    net.greenCorners = new Set();
    net.pieces.forEach((p) => {
      if (p.green >= 30) { net.greenCorners.add(p.u); net.greenCorners.add(p.v); }
    });
  }
  return new Set([...stopCorners(net, "gardens"), ...net.greenCorners]);
}

// The features within WALK_NEAR_M of the route line (a list of [x, y])
function nearStops(features, line, box) {
  const near = [];
  for (const f of features) {
    const [x, y] = toXY(f.geometry.coordinates);
    if (x < box[0] || x > box[2] || y < box[1] || y > box[3]) continue;   // quick skip: nowhere near
    for (let i = 1; i < line.length; i++) {
      if (distanceToSegment(x, y, line[i - 1], line[i]) <= WALK_NEAR_M) { near.push(f); break; }
    }
  }
  return near;
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

// How good a loop is at the ticked kinds, once it passes as many of them as it can:
// more cats, fountains, gardens and cool places, and more metres of green alley, all count
function stopValue(s, kinds) {
  if (!kinds.length) return s.stops.cats.length * 20 + s.green / 10;   // nothing ticked: a pleasant walk
  let value = 0;
  if (kinds.includes("cats")) value += s.stops.cats.length * 100;
  if (kinds.includes("fountains")) value += s.stops.fountains.length * 50;
  if (kinds.includes("nature")) value += s.green / 5 + s.stops.gardens.length * 150;
  if (kinds.includes("cool")) value += s.stops.cool.length * 200;
  return value;
}

// Plans the best loop from a spot through the ticked kinds of stop.
// Returns { walk } or { problem: "outside" | "noloop" }.
function planLoop(net, spot, km, kinds) {
  const target = km * 1000;
  const snap = nearestCorner(net, toXY([spot.lng, spot.lat]));
  if (snap.metres > WALK_MAX_SNAP_M) return { problem: "outside" };
  const start = snap.corner;
  const random = seededRandom(Math.round(spot.lat * 1e5) * 31 + Math.round(spot.lng * 1e5) + km * 7 + hashText(kinds.join()));

  // 1 and 2. Every corner within reach (under 0.45 × the walk away), the ring, and for each ticked kind
  // a handful of corners within reach next to one
  const byLength = shortestRoutes(net, start, (p) => p.length, 0.45 * target);
  const ring = [];
  for (const [n, d] of byLength.dist) if (d >= 0.22 * target && d <= 0.38 * target) ring.push(n);
  if (ring.length < 2) return { problem: "noloop" };
  const ringPool = sample(ring, POOL_SIZE, random);
  const reachable = [...byLength.dist.keys()].filter((n) => n !== start);
  const pools = {};
  for (const kind of kinds) {
    const corners = kindCorners(net, kind);
    pools[kind] = sample(reachable.filter((n) => corners.has(n)), POOL_SIZE, random);
  }

  // Routes take the shortest streets; when nature is ticked, green alley metres count as cheaper so
  // routes lean into them (the notebook's nature_cost: length - 0.6 × green metres)
  const cost = kinds.includes("nature") ? (p) => p.length - 0.6 * p.green : (p) => p.length;
  const fromStart = kinds.includes("nature") ? shortestRoutes(net, start, cost, 0.45 * target) : byLength;
  const routesFrom = new Map();   // one route search per stop corner, reused by every loop through it
  const routes = (corner) => {
    if (!routesFrom.has(corner)) routesFrom.set(corner, shortestRoutes(net, corner, cost, 0.7 * target));
    return routesFrom.get(corner);
  };
  // Stops are visited in order around the start (by compass direction), so the loop doesn't zigzag
  const [sx, sy] = net.xy[start];
  const direction = (n) => Math.atan2(net.xy[n][1] - sy, net.xy[n][0] - sx);

  // 3. Try loops start → stop → stop → … → start
  const candidates = [];
  const tried = new Set();
  for (let t = 0; t < WALK_TRIES; t++) {
    const stops = new Set();
    for (const kind of kinds) if (pools[kind].length) stops.add(pick(pools[kind], random));
    const extra = Math.floor(random() * 3);   // 0, 1 or 2 ring corners to stretch the loop to length
    for (let k = 0; k < extra + 6 && (k < extra || stops.size < 2); k++) stops.add(pick(ringPool, random));
    if (stops.size < 2) continue;
    const order = [...stops].sort((a, b) => direction(a) - direction(b));
    const key = order.join();
    if (tried.has(key)) continue;
    tried.add(key);

    const legs = [traceRoute(net, fromStart, order[0])];
    for (let i = 1; i < order.length; i++) legs.push(traceRoute(net, routes(order[i - 1]), order[i]));
    const back = traceRoute(net, fromStart, order[order.length - 1]);
    if (legs.includes(null) || !back) continue;
    const s = scoreLoop(net, [...legs.flat(), ...back.slice().reverse()]);
    // 4. Only loops of about the right length that don't double back too much
    if (Math.abs(s.length - target) <= WALK_TOLERANCE * target && s.repeat <= WALK_MAX_REPEAT) candidates.push(s);
  }
  if (!candidates.length) return { problem: "noloop" };

  // Find what each good loop passes, then keep the one that passes the most ticked kinds, then the best stopValue
  let best = null, bestValue = -Infinity;
  for (const s of candidates) {
    s.coords = loopLine(net, start, s.loop);
    const line = s.coords.map(toXY);
    const xs = line.map((p) => p[0]), ys = line.map((p) => p[1]);
    const box = [Math.min(...xs) - WALK_NEAR_M, Math.min(...ys) - WALK_NEAR_M, Math.max(...xs) + WALK_NEAR_M, Math.max(...ys) + WALK_NEAR_M];
    s.stops = {};
    for (const name of ["cats", "fountains", "gardens", "cool"]) s.stops[name] = nearStops(walkStops[name], line, box);
    s.passed = {
      cats: s.stops.cats.length > 0,
      fountains: s.stops.fountains.length > 0,
      nature: s.stops.gardens.length > 0 || s.green >= NATURE_MIN_GREEN_M,
      cool: s.stops.cool.length > 0,
    };
    const value = kinds.filter((k) => s.passed[k]).length * 1e9 + stopValue(s, kinds);
    if (value > bestValue) { best = s; bestValue = value; }
  }

  return {
    walk: {
      type: "Feature",
      geometry: { type: "LineString", coordinates: best.coords },
      properties: {
        start: spot.label || "your spot",
        length_km: best.length / 1000,
        cats: best.stops.cats.length,
        green_m: Math.round(best.green),
        gardens: best.stops.gardens.length,
        fountains: best.stops.fountains.length,
        cool: best.stops.cool.length,
        kinds,
        missing: kinds.filter((k) => !best.passed[k]),
      },
      stops: best.stops,   // the features passed, for drawPassedStops()
      alleys: greenStretches(net, best.loop),   // for the "Take me there" link (section 12)
    },
  };
}

// Plans a walk from `spot` ({ lat, lng, label }) through the ticked kinds and draws it.
// Runs from showWalk() whenever the start, length or a checkbox changes.
function planWalk(spot, km, kinds) {
  const thisPlan = ++planNumber;
  // Mark the chosen spot straight away, so the reader sees where the walk will start
  const pin = L.circleMarker([spot.lat, spot.lng], { radius: 7, fillColor: "#e65100", fillOpacity: 1, color: "#ffffff", weight: 2 }).addTo(walkLayer);
  walkSummary.textContent = "Planning your walk…";

  loadNetwork()
    .then((net) => new Promise((done) => setTimeout(() => done(net), 30)))   // let "Planning…" appear first
    .then((net) => {
      if (thisPlan !== planNumber) return;    // the reader has already asked for something else
      const result = planLoop(net, spot, km, kinds);
      if (result.walk) {
        walkLayer.clearLayers();
        drawWalk(result.walk);
        return;
      }
      const sorry = {
        outside: "Sorry, that spot is outside the area these walks cover.",
        noloop: `Sorry, there's no ${km} km loop from that spot.`,
      };
      walkSummary.textContent = `${sorry[result.problem]} Try another length, or a spot closer to the Plateau or Mile End.`;
      if (result.problem !== "outside") map.panTo(pin.getLatLng());
    })
    .catch((err) => {
      console.error(`Couldn't load ${NETWORK_URL}. Run step 8 of walks_pipeline.ipynb to create it.`, err);
      if (thisPlan !== planNumber) return;
      walkSummary.textContent = "Sorry, the walks couldn't be loaded. Try reloading the page.";
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


// ---------- 12. "Take me there": the walk in Google Maps ----------
// Two links under each walk's summary:
//   - "Take me there" opens Google Maps walking directions for the loop (start → waypoints → start).
//     On a phone that's the Maps app, with turn-by-turn directions.
//   - "Start in Street View" opens Street View at the start, facing the way the walk sets off.
// Google takes at most 9 waypoints in a link and picks its own streets between them, so the
// waypoints are chosen to pin the route to the pink line: first the middle of the longest green
// alleys the walk goes through (Google might otherwise take the street next to them), then the
// points where the loop bends the most away from a straight line.

const GOOGLE_MAX_WAYPOINTS = 9;  // Google Maps' limit for a directions link
const ALLEY_WAYPOINTS = 3;       // at most this many of them go to green alleys
const ALLEY_MIN_M = 60;          // shorter stretches of green alley aren't worth a waypoint
const WAYPOINT_MIN_BEND_M = 25;  // stop adding waypoints once the line strays less than this from them

// The stretches of green alley a loop walks through, longest first: for each, its middle point
// ([lon, lat]), where that falls in the loop's line (an index into loopLine()), and its length.
// A street piece counts as green alley when more than half of it is.
function greenStretches(net, loop) {
  const stretches = [];
  let current = null;
  let index = 0;   // where each piece starts in the loop's line
  for (const i of loop) {
    const { length, green, bends } = net.pieces[i];
    if (green > length / 2) {
      if (!current) { current = { pieces: [], metres: 0 }; stretches.push(current); }
      current.pieces.push({ i, index, length });
      current.metres += length;
    } else {
      current = null;
    }
    index += bends.length / 2 + 1;
  }
  return stretches
    .filter((s) => s.metres >= ALLEY_MIN_M)
    .map((s) => {
      // The piece halfway along the stretch, and the middle of that piece
      let walked = 0;
      const middle = s.pieces.find((p) => (walked += p.length) >= s.metres / 2);
      const { u, v, bends } = net.pieces[middle.i];
      const point = bends.length
        ? [bends[2 * Math.floor(bends.length / 4)], bends[2 * Math.floor(bends.length / 4) + 1]]
        : [(net.nodes[u][0] + net.nodes[v][0]) / 2, (net.nodes[u][1] + net.nodes[v][1]) / 2];
      return { point, index: middle.index, metres: s.metres };
    })
    .sort((a, b) => b.metres - a.metres);
}

// Up to GOOGLE_MAX_WAYPOINTS points ([lon, lat]) along the loop, in walking order
function walkWaypoints(walk) {
  const coords = walk.geometry.coordinates;
  const xy = coords.map(toXY);
  const last = coords.length - 1;
  const chosen = new Map([[0, coords[0]], [last, coords[last]]]);   // line index → point

  // 1. The middle of the longest green alleys
  for (const alley of (walk.alleys || []).slice(0, ALLEY_WAYPOINTS)) {
    if (alley.index > 0 && alley.index < last && !chosen.has(alley.index)) chosen.set(alley.index, alley.point);
  }

  // 2. The sharpest bends: add the point of the line furthest from the waypoints chosen so far
  //    (like Douglas-Peucker line simplification), until there are enough or the line is close to them
  while (chosen.size - 2 < GOOGLE_MAX_WAYPOINTS) {
    const kept = [...chosen.keys()].sort((a, b) => a - b);
    let far = -1, farM = WAYPOINT_MIN_BEND_M;
    for (let k = 1; k < kept.length; k++) {
      const [a, b] = [kept[k - 1], kept[k]];
      for (let i = a + 1; i < b; i++) {
        const metres = distanceToSegment(xy[i][0], xy[i][1], xy[a], xy[b]);
        if (metres > farM) { far = i; farM = metres; }
      }
    }
    if (far < 0) break;
    chosen.set(far, coords[far]);
  }

  return [...chosen.keys()].sort((a, b) => a - b).slice(1, -1).map((i) => chosen.get(i));
}

// "lat,lng" for Google, from a [lon, lat] point
const googlePoint = ([lon, lat]) => `${lat.toFixed(6)},${lon.toFixed(6)}`;

// Google Maps walking directions from the start, through the waypoints and back to the start
function directionsUrl(walk) {
  const start = googlePoint(walk.geometry.coordinates[0]);
  const params = new URLSearchParams({
    api: "1",
    origin: start,
    destination: start,
    travelmode: "walking",
    waypoints: walkWaypoints(walk).map(googlePoint).join("|"),
  });
  return `https://www.google.com/maps/dir/?${params}`;
}

// Google Street View at the start, facing the first ~30 m of the walk
function streetViewUrl(walk) {
  const coords = walk.geometry.coordinates;
  const [sx, sy] = toXY(coords[0]);
  const ahead = coords.map(toXY).find(([x, y]) => Math.hypot(x - sx, y - sy) >= 30) || toXY(coords[1]);
  const heading = (Math.atan2(ahead[0] - sx, ahead[1] - sy) * 180 / Math.PI + 360) % 360;   // 0 = north
  const params = new URLSearchParams({
    api: "1",
    map_action: "pano",
    viewpoint: googlePoint(coords[0]),
    heading: Math.round(heading),
  });
  return `https://www.google.com/maps/@?${params}`;
}


// ---------- 13. My cats (the folding box in the top right of the map) ----------
// The map remembers two things for each reader, in their own browser (remember.js, Lab 9):
//   - the cats they saved to visit ("♡ Save to My cats" in a cat's popup), and
//   - the cats they've met ("🐾 Mark as visited" in the popup, or the tick box in this list).
// Both are kept by rememberMarks() in remember.js, which also adds the two popup buttons.
// This box shows every cat in either one: not-yet-met cats first, met ones underneath with a paw.
// Click a name to fly to that cat; ✕ takes it off the list (and forgets you met it).
// Folded, the box is one line, "My cats · 2 of 5 met"; whether it's open is remembered too.

function setUpMyCats(catLayer) {
  // Every cat pin, by its photo's file name (the id rememberMarks uses)
  const pins = {};
  catLayer.eachLayer((pin) => { pins[pin.feature.properties.photo] = pin; });

  // The box: a <details> like the walk box, so its title folds and unfolds it
  const box = L.DomUtil.create("details", "my-cats");
  box.innerHTML = `
    <summary><h2>My cats</h2><span class="my-cats-count"></span></summary>
    <p class="hint my-cats-empty">Open a cat and press <strong>♡ Save to My cats</strong> to add it here.</p>
    <ul class="my-cats-list"></ul>`;
  L.DomEvent.disableClickPropagation(box);
  L.DomEvent.disableScrollPropagation(box);
  const MyCatsBox = L.Control.extend({ onAdd: () => box });
  new MyCatsBox({ position: "topright" }).addTo(map);

  // Open or folded as the reader left it (folded the first time on a phone, where the map is small)
  const openKey = geog464StorageKey("my-cats-open");
  box.open = geog464Load(openKey, !isPhone());
  box.addEventListener("toggle", () => geog464Save(openKey, box.open));

  // The two lists remember.js keeps. panel: false = no panels of its own, this box shows them instead;
  // onChange = redraw this box whenever a popup button or a tick changes one of them.
  const saved = rememberMarks(map, catLayer, { idField: "photo", nameField: "name", title: "My cats", panel: false, onChange: () => draw() });
  const met = rememberMarks(map, catLayer, { idField: "photo", nameField: "name", mode: "progress", panel: false, onChange: () => draw() });

  const count = box.querySelector(".my-cats-count");
  const empty = box.querySelector(".my-cats-empty");
  const list = box.querySelector(".my-cats-list");
  const catNumber = (id) => Number((pins[id].feature.properties.name.match(/\d+/) || [0])[0]);   // "Cat #12" → 12

  function draw() {
    // Every cat that's saved or met (and still on the map): not met first, then by number
    const ids = [...new Set([...saved.marked, ...met.marked])].filter((id) => pins[id]);
    ids.sort((a, b) => met.has(a) - met.has(b) || catNumber(a) - catNumber(b));
    const metCount = ids.filter((id) => met.has(id)).length;
    count.textContent = ids.length ? `${metCount} of ${ids.length} met` : "";
    empty.hidden = ids.length > 0;

    list.textContent = "";
    for (const id of ids) {
      const name = pins[id].feature.properties.name || "Cat";
      const li = document.createElement("li");
      li.classList.toggle("met", met.has(id));

      // Tick box: met this cat or not
      const tick = document.createElement("input");
      tick.type = "checkbox";
      tick.checked = met.has(id);
      tick.setAttribute("aria-label", `I've met ${name}`);
      tick.addEventListener("change", () => met.toggle(id));

      // The name: fly to the cat and open its popup
      const link = document.createElement("a");
      link.href = "#";
      link.textContent = name;
      link.addEventListener("click", (e) => {
        e.preventDefault();
        map.setView(pins[id].getLatLng(), Math.max(map.getZoom(), 17));
        pins[id].openPopup();
      });

      // ✕: off the list altogether
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "my-cats-remove";
      remove.textContent = "✕";
      remove.setAttribute("aria-label", `Remove ${name} from My cats`);
      remove.addEventListener("click", () => {
        if (saved.has(id)) saved.toggle(id);
        if (met.has(id)) met.toggle(id);
      });

      li.append(tick, link, remove);
      list.append(li);
    }
  }
  draw();
}
