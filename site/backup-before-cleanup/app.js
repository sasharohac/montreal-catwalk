// CatMap: draws every cat photo in data/cat_photos.geojson as a pin,
// on top of Montréal's green alleys (data/ruelles_vertes.geojson)
// plus drinking fountains (data/water_fountains.geojson), communal gardens (data/communal_gardens.geojson)
// and free air-conditioned public places (data/cool_places.geojson), which stay hidden until ticked in the layer switcher.
// Click a pin to see the photo, its date and its coordinates; click an alley for its details.

// Where the cat data lives (GeoJSON made by the Python notebook) and where the map starts
const DATA_URL = "../data/cat_photos.geojson";
const ALLEYS_URL = "../data/ruelles_vertes.geojson"; // made by ruelles_pipeline.ipynb
const FOUNTAINS_URL = "../data/water_fountains.geojson"; // made by fountains_pipeline.ipynb
const GARDENS_URL = "../data/communal_gardens.geojson"; // made by gardens_pipeline.ipynb
const COOL_URL = "../data/cool_places.geojson"; // made by ac_pipeline.ipynb
const MONTREAL = [45.522, -73.59]; // roughly the Plateau / Mile End

// 1) Base map
// Turn the empty <div id="map"> into a Leaflet map, centred on Montreal at zoom 14
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
const layerSwitcher = L.control.layers(null, null, { collapsed: window.innerWidth < 500 }).addTo(map);

// 2) Pin style: a pink cat silhouette, standing on the spot where the photo was taken
const catIcon = L.icon({
  iconUrl: "icons/cat.png",
  iconSize: [30, 35],      // size on screen in pixels (same shape as the image)
  iconAnchor: [15, 35],    // bottom centre: the cat's feet sit on the location
  popupAnchor: [0, -35],   // popups open just above the cat's head
  className: "cat-icon",
});

// Alley style: green shapes, semi-transparent so the street map shows through
const alleyStyle = {
  pane: "alleys",
  color: "#2e7d32",
  weight: 1,
  fillColor: "#43a047",
  fillOpacity: 0.6,
};

// Fountain style: small blue dots with a white outline, drawn above the alleys and below the cats
const fountainStyle = {
  radius: 5,
  fillColor: "#1e88e5",
  fillOpacity: 1,
  color: "#ffffff",
  weight: 1.5,
};

// Garden style: greeb dots with a white outline, a little bigger than the fountains
const gardenStyle = {
  radius: 7,
  fillColor: "#79b968",
  fillOpacity: 1,
  color: "#ffffff",
  weight: 1.5,
};

// Cool place style: purple dots with a white outline, the same size as the gardens
const coolStyle = {
  radius: 7,
  fillColor: "#8e24aa",
  fillOpacity: 1,
  color: "#ffffff",
  weight: 1.5,
};

// 3) Popup content
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

// Build the HTML inside one popup: photo (a link to it in the gallery), name (if it has a real one),
// date, description (if any) and coordinates rounded to 5 decimals (about 1 m)
function popupHtml(p) {
  const hasName = p.name && p.name !== "Cat sighting";
  return `
    <a class="popup-photo-link" href="gallery.html#${catId(p)}" title="See it in the gallery">
      <img class="popup-photo" src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name || "Cat photo")}">
    </a>
    <div class="popup-text">
      ${hasName ? `<h2>${escapeHtml(p.name)}</h2>` : ""}
      <p>${escapeHtml(formatDate(p.date))}</p>
      ${p.description ? `<p>${escapeHtml(p.description)}</p>` : ""}
      <p class="coords">${Number(p.lat).toFixed(5)}, ${Number(p.lon).toFixed(5)}</p>
    </div>`;
}

// Build the HTML inside an alley's popup: borough, year greened, type of greening,
// whether cars can use it, and its area. Blank values are left out.
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

// Build the HTML inside a fountain's popup: park, what it's near, intersection, borough
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

// Build the HTML inside a garden's popup: its name, address and borough
function gardenPopupHtml(p) {
  return `
    <div class="popup-text garden-popup">
      <h2>${escapeHtml(p.name || "Jardin communautaire")}</h2>
      ${p.address ? `<p>${escapeHtml(p.address)}</p>` : ""}
      <p class="coords">${escapeHtml(p.borough)}</p>
    </div>`;
}

// Build the HTML inside a cool place's popup: its name, address, phone number,
// whether it is wheelchair accessible, and its borough. Blank values are left out.
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

// If a photo file is missing, say which one instead of showing a broken image
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

// 4) Load the photos and add them to the map
// The status line under the story ("Loading cats…")
const status = document.getElementById("status");

// Download the GeoJSON file; stop with an error if the server says it is missing
fetch(DATA_URL)
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((data) => {
    // Draw each cat as a circle marker and attach its popup
    const layer = L.geoJSON(data, {
      pointToLayer: (feature, latlng) => L.marker(latlng, { icon: catIcon }),
      onEachFeature: (feature, marker) => {
        marker.bindPopup(popupHtml(feature.properties), { maxWidth: 260, minWidth: 220 });
      },
    }).addTo(map);
    layerSwitcher.addOverlay(layer, "Cats");

    // Show how many cats were loaded ("1 cat" vs "N cats")
    const count = data.features.length;
    status.textContent = `${count} ${count === 1 ? "cat" : "cats"} photographed around Montréal`;

    // Zoom and pan so every pin is in view (no closer than zoom 16)
    if (count > 0) map.fitBounds(layer.getBounds(), { padding: [40, 40], maxZoom: 16 });

    // If we came from the gallery's "Show on map" link (index.html#cat=IMG_1234),
    // zoom in on that cat and open its popup
    const wanted = new URLSearchParams(location.hash.slice(1)).get("cat");
    layer.eachLayer((marker) => {
      if (wanted && catId(marker.feature.properties) === wanted) {
        map.setView(marker.getLatLng(), 18);
        marker.openPopup();
      }
    });
  })
  // If anything above failed, turn the status line red and explain how to fix it
  .catch((err) => {
    console.error(err);
    status.className = "error";
    status.textContent =
      `Couldn't load ${DATA_URL}. Run mvp_pipeline.ipynb to create it, ` +
      "then open this page with Live Server.";
  });

// 5) Load the green alleys and add them under the cat pins
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
        shape.bindPopup(alleyPopupHtml(feature.properties), { maxWidth: 260, minWidth: 220 });
      },
    }).addTo(map);
    layerSwitcher.addOverlay(alleys, "Green alleys");
  })
  // If the alleys fail, the cats still work: just log why in the browser console
  .catch((err) => {
    console.error(`Couldn't load ${ALLEYS_URL}. Run ruelles_pipeline.ipynb to create it.`, err);
  });

// 6) Load the water fountains; they go in the layer switcher but start hidden (no .addTo(map))
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

// 7) Load the communal gardens; like the fountains, they start hidden
fetch(GARDENS_URL)
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((data) => {
    // Draw each garden as an orange dot and attach its popup
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

// 8) Load the free air-conditioned public places; like the fountains, they start hidden
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
