// ============================================================
// landing.js = BEHAVIOUR of the landing page (index.html).
//
// The hero photo is already chosen by the small script in index.html's <head>
// (so it shows instantly, with no flash of a blank background). This file:
//   1. puts a DIFFERENT landing photo in the "why" block
//   2. fills the cat row with 4 random cats from the map data
//
// WHY RANDOM: the landing page looks different on every visit (a new hero photo,
// a new second photo, new cats in the row). Someone coming back sees other cats,
// which shows how many there are and makes them want to explore the map.
//
// It is loaded at the very end of index.html, so the elements it fills in
// (#why-photo and #cat-row) already exist when it runs.
// ============================================================

// The photos in site/landing/ (names without ".jpg").
// This list MUST match the `photos` list in index.html's <head>: that one picks the
// hero photo, this one picks the second photo. When adding a photo, add it to both.
const HERO_PHOTOS = ["IMG_0161", "IMG_0350", "IMG_2108", "IMG_3098", "IMG_3151", "IMG_3633", "IMG_4294", "IMG_4311", "IMG_4312", "IMG_5354", "IMG_5381", "IMG_5382", "IMG_9350"];
// The cat data. Using the same file as the map and gallery means the landing page
// never needs updating by hand: when mvp_pipeline.ipynb adds a cat, it can show up here.
// The path starts with ../ because the data folder is next to site/, not inside it.
const DATA_URL = "../data/cat_photos.geojson"; // same file the map and gallery use
// How many cats to show after the gallery tile: 4 fit on a laptop screen without
// scrolling; on phones the row scrolls sideways.
const CATS_TO_SHOW = 4;

// Make text safe to put inside HTML.
// WHY: names and descriptions come from people's submissions (the Google Form).
// If someone typed something like "<script>" in a name, putting it straight into
// the page would run it as code. Setting it as plain text on a temporary element
// and reading back the HTML turns < > & into harmless symbols.
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";   // ?? "": treat a missing value as empty text
  return div.innerHTML;
}

// Turn a photo's file name into a short ID for links to the map.
// It must give exactly the same result as the function with the same name in app.js
// and gallery.js, so "map.html#cat=ID" opens that cat's popup on the map.
// Example: "20260427_123704 - Lukas Kramosch.jpg" → "20260427_123704_-_Lukas_Kramosch"
//   1. remove the extension (.jpg, .HEIC, ...)
//   2. replace anything that isn't a letter, digit, _ or - (spaces, accents...) with _
//      so the ID is safe to use in a web address
function catId(p) {
  return (p.photo || "").replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_-]/g, "_");
}

// Shuffle a copy of a list into random order (the Fisher–Yates shuffle).
// WHY THIS METHOD: the quick trick list.sort(() => Math.random() - 0.5) is not truly
// random (some orders come up much more often). Fisher–Yates gives every order the
// same chance: going from the end of the list to the start, it swaps each item with
// a random item at or before it.
// list.slice() makes a copy, so the original list isn't changed.
function shuffled(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];   // swap the two items
  }
  return a;
}


// ---------- 1. Second photo: any landing photo except the hero ----------
// window.HERO_PICK was set by the script in index.html's <head>. Removing it from
// the list first means the "why" photo is never the same as the big one at the top.
const others = HERO_PHOTOS.filter(p => p !== window.HERO_PICK);
// Pick one of the remaining photos at random
const second = others[Math.floor(Math.random() * others.length)];
// Set it as the box's background image (landing.css sizes and crops it with "cover")
document.getElementById("why-photo").style.backgroundImage = `url('landing/${second}.jpg')`;


// ---------- 2. Cat row ----------
// The row already contains the gallery tile (written in index.html); the cats are added after it.
const row = document.getElementById("cat-row");

// Load the map data. fetch() downloads the file in the background, then each
// .then() step runs once the previous one is done.
fetch(DATA_URL)
  // Stop if the file didn't load (e.g. 404 not found), so we jump to .catch() below
  .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then(data => {
    // Each map point is a "feature"; its details (photo, name, ...) are in "properties".
    // Only keep cats that have a web photo, since a card without a picture would look broken.
    const cats = data.features.map(f => f.properties).filter(p => p.image);
    // Prefer cats with a real name; top up with unnamed ones if there aren't enough.
    // WHY: a name ("Soldier", "Holly", "Grat / Tornade") makes a cat feel like a
    // character you could go and meet, which is the point of the page. Most cats
    // don't have one yet, so named cats are shuffled and placed first, then unnamed
    // cats fill any empty spots. "Cat sighting" is a placeholder name, so it counts as unnamed.
    const named = shuffled(cats.filter(p => p.name && p.name !== "Cat sighting"));
    const unnamed = shuffled(cats.filter(p => !p.name || p.name === "Cat sighting"));
    const pick = named.concat(unnamed).slice(0, CATS_TO_SHOW);

    // Build one card per chosen cat (styled by .cat-card in landing.css)
    pick.forEach(p => {
      const hasName = p.name && p.name !== "Cat sighting";
      const a = document.createElement("a");   // the whole card is one link
      a.className = "cat-card";
      // Clicking a card opens the map on that cat's popup (app.js reads the #cat= part)
      a.href = `map.html#cat=${catId(p)}`;
      // The card's contents: photo, name, and a hint that it leads to the map.
      //  - alt="": the photo is decorative here, because the name next to it already
      //    tells screen-reader users which cat it is
      //  - loading="lazy": the browser waits to download the photo until it is
      //    almost on screen, which makes the page load faster
      //  - every value from the data goes through escapeHtml() (see above)
      a.innerHTML = `
        <span class="cat-img"><img src="${escapeHtml(p.image)}" alt="" loading="lazy"></span>
        <span class="cat-name">${escapeHtml(hasName ? p.name : "A cat sighting")}</span>
        <span class="cat-meta">Find on the map →</span>`;
      row.appendChild(a);
    });
  })
  .catch(() => {
    // No data (e.g. opened without Live Server): the gallery tile alone still works.
    // WHY IT FAILS: browsers block fetch() for pages opened straight from a file
    // (file://...), so the site has to be opened through Live Server or GitHub Pages.
    // Nothing is shown on purpose: an error message would look worse on a landing
    // page than a row with only the gallery tile.
  });
