// ============================================================
// landing.js = BEHAVIOUR of the landing page (index.html).
//
// The hero photo is already chosen by the small script in index.html's <head>
// (so it shows instantly). This file:
//   1. puts a DIFFERENT landing photo in the "why" block
//   2. fills the cat row with 4 random cats from the map data
// ============================================================

const HERO_PHOTOS = ["IMG_0161", "IMG_0350", "IMG_2108", "IMG_3633", "IMG_4294", "IMG_4311", "IMG_4312"];
const DATA_URL = "../data/cat_photos.geojson"; // same file the map and gallery use
const CATS_TO_SHOW = 4;

// Make text safe to put inside HTML
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

// Same ID as app.js / gallery.js, so "map.html#cat=ID" opens that cat's popup
function catId(p) {
  return (p.photo || "").replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_-]/g, "_");
}

// Shuffle a copy of a list (Fisher–Yates)
function shuffled(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}


// ---------- 1. Second photo: any landing photo except the hero ----------
const others = HERO_PHOTOS.filter(p => p !== window.HERO_PICK);
const second = others[Math.floor(Math.random() * others.length)];
document.getElementById("why-photo").style.backgroundImage = `url('landing/${second}.jpg')`;


// ---------- 2. Cat row ----------
const row = document.getElementById("cat-row");

fetch(DATA_URL)
  .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then(data => {
    const cats = data.features.map(f => f.properties).filter(p => p.image);
    // Prefer cats with a real name; top up with unnamed ones if there aren't enough
    const named = shuffled(cats.filter(p => p.name && p.name !== "Cat sighting"));
    const unnamed = shuffled(cats.filter(p => !p.name || p.name === "Cat sighting"));
    const pick = named.concat(unnamed).slice(0, CATS_TO_SHOW);

    pick.forEach(p => {
      const hasName = p.name && p.name !== "Cat sighting";
      const a = document.createElement("a");
      a.className = "cat-card";
      a.href = `map.html#cat=${catId(p)}`;
      a.innerHTML = `
        <span class="cat-img"><img src="${escapeHtml(p.image)}" alt="" loading="lazy"></span>
        <span class="cat-name">${escapeHtml(hasName ? p.name : "A cat sighting")}</span>
        <span class="cat-meta">Find on the map →</span>`;
      row.appendChild(a);
    });
  })
  .catch(() => {
    // No data (e.g. opened without Live Server): the gallery tile alone still works
  });
