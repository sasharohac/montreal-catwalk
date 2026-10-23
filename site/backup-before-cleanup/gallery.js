// CatMap Gallery: shows every cat photo in data/cat_photos.geojson, grouped by month, newest first.
// Opened from a map popup as gallery.html#IMG_1234, it scrolls to that photo and highlights it.

const DATA_URL = "../data/cat_photos.geojson";

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

// Build the HTML for one photo card. "index" is its place in the sorted list, used by the lightbox.
function cardHtml(p, date, index) {
  const id = catId(p);
  const hasName = p.name && p.name !== "Cat sighting";
  const when = date
    ? date.toLocaleString("en-CA", { day: "numeric", month: "long", hour: "numeric", minute: "2-digit" })
    : "Date unknown";
  return `
    <figure class="card" id="${id}" data-index="${index}">
      <img src="${escapeHtml(p.image)}" alt="${escapeHtml(hasName ? p.name : "Cat photo")}" loading="lazy">
      <figcaption>
        ${hasName ? `<strong>${escapeHtml(p.name)}</strong>` : ""}
        ${escapeHtml(when)}
        ${p.description ? `<br>${escapeHtml(p.description)}` : ""}
        <span class="card-links">
          <a class="map-link" href="index.html#cat=${id}">Show on map →</a>
          <button class="expand-link" type="button">Expand ⤢</button>
        </span>
      </figcaption>
    </figure>`;
}

const status = document.getElementById("status");
const gallery = document.getElementById("gallery");
let photos = []; // every photo, newest first; filled in once the data loads

fetch(DATA_URL)
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((data) => {
    // 1) Sort newest first; photos without a date go last
    photos = data.features
      .map((f) => ({ p: f.properties, date: parseDate(f.properties.date) }))
      .sort((a, b) => (b.date ?? 0) - (a.date ?? 0));
    photos.forEach((photo, i) => (photo.index = i));

    // 2) Group by month: "July 2026" -> [photos...] (a Map keeps the sorted order)
    const months = new Map();
    for (const photo of photos) {
      const label = photo.date
        ? photo.date.toLocaleString("en-CA", { month: "long", year: "numeric" })
        : "Date unknown";
      if (!months.has(label)) months.set(label, []);
      months.get(label).push(photo);
    }

    // 3) One section per month: a heading, then a grid of cards
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
        note.textContent = `Photo not found: ${img.getAttribute("src")}`;
        img.replaceWith(note);
      }, { once: true });
    });

    status.textContent = `${photos.length} cat photos, newest first`;

    // 4) If we came from the map (gallery.html#IMG_1234), scroll to that photo and highlight it
    const target = location.hash && document.getElementById(location.hash.slice(1));
    if (target) {
      target.scrollIntoView({ block: "center" });
      target.classList.add("highlight");
    }
  })
  // If the data didn't load, turn the status line red and explain how to fix it
  .catch((err) => {
    console.error(err);
    status.className = "error";
    status.textContent =
      `Couldn't load ${DATA_URL}. Run mvp_pipeline.ipynb to create it, ` +
      "then open this page with Live Server.";
  });

// 5) Lightbox: the big view of one photo
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
  lbCaption.textContent = [
    hasName ? p.name : "",
    date ? date.toLocaleString("en-CA", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" }) : "Date unknown",
    p.description || "",
  ].filter(Boolean).join(" · ");
  lbMap.href = `index.html#cat=${catId(p)}`;
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
