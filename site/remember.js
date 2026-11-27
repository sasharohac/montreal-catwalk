/* GEOG 464 remember.js: two more ways for your Leaflet map to remember something for its reader.
   (c) 2026 Luke Russell. All rights reserved. Students may copy and adapt it for GEOG 464.
   Both are "personal": they save in the reader's own browser (localStorage), survive a reload,
   and nobody else sees them. (For points or notes readers add, use memory.js from Module 10.)

   1. rememberView(map)
      The map reopens where the reader left it: same place and zoom. Adds a small "Reset view" button.
      Put it right after the line that makes your map:
        <script src="remember.js"></script>
        <script>rememberView(map);</script>

   2. rememberMarks(map, layer, options)
      Readers can mark features from YOUR data: favourites ("Save to My places") or progress
      ("Mark as visited"). A panel lists what they marked; it survives a reload.
      Call it where your GeoJSON layer exists, usually inside your fetch(...).then(...):
        const placesLayer = L.geoJSON(data, {...}).addTo(map);
        rememberMarks(map, placesLayer, { idField: "name", nameField: "name" });
      Options (all optional):
        idField     the property that is different for every feature (default "name")
        nameField   the property to show in the list (default: the same as idField)
        mode        "favourites" (default) or "progress"
        title       the panel's title (default "My places", or "Progress" in progress mode)
        position    where the panel sits (default "topright")

   CHANGED FOR THE MONTRÉAL CATWALK: each mode's popup button has its own class
   (geog464-mark-favourites or geog464-mark-progress, as well as geog464-mark-btn), so calling
   rememberMarks twice on the same layer, once per mode, puts both buttons in the popup.
   In the original, the second call removed the first call's button. A saved or visited button
   also gets the class "is-on", so style.css can show it filled in.
   Two more options, so app.js can draw its own "My cats" list instead of the kit's panels:
     panel      false = don't draw the panel (default true)
     onChange   a function called with the marked ids whenever the reader marks or unmarks one
   and the object it returns also has toggle(id) and has(id), to mark or check one from app.js.
   Each change starts from what's saved at that moment, and a change made in another tab (the
   gallery's ♡ Save buttons write to the same list) shows up straight away.
   Every changed line is marked CHANGED.

   ------------------------------------------------------------
   HOW THE MONTRÉAL CATWALK USES THIS FILE (notes added for the project)
   ------------------------------------------------------------
   WHY: the map is meant to be used over many walks, not just once. The reader needs a
   way to keep a list of cats they want to go and see ("My cats") and tick off the
   ones they've met, without making an account and without me running a server.
   localStorage does exactly that: a small storage space in the reader's own browser,
   kept after a reload or after closing the browser, private to that reader.

   WHAT IS USED:
     - rememberMarks() is called TWICE on the cat layer in app.js (setUpMyCats):
         1. mode "favourites", title "My cats"  → the "Save to My cats" button, which
            puts a cat on the reader's list (its pin turns dark pink)
         2. mode "progress"                     → the "Mark as visited" button, which
            marks a cat as met (its pin turns light pink)
       Both use idField "photo": each cat's photo file name is unique, while names are
       not (many cats have no name), so the file name is the safe id.
       Both use panel: false, because app.js draws one combined "My cats" box
       ("2 of 5 met") instead of two separate panels from this file.
       onChange tells app.js to redraw that box and recolour the pins.
     - gallery.js uses the three small helpers (geog464StorageKey, geog464Load,
       geog464Save) for its ♡ Save buttons. It writes to the SAME "favourites" list,
       so a cat saved in the gallery appears in My cats on the map.
     - app.js also uses the helpers to remember whether the My cats box is open or folded.
     - The walk planner can aim for "My cats": the saved cats not met yet.
     - rememberView() is part of the kit but is NOT used on this site at the moment
       (no page calls it). It is kept in case it's useful later.

   WHAT IS SAVED (open the browser's developer tools → Application → Local Storage to see it):
     geog464-favourites:<folder>   the saved cats, e.g. ["IMG_1253.HEIC", "20230824_144856 - Lukas Kramosch.jpg"]
     geog464-progress:<folder>     the cats marked as met, in the same format
   <folder> is the site's folder in the web address, e.g. "/site/" with Live Server or
   "/montreal-catwalk/site/" on GitHub Pages (see geog464StorageKey below). So a list made
   while testing locally is separate from the list on the live site.
*/


// ============================================================
// SMALL HELPERS (also used by app.js and gallery.js)
// ============================================================

// Build the name a list is saved under, for example "geog464-favourites:/montreal-catwalk/site/".
// kind = what is saved ("view", "favourites", "progress", ...).
// location.pathname is the page's address without the website part, e.g.
// "/montreal-catwalk/site/map.html"; the replace() removes the file name at the end
// (everything after the last "/"), leaving only the folder.
// WHY THE FOLDER: map.html and gallery.html are in the same folder, so they get the
// same name and share one list. That is how saving a cat in the gallery shows it on the map.
function geog464StorageKey(kind) {
  // Each page folder gets its own key, so two projects on one github.io site do not share memory.
  return "geog464-" + kind + ":" + location.pathname.replace(/[^/]*$/, "");
}

// Read a saved value. localStorage can only hold text, so values are saved as JSON
// text (e.g. '["a","b"]') and turned back into real lists/objects here with JSON.parse.
// `fallback` is returned when nothing is saved yet (getItem gives null) or when reading fails
// (storage blocked, or the text was damaged and isn't valid JSON), so the map never
// crashes because of storage: at worst it starts with an empty list.
function geog464Load(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v === null ? fallback : v; }
  catch (e) { return fallback; }
}

// Save a value as JSON text. Returns true if it worked, false if the browser refused
// (private windows, storage full or turned off), so the caller can tell the reader.
function geog464Save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch (e) { return false; }   // some private windows block storage
}


// ---------- 1. A saved view ----------
// (Not used on the CatWalk at the moment, see the notes at the top.)
// Saves the map's centre and zoom every time the reader stops moving it, and goes
// back there on the next visit. A "Reset view" button returns to the starting view.
function rememberView(map) {
  const key = geog464StorageKey("view");
  const home = { center: map.getCenter(), zoom: map.getZoom() };   // the view your code set
  const saved = geog464Load(key, null);
  // Only use the saved view if it looks right (three numbers), in case it's damaged or old
  if (saved && typeof saved.lat === "number" && typeof saved.lng === "number" && typeof saved.zoom === "number") {
    map.setView([saved.lat, saved.lng], saved.zoom);                // reopen where the reader left it
  }
  // "moveend" fires once when the reader stops dragging or zooming (not on every small
  // movement), so it saves only a few times. Coordinates are rounded to 5 decimals
  // (about 1 m), which is plenty and keeps the saved text short.
  map.on("moveend", () => {
    const c = map.getCenter();
    geog464Save(key, { lat: Math.round(c.lat * 1e5) / 1e5, lng: Math.round(c.lng * 1e5) / 1e5, zoom: map.getZoom() });
  });
  // The "Reset view" button, made as a Leaflet control so it sits in the map's corner
  // like the zoom buttons. Its look is set inline so it works without any CSS file.
  const Reset = L.Control.extend({
    onAdd() {
      const b = L.DomUtil.create("button", "geog464-reset");
      b.type = "button"; b.textContent = "Reset view";
      b.style.cssText = "background:#fff;border:2px solid rgba(0,0,0,.25);border-radius:6px;padding:6px 10px;font:14px Arial,sans-serif;cursor:pointer";
      // Stops a click on the button from also counting as a click on the map underneath
      L.DomEvent.disableClickPropagation(b);
      b.addEventListener("click", () => map.setView(home.center, home.zoom));
      return b;
    }
  });
  new Reset({ position: "topleft" }).addTo(map);
}


// ---------- 2. Favourites or progress ----------
// On the CatWalk this makes the two lists behind "My cats" (see the notes at the top).
// What it does:
//   - adds a button to each cat's popup ("Save to My cats" / "Mark as visited")
//   - keeps the list of marked cats in localStorage
//   - (optionally) shows a panel listing them; the CatWalk turns this off
//   - returns an object app.js can use: .marked (the list), .toggle(id), .has(id)
function rememberMarks(map, layer, options) {
  // Default settings, replaced by whatever the caller passes in `options`.
  // Object.assign copies the caller's options on top of the defaults.
  const o = Object.assign({ idField: "name", nameField: null, mode: "favourites", title: null, position: "topright",
                            panel: true, onChange: null }, options || {});   // CHANGED: + panel, onChange
  const progress = o.mode === "progress";        // true for "Mark as visited", false for "Save"
  const nameField = o.nameField || o.idField;    // what to show in the list (CatWalk: the cat's name)
  // Each mode is saved under its own name, so "saved" and "met" are two separate lists
  const key = geog464StorageKey(progress ? "progress" : "favourites");
  const btnClass = "geog464-mark-" + (progress ? "progress" : "favourites");   // CHANGED: one class per mode
  // The ids currently marked, loaded from last time (an empty list on a first visit).
  // The Array.isArray check guards against anything saved that isn't a list.
  let marked = geog464Load(key, []);
  if (!Array.isArray(marked)) marked = [];

  // Find every feature in the layer, by its id.
  // byId is a lookup table: id → the marker on the map, so a list entry can quickly
  // find its marker (to zoom to it or open its popup). Ids are turned into text with
  // String() so the number 12 and the text "12" count as the same id.
  const byId = {};
  layer.eachLayer((f) => {
    const p = (f.feature && f.feature.properties) || {};
    const id = p[o.idField];
    if (id !== undefined && id !== null) byId[String(id)] = f;
  });
  const total = Object.keys(byId).length;   // how many features can be marked ("x of TOTAL visited")
  // A helpful message in the console if the idField is misspelled and nothing matches
  if (total === 0) console.warn("rememberMarks: no features have the property '" + o.idField + "'. Check idField.");

  // The panel: a list of what the reader marked.
  // (The CatWalk passes panel: false, so this box is never made there; app.js has its own.)
  const Panel = L.Control.extend({
    onAdd() {
      const box = L.DomUtil.create("div", "geog464-marks");
      box.style.cssText = "background:#fff;padding:8px 10px;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.35);font:14px Arial,sans-serif;max-width:230px;max-height:40vh;overflow:auto";
      // Clicking or scrolling inside the panel shouldn't also click or zoom the map behind it
      L.DomEvent.disableClickPropagation(box);
      L.DomEvent.disableScrollPropagation(box);
      return box;
    }
  });
  const panel = o.panel ? new Panel({ position: o.position }).addTo(map).getContainer() : null;   // CHANGED: only if wanted

  // The text to show for one id: its name if it has one, otherwise the id itself
  function label(id) {
    const f = byId[id];
    const p = (f && f.feature && f.feature.properties) || {};
    return String(p[nameField] !== undefined ? p[nameField] : id);
  }

  // Redraw the panel from scratch: a title, a status line ("3 of 120 visited" or
  // "2 saved"), then one link per marked feature. Clicking a link zooms to it.
  function drawPanel() {
    if (!panel) return;   // CHANGED: no panel to draw
    panel.textContent = "";   // empty the panel first
    const h = document.createElement("strong");
    h.textContent = o.title || (progress ? "Progress" : "My places");
    const status = document.createElement("div");
    // role="status": screen readers announce changes to this line (e.g. "3 saved")
    status.setAttribute("role", "status");
    status.style.margin = "4px 0";
    status.textContent = progress ? (marked.length + " of " + total + " visited")
                                  : (marked.length ? marked.length + " saved" : "Open a place and press Save to add it here");
    const ul = document.createElement("ul");
    ul.style.cssText = "margin:0;padding-left:18px";
    for (const id of marked) {
      if (!byId[id]) continue;   // a feature that is no longer in your data
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = "#"; a.textContent = label(id);                 // shown as text, never as code
      a.addEventListener("click", (ev) => {
        ev.preventDefault();   // stop the "#" link from jumping to the top of the page
        const f = byId[id];
        // A point has one position (getLatLng); a line or area uses the centre of its outline
        const ll = f.getLatLng ? f.getLatLng() : f.getBounds().getCenter();
        // Zoom in to at least level 15 (street level), but don't zoom OUT if already closer
        map.setView(ll, Math.max(map.getZoom(), 15));
        if (f.openPopup) f.openPopup();
      });
      li.append(a); ul.append(li);
    }
    panel.append(h, status, ul);
  }

  // Mark or unmark one id: add it if it isn't in the list, remove it if it is.
  function toggle(id) {
    // Re-read the list first instead of trusting the copy in memory: the gallery (in
    // another tab) may have saved cats since this page loaded, and saving the old copy
    // would wipe them out.
    marked = geog464Load(key, marked); if (!Array.isArray(marked)) marked = [];   // CHANGED: start from what's saved now (the gallery may have added some)
    const before = marked;   // kept so the change can be undone if saving fails
    // filter() makes a list without this id; concat() makes a list with it added
    marked = marked.includes(id) ? marked.filter((x) => x !== id) : marked.concat([id]);
    // If the browser refuses to save, go back to the old list and tell the reader,
    // instead of pretending it worked and losing it on the next reload
    if (!geog464Save(key, marked)) { marked = before; alertBox("This browser would not save it (private window?)"); }
    changed();
  }

  // CHANGED: after any change, redraw the panel, update an open popup's button and tell app.js
  // (this is what makes a pin change colour and the My cats box update straight away)
  function changed() {
    drawPanel();
    // Every popup button of this mode on the page refreshes its own label ("Save" ↔ "Saved")
    document.querySelectorAll("." + btnClass).forEach((b) => b.geog464Set && b.geog464Set());
    // marked.slice() hands over a copy, so app.js can't change this file's list by accident
    if (o.onChange) o.onChange(marked.slice());
  }

  // CHANGED: another tab of this site (the gallery, say) changed this list: pick it up straight away
  // The browser fires a "storage" event in every OTHER open tab of the same site whenever
  // localStorage changes. So if the reader has the map and the gallery open side by side,
  // saving a cat in the gallery turns its pin pink on the map without a reload.
  window.addEventListener("storage", (e) => {
    if (e.key !== key) return;   // a different saved value changed: not this list, ignore it
    marked = geog464Load(key, []); if (!Array.isArray(marked)) marked = [];
    changed();
  });

  // Show a short message: in the panel's status line, or in the console when there is no panel
  function alertBox(text) {
    if (panel) panel.querySelector('[role="status"]').textContent = text;
    else console.warn("rememberMarks: " + text);   // CHANGED: no panel to write in
  }

  // Add a button to each popup when it opens, so your own popup content stays as it is.
  // WHY ON OPEN: app.js builds the cat popups (photo, name, description). Adding the button
  // here, each time a popup opens, means this file never needs to know how those popups
  // are made, and the button always shows the current state (saved or not).
  layer.on("popupopen", (e) => {
    // Which marker's popup opened (Leaflet stores it under one of these two names)
    const f = e.layer || e.propagatedFrom;
    const p = (f && f.feature && f.feature.properties) || {};
    const id = p[o.idField];
    if (id === undefined || id === null) return;   // nothing to mark this feature by
    // The inside of the popup, where the button goes
    const content = e.popup.getElement() && e.popup.getElement().querySelector(".leaflet-popup-content");
    if (!content) return;
    // Remove this mode's button from the last time the popup was opened, so there's never two
    const old = content.querySelector("." + btnClass); if (old) old.remove();   // CHANGED: only this mode's button
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "geog464-mark-btn " + btnClass; btn.style.cssText = "display:block;margin-top:6px;cursor:pointer";   // CHANGED: + btnClass
    // set() updates the button's words to match the list. On the CatWalk:
    //   favourites: "Save to My cats" ↔ "Saved (remove)"
    //   progress:   "Mark as visited" ↔ "Visited (undo)"
    // The words say what pressing it will do, so the reader can always undo a click.
    const set = () => {
      const on = marked.includes(String(id));
      btn.textContent = progress ? (on ? "Visited (undo)" : "Mark as visited") : (on ? "Saved (remove)" : "Save to " + (o.title || "My places"));
      btn.classList.toggle("is-on", on);   // CHANGED: so style.css can colour a saved / visited button
    };
    btn.addEventListener("click", () => { toggle(String(id)); set(); });
    btn.geog464Set = set;   // CHANGED: so toggle() can update this button when the mark changes elsewhere
    set();
    content.append(btn);   // (no popup.update(): that would redraw the popup and remove the button)
  });

  drawPanel();
  // What app.js gets back. "get marked()" means reading .marked always gives a fresh copy
  // of the current list. app.js uses .has(id) to colour each pin and .toggle(id) for the
  // tick boxes in its My cats box.
  return { get marked() { return marked.slice(); }, total,   // handy for testing
           toggle: (id) => toggle(String(id)),                // CHANGED: mark or unmark one from app.js
           has: (id) => marked.includes(String(id)) };        // CHANGED: is this one marked?
}
