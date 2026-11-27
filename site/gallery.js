// ============================================================
// gallery.js = BEHAVIOUR of the gallery page.
//
// Shows every cat photo in data/cat_photos.geojson, grouped by month, newest first.
// Opened from a map popup as gallery.html#IMG_1234, it scrolls to that photo and highlights it.
//
// Sections:
//   1. Settings
//   2. Helpers and card content
//   3. Load the photos and build the gallery
//   4. Lightbox: the big view of one photo
//   5. ♡ Save: the same "My cats" list as on the map (remember.js)
// ============================================================


// ---------- 1. Settings ----------
const DATA_URL = "../data/cat_photos.geojson"; // made by mvp_pipeline.ipynb


// ---------- 2. Helpers and card content ----------
// Make text safe to put inside HTML, so characters like < can't break the page
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

// Turn "2026-04-30 13:23" into a real date (or null if it's blank or unreadable)
function parseDate(dateText) {
  if (!dateText) return null;
  const d = new Date(dateText.replace(" ", "T"));
  return isNaN(d) ? null : d;
}

// A short ID for each photo, made from its file name: "FullSizeRender 2.HEIC" -> "FullSizeRender_2".
// app.js makes the same ID, so the map and the gallery can link to each other.
function catId(p) {
  return (p.photo || "").replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_-]/g, "_");
}

// True for photos sent in by someone else (submitted_by is a name, not "admin" or blank)
function isCommunity(p) {
  const by = (p.submitted_by || "").trim().toLowerCase();
  return by !== "" && by !== "admin";
}

// Build the HTML for one photo card. "index" is its place in the sorted list, used by the lightbox.
// Community photos get the "community" class, which gives them a light orange caption (gallery.css).
function cardHtml(p, date, index) {
  const id = catId(p);
  const hasName = p.name && p.name !== "Cat sighting";
  const when = date
    ? date.toLocaleString("en-CA", { day: "numeric", month: "long", hour: "numeric", minute: "2-digit" })
    : "Date unknown";
  return `
    <figure class="card${isCommunity(p) ? " community" : ""}" id="${id}" data-index="${index}">
      ${isCommunity(p) ? `<span class="submitted-by">Submitted by ${escapeHtml(p.submitted_by)}</span>` : ""}
      <img src="${escapeHtml(p.image)}" alt="${escapeHtml(hasName ? p.name : "Cat photo")}" loading="lazy">
      <button class="save-link save-heart" type="button" data-photo="${escapeHtml(p.photo)}"
              aria-label="Save ${escapeHtml(hasName ? p.name : "this cat")} to My cats"></button>
      <figcaption>
        ${hasName ? `<strong>${escapeHtml(p.name)}</strong>` : ""}
        <strong class="when">${escapeHtml(when)}</strong>
        ${p.description ? escapeHtml(p.description) : ""}
        <span class="card-links">
          <a class="map-link" href="map.html#cat=${id}">Show on map →</a>
          <button class="expand-link" type="button">Expand ⤢</button>
        </span>
      </figcaption>
    </figure>`;
}


// ---------- 3. Load the photos and build the gallery ----------
const status = document.getElementById("status");
const gallery = document.getElementById("gallery");
let photos = []; // every photo, newest first; filled in once the data loads

// Download the GeoJSON file; stop with an error if the server says it is missing
fetch(DATA_URL)
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((data) => {
    // a) Sort newest first; photos without a date go last
    photos = data.features
      .map((f) => ({ p: f.properties, date: parseDate(f.properties.date) }))
      .sort((a, b) => (b.date ?? 0) - (a.date ?? 0));
    photos.forEach((photo, i) => (photo.index = i));

    // b) Group by month: "July 2026" -> [photos...] (a Map keeps the sorted order)
    const months = new Map();
    for (const photo of photos) {
      const label = photo.date
        ? photo.date.toLocaleString("en-CA", { month: "long", year: "numeric" })
        : "Date unknown";
      if (!months.has(label)) months.set(label, []);
      months.get(label).push(photo);
    }

    // c) One section per month: a heading, then a grid of cards
    gallery.innerHTML = [...months]
      .map(([label, list]) => `
        <section class="month">
          <h2>${escapeHtml(label)}</h2>
          <div class="grid">${list.map(({ p, date, index }) => cardHtml(p, date, index)).join("")}</div>
        </section>`)
      .join("");

    // If a photo file is missing, say which one instead of showing a broken image
    gallery.querySelectorAll(".card img").forEach((img) => {
      img.addEventListener("error", () => {
        const note = document.createElement("div");
        note.className = "missing";
        console.error(`Photo not found: site/${img.getAttribute("src")}. Run step 6 of photos_to_csv.ipynb.`);
        note.textContent = "Sorry, this photo couldn't be loaded.";
        img.replaceWith(note);
      }, { once: true });
    });

    status.textContent = `${photos.length} cat photos, newest first`;
    showSaved();   // fill in each card's ♡ Save button (section 5)

    // d) If we came from the map (gallery.html#IMG_1234), scroll to that photo and highlight it
    const target = location.hash && document.getElementById(location.hash.slice(1));
    if (target) {
      target.scrollIntoView({ block: "center" });
      target.classList.add("highlight");
    }
  })
  // If the data didn't load, turn the status line red and tell the reader; log the fix in the console
  .catch((err) => {
    console.error(`Couldn't load ${DATA_URL}. Run mvp_pipeline.ipynb to create it, then open this page with Live Server.`, err);
    status.className = "error";
    status.textContent =
      "Sorry, the cat photos couldn't be loaded. Try reloading the page in a minute.";
  });


// ---------- 4. Lightbox: the big view of one photo ----------
const lightbox = document.getElementById("lightbox");
const lbImg = document.getElementById("lb-img");
const lbCaption = document.getElementById("lb-caption");
const lbMap = document.getElementById("lb-map");
let current = 0; // which photo the lightbox is showing

// Show photo number i (going past the last one wraps round to the first, and back)
function showPhoto(i) {
  current = (i + photos.length) % photos.length;
  const { p, date } = photos[current];
  const hasName = p.name && p.name !== "Cat sighting";
  lbImg.src = p.image;
  lbImg.alt = hasName ? p.name : "Cat photo";
  const when = date ? date.toLocaleString("en-CA", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" }) : "Date unknown";
  lbCaption.innerHTML = [
    hasName ? escapeHtml(p.name) : "",
    `<strong class="when">${escapeHtml(when)}</strong>`, // date in bold
    p.description ? escapeHtml(p.description) : "",
    isCommunity(p) ? `Submitted by ${escapeHtml(p.submitted_by)}` : "",
  ].filter(Boolean).join(" · ");
  lbMap.href = `map.html#cat=${catId(p)}`;
  lbSave.dataset.photo = p.photo;   // the ♡ Save button is now for this photo
  showSaved();
}

// Clicking a thumbnail or its "Expand" link opens the lightbox on that photo
gallery.addEventListener("click", (e) => {
  if (!e.target.closest(".card img, .expand-link")) return;
  showPhoto(Number(e.target.closest(".card").dataset.index));
  lightbox.showModal();
});

// Buttons: close, previous, next
lightbox.querySelector(".lb-close").addEventListener("click", () => lightbox.close());
lightbox.querySelector(".lb-prev").addEventListener("click", () => showPhoto(current - 1));
lightbox.querySelector(".lb-next").addEventListener("click", () => showPhoto(current + 1));

// Arrow keys flick through the photos (Esc to close is built into <dialog>)
lightbox.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") showPhoto(current - 1);
  if (e.key === "ArrowRight") showPhoto(current + 1);
});

// Clicking the dark area around the photo closes it
lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) lightbox.close();
});


// ---------- 5. ♡ Save: the same "My cats" list as on the map ----------
// Each card and the big view have a ♡ Save button. A saved cat goes in My cats on the map page,
// where the reader can tick it off once they've met it, or plan a walk to it.
// The list lives in the reader's own browser (localStorage), under the same name the map's
// rememberMarks() uses, so both pages share it. geog464StorageKey, geog464Load and geog464Save
// come from remember.js, loaded just before this file.
const SAVED_KEY = geog464StorageKey("favourites");
const lbSave = document.getElementById("lb-save");

// The saved photos' file names, read fresh each time (the map may have changed them in another tab)
function savedPhotos() {
  const list = geog464Load(SAVED_KEY, []);
  return Array.isArray(list) ? list : [];
}

// Show every ♡ Save button as saved or not. On the cards it's just a heart on the photo
// (its aria-label says what it does); in the big view it has words too.
function showSaved() {
  const saved = savedPhotos();
  document.querySelectorAll(".save-link").forEach((button) => {
    const on = saved.includes(button.dataset.photo);
    if (button.classList.contains("save-heart")) button.textContent = on ? "♥" : "♡";
    else button.textContent = on ? "♥ Saved" : "♡ Save";
    button.classList.toggle("is-on", on);
    button.setAttribute("aria-pressed", on);   // read out as "Save, toggle button, pressed"
  });
}

// Save the photo, or take it off the list if it's already saved
function toggleSaved(photo) {
  const saved = savedPhotos();
  const next = saved.includes(photo) ? saved.filter((x) => x !== photo) : saved.concat([photo]);
  if (!geog464Save(SAVED_KEY, next)) {
    status.textContent = "Sorry, this browser wouldn't save it (a private window, maybe?).";
    return;
  }
  showSaved();
}

// A click on any card's ♡ Save, or the big view's
gallery.addEventListener("click", (e) => {
  const button = e.target.closest(".save-link");
  if (button) toggleSaved(button.dataset.photo);
});
lbSave.addEventListener("click", () => toggleSaved(lbSave.dataset.photo));

// The map, open in another tab, saved or removed a cat: show it here straight away
window.addEventListener("storage", (e) => {
  if (e.key === SAVED_KEY) showSaved();
});
