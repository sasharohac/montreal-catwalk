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
   Every changed line is marked CHANGED.
*/

function geog464StorageKey(kind) {
  // Each page folder gets its own key, so two projects on one github.io site do not share memory.
  return "geog464-" + kind + ":" + location.pathname.replace(/[^/]*$/, "");
}

function geog464Load(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v === null ? fallback : v; }
  catch (e) { return fallback; }
}

function geog464Save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch (e) { return false; }   // some private windows block storage
}

// ---------- 1. A saved view ----------
function rememberView(map) {
  const key = geog464StorageKey("view");
  const home = { center: map.getCenter(), zoom: map.getZoom() };   // the view your code set
  const saved = geog464Load(key, null);
  if (saved && typeof saved.lat === "number" && typeof saved.lng === "number" && typeof saved.zoom === "number") {
    map.setView([saved.lat, saved.lng], saved.zoom);                // reopen where the reader left it
  }
  map.on("moveend", () => {
    const c = map.getCenter();
    geog464Save(key, { lat: Math.round(c.lat * 1e5) / 1e5, lng: Math.round(c.lng * 1e5) / 1e5, zoom: map.getZoom() });
  });
  const Reset = L.Control.extend({
    onAdd() {
      const b = L.DomUtil.create("button", "geog464-reset");
      b.type = "button"; b.textContent = "Reset view";
      b.style.cssText = "background:#fff;border:2px solid rgba(0,0,0,.25);border-radius:6px;padding:6px 10px;font:14px Arial,sans-serif;cursor:pointer";
      L.DomEvent.disableClickPropagation(b);
      b.addEventListener("click", () => map.setView(home.center, home.zoom));
      return b;
    }
  });
  new Reset({ position: "topleft" }).addTo(map);
}

// ---------- 2. Favourites or progress ----------
function rememberMarks(map, layer, options) {
  const o = Object.assign({ idField: "name", nameField: null, mode: "favourites", title: null, position: "topright",
                            panel: true, onChange: null }, options || {});   // CHANGED: + panel, onChange
  const progress = o.mode === "progress";
  const nameField = o.nameField || o.idField;
  const key = geog464StorageKey(progress ? "progress" : "favourites");
  const btnClass = "geog464-mark-" + (progress ? "progress" : "favourites");   // CHANGED: one class per mode
  let marked = geog464Load(key, []);
  if (!Array.isArray(marked)) marked = [];

  // Find every feature in the layer, by its id.
  const byId = {};
  layer.eachLayer((f) => {
    const p = (f.feature && f.feature.properties) || {};
    const id = p[o.idField];
    if (id !== undefined && id !== null) byId[String(id)] = f;
  });
  const total = Object.keys(byId).length;
  if (total === 0) console.warn("rememberMarks: no features have the property '" + o.idField + "'. Check idField.");

  // The panel: a list of what the reader marked.
  const Panel = L.Control.extend({
    onAdd() {
      const box = L.DomUtil.create("div", "geog464-marks");
      box.style.cssText = "background:#fff;padding:8px 10px;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.35);font:14px Arial,sans-serif;max-width:230px;max-height:40vh;overflow:auto";
      L.DomEvent.disableClickPropagation(box);
      L.DomEvent.disableScrollPropagation(box);
      return box;
    }
  });
  const panel = o.panel ? new Panel({ position: o.position }).addTo(map).getContainer() : null;   // CHANGED: only if wanted

  function label(id) {
    const f = byId[id];
    const p = (f && f.feature && f.feature.properties) || {};
    return String(p[nameField] !== undefined ? p[nameField] : id);
  }

  function drawPanel() {
    if (!panel) return;   // CHANGED: no panel to draw
    panel.textContent = "";
    const h = document.createElement("strong");
    h.textContent = o.title || (progress ? "Progress" : "My places");
    const status = document.createElement("div");
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
        ev.preventDefault();
        const f = byId[id];
        const ll = f.getLatLng ? f.getLatLng() : f.getBounds().getCenter();
        map.setView(ll, Math.max(map.getZoom(), 15));
        if (f.openPopup) f.openPopup();
      });
      li.append(a); ul.append(li);
    }
    panel.append(h, status, ul);
  }

  function toggle(id) {
    const before = marked;
    marked = marked.includes(id) ? marked.filter((x) => x !== id) : marked.concat([id]);
    if (!geog464Save(key, marked)) { marked = before; alertBox("This browser would not save it (private window?)"); }
    drawPanel();
    document.querySelectorAll("." + btnClass).forEach((b) => b.geog464Set && b.geog464Set());   // CHANGED: an open popup's button follows along
    if (o.onChange) o.onChange(marked.slice());                                                   // CHANGED: tell app.js
  }

  function alertBox(text) {
    if (panel) panel.querySelector('[role="status"]').textContent = text;
    else console.warn("rememberMarks: " + text);   // CHANGED: no panel to write in
  }

  // Add a button to each popup when it opens, so your own popup content stays as it is.
  layer.on("popupopen", (e) => {
    const f = e.layer || e.propagatedFrom;
    const p = (f && f.feature && f.feature.properties) || {};
    const id = p[o.idField];
    if (id === undefined || id === null) return;
    const content = e.popup.getElement() && e.popup.getElement().querySelector(".leaflet-popup-content");
    if (!content) return;
    const old = content.querySelector("." + btnClass); if (old) old.remove();   // CHANGED: only this mode's button
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "geog464-mark-btn " + btnClass; btn.style.cssText = "display:block;margin-top:6px;cursor:pointer";   // CHANGED: + btnClass
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
  return { get marked() { return marked.slice(); }, total,   // handy for testing
           toggle: (id) => toggle(String(id)),                // CHANGED: mark or unmark one from app.js
           has: (id) => marked.includes(String(id)) };        // CHANGED: is this one marked?
}
