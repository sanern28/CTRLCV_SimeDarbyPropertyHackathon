/* =========================================================
   SmartWaste front-end (no-server version: talks to LocalAPI in db.js)
   ========================================================= */
var SW = window.SW || { materials: [], centers: [], categories: {} };

// ---------- helpers ----------
function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
}
function rm(n) { return 'RM ' + (Number(n) || 0).toFixed(2); }
function $(sel, root) { return (root || document).querySelector(sel); }
function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

function api(url, data) {
    var body = data instanceof FormData ? data : new FormData();
    if (!(data instanceof FormData) && data) {
        Object.keys(data).forEach(function (k) { body.append(k, data[k]); });
    }
    return LocalAPI(url, body);
}

function showToast(message, type) {
    var t = document.getElementById('toast');
    var icon = type === 'error' ? 'fa-circle-exclamation' : type === 'success' ? 'fa-circle-check' : 'fa-circle-info';
    t.className = 'toast ' + (type || '');
    t.innerHTML = '<i class="fas ' + icon + '"></i><span>' + esc(message) + '</span>';
    // force reflow so the animation restarts
    void t.offsetWidth;
    t.classList.add('show');
    clearTimeout(t._timeout);
    t._timeout = setTimeout(function () { t.classList.remove('show'); }, 3200);
}

function copyText(text) {
    var done = function () { showToast('Copied: ' + text, 'success'); };
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    } else { fallbackCopy(text); done(); }
}
function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    ta.remove();
}

// ---------- modals ----------
function openModal(html, opts) {
    var modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = '<div class="modal-content" role="dialog" aria-modal="true">' + html + '</div>';
    modal.addEventListener('click', function (e) {
        if (e.target === modal && !(opts && opts.sticky)) closeModal(modal);
    });
    $all('[data-close]', modal).forEach(function (b) { b.addEventListener('click', function () { closeModal(modal); }); });
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    return modal;
}
function closeModal(modal) {
    if (!modal) modal = $('.modal:last-of-type');
    if (modal) modal.remove();
    if (!$('.modal')) document.body.style.overflow = '';
}
function modalHead(icon, title, sub, danger) {
    return '<div class="modal-head"><span class="modal-icon' + (danger ? ' danger' : '') + '"><i class="fas ' + icon + '"></i></span>' +
        '<div><h3>' + esc(title) + '</h3>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' +
        '<button class="icon-btn" data-close aria-label="Close"><i class="fas fa-xmark"></i></button></div>';
}
function askConfirm(o) {
    return new Promise(function (resolve) {
        var m = openModal(modalHead(o.icon || (o.danger ? 'fa-triangle-exclamation' : 'fa-circle-question'), o.title, '', o.danger) +
            '<p class="muted">' + o.message + '</p>' +
            '<div class="btn-row"><button class="btn btn-ghost" data-close>Cancel</button>' +
            '<button class="btn ' + (o.danger ? 'btn-danger' : 'btn-primary') + '" id="cfmOk">' + esc(o.ok || 'OK') + '</button></div>');
        m.querySelector('#cfmOk').addEventListener('click', function () { closeModal(m); resolve(true); });
        $all('[data-close]', m).forEach(function (b) { b.addEventListener('click', function () { resolve(false); }); });
    });
}
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        if ($('.modal')) closeModal();
        else if ($('#chatPanel.open')) closeChat();
        else $('#notifPanel') && $('#notifPanel').classList.remove('open');
    }
});

// =========================================================
// NAVIGATION
// =========================================================
function showPage(name, noHistory) {
    var page = document.getElementById(name);
    if (!page) return;
    $all('.page').forEach(function (p) { p.classList.remove('active'); });
    page.classList.add('active');
    $all('[data-page]').forEach(function (b) { b.classList.toggle('active', b.dataset.page === name); });
    var title = $('#topbarTitle');
    if (title) title.textContent = page.dataset.title || '';
    window.scrollTo(0, 0);
    if (!noHistory) SWApp.setHash(name);
    if (name === 'locator') onMapPageShown();
    if (name === 'home' && homeMap) setTimeout(function () { homeMap.invalidateSize(); }, 150);
}

function switchPickupTab(tab) {
    $all('.tabs .tab').forEach(function (t) { t.classList.toggle('active', t.dataset.tab === tab); });
    $all('.tab-panel').forEach(function (p) { p.classList.toggle('active', p.id === 'tab-' + tab); });
}

// =========================================================
// THEME
// =========================================================
function applyThemeIcon() {
    var dark = document.documentElement.dataset.theme === 'dark';
    var icon = $('#themeIcon');
    if (icon) icon.className = 'fas ' + (dark ? 'fa-sun' : 'fa-moon');
    var toggle = $('#darkToggle');
    if (toggle) toggle.checked = dark;
}
function toggleTheme() {
    var dark = document.documentElement.dataset.theme !== 'dark';
    if (dark) document.documentElement.dataset.theme = 'dark';
    else delete document.documentElement.dataset.theme;
    try { localStorage.setItem('sw-theme', dark ? 'dark' : 'light'); } catch (e) {}
    applyThemeIcon();
    if (typeof refreshTiles === 'function') refreshTiles();
}

// =========================================================
// NOTIFICATIONS
// =========================================================
function toggleNotifs(e) {
    if (e) e.stopPropagation();
    var p = $('#notifPanel');
    if (!p) return;
    p.classList.toggle('open');
}
document.addEventListener('click', function (e) {
    var p = $('#notifPanel');
    if (p && p.classList.contains('open') && !p.contains(e.target)) p.classList.remove('open');
});
function updateBadge(delta) {
    var b = $('#notifBadge');
    if (!b) return;
    var n = Math.max(0, (parseInt(b.textContent, 10) || 0) + delta);
    if (n === 0) b.remove(); else b.textContent = n;
}
function openNotif(el) {
    if (el.classList.contains('unread')) {
        el.classList.remove('unread');
        updateBadge(-1);
        api('mark_read.php', { notification_id: el.dataset.id });
    }
    var link = el.dataset.link;
    if (link) SWApp.openLink(link);
}
function markRead(id) { api('mark_read.php', { notification_id: id }); }
function markAllRead() {
    api('mark_read.php', { all: '1' }).then(function () {
        $all('.notif.unread').forEach(function (n) { n.classList.remove('unread'); });
        var b = $('#notifBadge'); if (b) b.remove();
        showToast('All notifications marked as read', 'success');
    });
}

// =========================================================
// PRICES
// =========================================================
var activeCat = 'all';
function setCat(btn) {
    activeCat = btn.dataset.cat;
    $all('#catChips [data-cat]').forEach(function (b) { b.classList.toggle('active', b === btn); });
    filterPrices();
}
function filterPrices() {
    var q = ($('#priceSearch').value || '').trim().toLowerCase();
    var sort = $('#priceSort').value;
    var list = $('#priceList');
    var rows = $all('.price-row', list);
    var shown = 0;
    rows.forEach(function (r) {
        var ok = (activeCat === 'all' || r.dataset.cat === activeCat) && (!q || r.dataset.search.indexOf(q) !== -1 || aliasMatch(q, r.dataset.search));
        r.hidden = !ok;
        if (ok) shown++;
    });
    rows.sort(function (a, b) {
        if (sort === 'az') return a.dataset.name.localeCompare(b.dataset.name);
        var d = parseFloat(b.dataset.price) - parseFloat(a.dataset.price);
        return sort === 'low' ? -d : d;
    }).forEach(function (r) { list.insertBefore(r, $('#priceEmpty')); });
    $('#priceEmpty').hidden = shown > 0;
}
// Malay / everyday words -> material keywords
var PRICE_ALIASES = {
    'tin': 'can', 'botol': 'bottle', 'kotak': 'cardboard', 'kertas': 'paper', 'surat khabar': 'newspaper', 'akhbar': 'newspaper',
    'tembaga': 'copper', 'besi': 'iron', 'kaca': 'glass', 'bateri': 'batter', 'minyak': 'oil', 'baju': 'clothes', 'pakaian': 'clothes',
    'kasut': 'shoes', 'plastik': 'plastic', 'loyang': 'brass', 'wayar': 'cable', 'kabel': 'cable', 'telefon': 'phone',
    'handphone': 'phone', 'aluminum': 'aluminium', 'styrofoam': 'polystyrene', 'box': 'cardboard', 'wire': 'copper'
};
function aliasMatch(q, text) {
    for (var k in PRICE_ALIASES) {
        if (q.indexOf(k) !== -1 && text.indexOf(PRICE_ALIASES[k]) !== -1) return true;
    }
    return false;
}

function materialById(id) {
    id = Number(id);
    for (var i = 0; i < SW.materials.length; i++) if (SW.materials[i].id === id) return SW.materials[i];
    return null;
}
function materialOptions(selected) {
    var groups = {};
    SW.materials.forEach(function (m) { (groups[m.category] = groups[m.category] || []).push(m); });
    var html = '<option value="">Choose material...</option>';
    Object.keys(groups).forEach(function (cat) {
        html += '<optgroup label="' + esc(SW.categories[cat] || cat) + '">';
        groups[cat].forEach(function (m) {
            html += '<option value="' + m.id + '"' + (Number(selected) === m.id ? ' selected' : '') + '>' + esc(m.name) + ' (' + rm(m.price) + '/kg)</option>';
        });
        html += '</optgroup>';
    });
    return html;
}

// ---- calculator ----
var calcItems = [];
function addToCalc(id) {
    var empty = calcItems.filter(function (it) { return !it.id && !it.kg; })[0];
    if (id && empty) { empty.id = id; empty.kg = 1; }
    else calcItems.push({ id: id || '', kg: id ? 1 : '' });
    renderCalc();
    if (id) {
        showToast((materialById(id) || {}).name + ' added to calculator', 'success');
        if (window.innerWidth < 960) $('#calcCard').scrollIntoView({ behavior: 'smooth' });
    }
}
function renderCalc() {
    var wrap = $('#calcRows');
    if (!wrap) return;
    if (!calcItems.length) calcItems.push({ id: '', kg: '' });
    wrap.innerHTML = calcItems.map(function (it, i) {
        return '<div class="calc-row">' +
            '<select onchange="calcItems[' + i + '].id=this.value;calcTotals()" aria-label="Material">' + materialOptions(it.id) + '</select>' +
            '<input type="number" min="0" step="0.1" placeholder="kg" value="' + esc(it.kg) + '" oninput="calcItems[' + i + '].kg=this.value;calcTotals()" aria-label="Weight in kg">' +
            '<button class="icon-btn small" onclick="calcItems.splice(' + i + ',1);renderCalc()" aria-label="Remove"><i class="fas fa-xmark"></i></button>' +
            '<div class="calc-val" id="calcVal' + i + '"></div></div>';
    }).join('');
    calcTotals();
}
function calcTotals() {
    var tot = 0, lo = 0, hi = 0, kg = 0;
    calcItems.forEach(function (it, i) {
        var m = materialById(it.id), w = parseFloat(it.kg) || 0;
        var el = document.getElementById('calcVal' + i);
        if (m && w > 0) {
            tot += w * m.price; lo += w * m.min; hi += w * m.max; kg += w;
            if (el) el.textContent = w + ' kg x ' + rm(m.price) + ' = ' + rm(w * m.price);
        } else if (el) el.textContent = '';
    });
    $('#calcTotal').textContent = rm(tot);
    $('#calcRange').textContent = rm(lo) + ' - ' + hi.toFixed(2);
    var fee = deliveryCost(kg);
    $('#calcNote').textContent = kg > 0 ? 'Total ' + kg.toFixed(1) + ' kg. Delivering alone would cost ' + rm(fee) + '; in a group of 4 your share would be roughly ' + rm(fee / 4) + '.' : '';
}
function deliveryCost(kg) { return SW.fee.base + Math.max(0, (kg - SW.fee.freeKg) * SW.fee.perKg); }
function calcToGroup() {
    var bags = calcItems.filter(function (it) { return materialById(it.id) && parseFloat(it.kg) > 0; })
        .map(function (it) { return { material_id: Number(it.id), weight: parseFloat(it.kg) }; });
    if (!bags.length) { showToast('Add at least one material with a weight first', 'error'); return; }
    createGroupPickup(bags);
}

// ---- admin price edit ----
function editPrice(id) {
    var m = materialById(id);
    if (!m) return;
    var modal = openModal(modalHead('fa-pen', 'Update price', esc(m.name)) +
        '<div class="form-error" id="peErr"></div>' +
        '<div class="form-row"><div class="form-group"><label>Min RM/kg</label><input class="form-control" type="number" step="0.01" id="peMin" value="' + m.min + '"></div>' +
        '<div class="form-group"><label>Max RM/kg</label><input class="form-control" type="number" step="0.01" id="peMax" value="' + m.max + '"></div></div>' +
        '<div class="form-group"><label>Typical RM/kg</label><input class="form-control" type="number" step="0.01" id="pePrice" value="' + m.price + '"><div class="hint">The change % is calculated automatically and saved to price history.</div></div>' +
        '<button class="btn btn-primary full" id="peSave"><i class="fas fa-floppy-disk"></i> Save price</button>');
    modal.querySelector('#peSave').onclick = function () {
        api('update_price.php', { material_id: id, price_min: $('#peMin', modal).value, price_max: $('#peMax', modal).value, price_per_kg: $('#pePrice', modal).value })
            .then(function (d) {
                if (d.success) { showToast('Price updated (' + (d.change_percent >= 0 ? '+' : '') + d.change_percent + '%)', 'success'); setTimeout(function () { reloadView(); }, 800); }
                else { var er = $('#peErr', modal); er.textContent = d.error; er.classList.add('show'); }
            });
    };
}

// =========================================================
// MAP + REAL LOCATION
// Uses the browser's GPS (navigator.geolocation). Works on http://localhost
// and on https sites. The last location is remembered in this browser only.
// =========================================================
var map = null, homeMap = null, userMarker = null, homeUserMarker = null, centerMarkers = {}, userPos = null;
var centerFilter = 'all';

function leafletReady() { return typeof L !== 'undefined'; }

function centerIcon(highlight) {
    return L.divIcon({
        className: '',
        html: '<div class="pin' + (highlight ? ' pin-hot' : '') + '"><i class="fas fa-recycle"></i></div>',
        iconSize: [34, 42], iconAnchor: [17, 40], popupAnchor: [0, -36]
    });
}
function youIcon() {
    return L.divIcon({ className: '', html: '<div class="you-dot"><span></span></div>', iconSize: [22, 22], iconAnchor: [11, 11] });
}
function centerPopup(c) {
    var d = userPos ? '<div class="pop-dist"><i class="fas fa-route"></i> ' + fmtDist(haversine(userPos.lat, userPos.lng, c.lat, c.lng)) + ' away</div>' : '';
    var open = openStatus(c.hours);
    return '<div class="pop"><strong>' + esc(c.name) + '</strong><div>' + esc(c.address) + '</div>' +
        '<div><span class="open-badge ' + open.cls + '">' + open.label + '</span> ' + esc(c.hours) + '</div>' + d +
        '<div class="pop-btns"><a target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=' + c.lat + ',' + c.lng + '">Directions</a>' +
        '<a href="tel:' + esc(c.phone) + '">Call</a></div></div>';
}
// Map pictures (tiles). Some tile servers refuse pages opened straight from a folder
// (openstreetmap.org answers "403 Access blocked"), and some networks block a server.
// So we try the free servers that work from a folder (Esri, OpenTopoMap) and switch automatically when one fails.
var TILE_SOURCES = [
    { name: 'Esri streets', light: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', dark: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      opts: { maxZoom: 19 }, attr: 'Tiles &copy; Esri' },
    { name: 'OpenTopoMap', light: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', dark: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      opts: { subdomains: 'abc', maxZoom: 17 }, attr: '&copy; OpenStreetMap &copy; OpenTopoMap' },
    { name: 'Esri satellite', light: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', dark: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      opts: { maxZoom: 19 }, attr: 'Imagery &copy; Esri' }
];
var tileIndex = 0, tileLayers = [], tileFails = 0, tileOk = false;
try { var savedTile = parseInt(localStorage.getItem('sw-map-source'), 10); if (savedTile >= 0 && savedTile < TILE_SOURCES.length) tileIndex = savedTile; } catch (e) {}
function tileUrl() {
    var src = TILE_SOURCES[tileIndex], dark = document.documentElement.dataset.theme === 'dark';
    return dark ? src.dark : src.light;
}
function tileLayer() {
    var src = TILE_SOURCES[tileIndex];
    var layer = L.tileLayer(tileUrl(), Object.assign({ attribution: src.attr }, src.opts));
    layer.on('tileload', function () { if (!tileOk) { tileOk = true; try { localStorage.setItem('sw-map-source', tileIndex); } catch (e) {} } });
    layer.on('tileerror', function () {
        if (tileOk) return;
        tileFails++;
        if (tileFails >= 4) nextTileSource();
    });
    tileLayers.push(layer);
    return layer;
}
function nextTileSource() {
    tileFails = 0;
    if (tileIndex >= TILE_SOURCES.length - 1) {
        var fb = $('#mapFallback');
        if (fb) { fb.hidden = false; fb.querySelector('span').textContent = 'The map pictures could not load on this network. The pins, distances and list still work.'; }
        return;
    }
    tileIndex++;
    var src = TILE_SOURCES[tileIndex];
    tileLayers.forEach(function (l) {
        l.options.attribution = src.attr; l.options.subdomains = src.opts.subdomains || 'abc'; l.options.maxZoom = src.opts.maxZoom;
        l.setUrl(tileUrl());
    });
}
// "Change map" button: some servers show an "API key required" or "Access blocked" picture
// instead of failing, so people can switch by hand.
function applyTileSource() {
    var src = TILE_SOURCES[tileIndex];
    tileLayers.forEach(function (l) {
        l.options.attribution = src.attr; l.options.subdomains = src.opts.subdomains || 'abc'; l.options.maxZoom = src.opts.maxZoom;
        l.setUrl(tileUrl());
    });
}
function nextMapStyle() {
    tileIndex = (tileIndex + 1) % TILE_SOURCES.length;
    tileFails = 0; tileOk = true;
    try { localStorage.setItem('sw-map-source', tileIndex); } catch (e) {}
    applyTileSource();
    var fb = $('#mapFallback'); if (fb) fb.hidden = true;
    showToast('Map: ' + TILE_SOURCES[tileIndex].name + ' (tap again to try another)', 'success');
}
function refreshTiles() { tileLayers.forEach(function (l) { l.setUrl(tileUrl()); }); }
function initMap() {
    if (map || !document.getElementById('map')) return;
    if (!leafletReady()) { var fb = $('#mapFallback'); if (fb) fb.hidden = false; return; }
    map = L.map('map', { center: [3.1390, 101.6869], zoom: 11, zoomControl: true });
    tileLayer().addTo(map);
    SW.centers.forEach(function (c) {
        centerMarkers[c.id] = L.marker([c.lat, c.lng], { icon: centerIcon(false) }).addTo(map).bindPopup(centerPopup(c));
    });
    if (userPos) showUserOnMap();
}
function initHomeMap() {
    var el = document.getElementById('homeMap');
    if (homeMap || !el || !leafletReady()) { if (el && !leafletReady()) el.hidden = true; return; }
    homeMap = L.map(el, { center: [3.1390, 101.6869], zoom: 11, zoomControl: false, attributionControl: false, scrollWheelZoom: false, dragging: !L.Browser.mobile });
    tileLayer().addTo(homeMap);
    SW.centers.forEach(function (c) { L.marker([c.lat, c.lng], { icon: centerIcon(false) }).addTo(homeMap).bindPopup(centerPopup(c)); });
}
function fitAllCenters() {
    initMap();
    if (!map) return;
    var pts = SW.centers.map(function (c) { return [c.lat, c.lng]; });
    if (userPos) pts.push([userPos.lat, userPos.lng]);
    map.fitBounds(pts, { padding: [30, 30] });
}
function focusCenter(id) {
    var c = SW.centers.filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    if (!$('#locator').classList.contains('active')) showPage('locator');
    initMap();
    if (!map) return;
    setTimeout(function () {
        map.invalidateSize();
        map.flyTo([c.lat, c.lng], 15, { duration: .8 });
        centerMarkers[c.id].openPopup();
        $('#map').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
}
function setBanner(cls, html) { var b = $('#locBanner'); if (b) { b.className = 'banner ' + cls; b.innerHTML = html; } }

/** Ask for the real GPS location. showErrors=true when the user pressed a button. */
function locateMe(showErrors, onDone) {
    if (!navigator.geolocation) {
        setBanner('error', '<i class="fas fa-circle-xmark"></i> <span>Location is not available here. <button class="link-btn" onclick="pickArea()">Choose your area instead</button></span>');
        if (showErrors) pickArea();
        return;
    }
    var btns = $all('#locBtn, #heroLoc');
    btns.forEach(function (b) { b.disabled = true; });
    setBanner('waiting', '<i class="fas fa-spinner fa-spin"></i> <span>Finding you... allow location access if your browser asks.</span>');
    navigator.geolocation.getCurrentPosition(function (pos) {
        btns.forEach(function (b) { b.disabled = false; });
        setUserPos(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, true);
        if (onDone) onDone();
    }, function (err) {
        btns.forEach(function (b) { b.disabled = false; });
        var msg = err.code === err.PERMISSION_DENIED
            ? 'Location is blocked. Click the lock/site icon next to the address bar, allow Location, then try again.'
            : err.code === err.TIMEOUT ? 'Finding your location took too long. Try again near a window or with Wi-Fi on.' : esc(err.message);
        setBanner('error', '<i class="fas fa-circle-xmark"></i> <span>' + msg + ' <button class="link-btn" onclick="pickArea()">Choose your area instead</button></span>');
        if (showErrors) { showToast(err.code === err.PERMISSION_DENIED ? 'Location permission denied - pick your area instead' : 'Could not get your location', 'error'); pickArea(); }
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
}
function getLocation() { initMap(); locateMe(true, function () { if (map) map.setView([userPos.lat, userPos.lng], 13); }); }

function setUserPos(lat, lng, acc, fresh) {
    userPos = { lat: lat, lng: lng, acc: acc || 0, t: Date.now() };
    try { localStorage.setItem('sw-loc', JSON.stringify(userPos)); } catch (e) {}
    setBanner('success', '<i class="fas fa-circle-check"></i> <span>' + (fresh ? 'Location found' : 'Using your last location') +
        (acc ? ' (accurate to ~' + Math.round(acc) + ' m)' : '') + '. Centers are sorted by distance. <button class="link-btn" onclick="getLocation()">Refresh</button></span>');
    var coords = $('#locCoords');
    if (coords) coords.textContent = 'Your location: ' + lat.toFixed(5) + ', ' + lng.toFixed(5);
    var hero = $('#heroLoc');
    if (hero) hero.innerHTML = '<i class="fas fa-location-dot"></i> <span>Location on - see centers near you</span>';
    showUserOnMap();
    calculateDistances();
    renderNearList();
    if (activeGroupSort === 'near') sortGroups('near');
    markGroupDistances();
}
function showUserOnMap() {
    if (!userPos || !leafletReady()) return;
    if (map) {
        if (userMarker) map.removeLayer(userMarker);
        userMarker = L.marker([userPos.lat, userPos.lng], { icon: youIcon(), zIndexOffset: 1000 }).addTo(map).bindPopup('<strong>You are here</strong>');
    }
    if (homeMap) {
        if (homeUserMarker) homeMap.removeLayer(homeUserMarker);
        homeUserMarker = L.marker([userPos.lat, userPos.lng], { icon: youIcon(), zIndexOffset: 1000 }).addTo(homeMap);
        var near = nearestCenters(3);
        homeMap.fitBounds([[userPos.lat, userPos.lng]].concat(near.map(function (x) { return [x.c.lat, x.c.lng]; })), { padding: [24, 24], maxZoom: 14 });
    }
}
function haversine(lat1, lon1, lat2, lon2) {
    var R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function fmtDist(d) { return d < 1 ? Math.round(d * 1000) + ' m' : d.toFixed(1) + ' km'; }
function etaText(km) {
    var mins = Math.max(2, Math.round(km * 1.3 / 30 * 60)); // road distance ~1.3x straight line, ~30 km/h city traffic
    return mins < 60 ? '~' + mins + ' min drive' : '~' + (mins / 60).toFixed(1) + ' h drive';
}
function nearestCenters(n) {
    if (!userPos) return [];
    return SW.centers.map(function (c) { return { c: c, d: haversine(userPos.lat, userPos.lng, c.lat, c.lng) }; })
        .sort(function (a, b) { return a.d - b.d; }).slice(0, n || 99);
}

// "Mon-Sat: 9AM - 6PM", "Daily: 7AM - 10PM", "Mon-Fri: 8AM - 8PM, Sat: 9AM - 5PM"
function openStatus(hours) {
    if (!hours) return { open: null, label: '', cls: '' };
    var days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    var now = new Date(), today = now.getDay(), mins = now.getHours() * 60 + now.getMinutes();
    function toMin(t) {
        var m = t.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
        if (!m) return null;
        var h = parseInt(m[1], 10) % 12 + (m[3].toUpperCase() === 'PM' ? 12 : 0);
        return h * 60 + (parseInt(m[2] || '0', 10));
    }
    var parts = hours.split(',');
    for (var i = 0; i < parts.length; i++) {
        var m = parts[i].match(/^\s*([A-Za-z-]+)\s*:\s*(.+?)\s*-\s*(.+?)\s*$/);
        if (!m) continue;
        var spec = m[1].toLowerCase(), applies = false;
        if (spec === 'daily') applies = true;
        else {
            var r = spec.split('-'), s0 = days.indexOf(r[0].slice(0, 3)), s1 = days.indexOf((r[1] || r[0]).slice(0, 3));
            if (s0 >= 0 && s1 >= 0) applies = s0 <= s1 ? (today >= s0 && today <= s1) : (today >= s0 || today <= s1);
        }
        if (!applies) continue;
        var o = toMin(m[2]), c = toMin(m[3]);
        if (o === null || c === null) continue;
        if (mins >= o && mins < c) return { open: true, label: c - mins <= 60 ? 'Closes soon' : 'Open now', cls: c - mins <= 60 ? 'soon' : 'open' };
        return { open: false, label: 'Closed', cls: 'closed' };
    }
    return { open: false, label: 'Closed today', cls: 'closed' };
}
function renderOpenBadges() {
    $all('.center-item').forEach(function (el) {
        var st = openStatus(el.dataset.hours), b = el.querySelector('[data-open]');
        el.dataset.isopen = st.open ? '1' : '0';
        if (b) { b.textContent = st.label; b.className = 'open-badge ' + st.cls; }
    });
}

function calculateDistances() {
    if (!userPos) return;
    var list = $('#centerList');
    if (!list) return;
    SW.centers.forEach(function (c) {
        var el = document.getElementById('dist_' + c.id);
        if (el) el.innerHTML = '<i class="fas fa-route"></i> ' + fmtDist(haversine(userPos.lat, userPos.lng, c.lat, c.lng));
    });
    $all('.center-item', list).sort(function (a, b) {
        return haversine(userPos.lat, userPos.lng, +a.dataset.lat, +a.dataset.lng) - haversine(userPos.lat, userPos.lng, +b.dataset.lat, +b.dataset.lng);
    }).forEach(function (el) { list.insertBefore(el, $('#centerEmpty')); });
    var n = nearestCenters(1)[0];
    if (n) {
        $('#nearestName').textContent = n.c.name;
        $('#nearestAddr').textContent = n.c.address;
        $('#nearestDist').textContent = fmtDist(n.d);
        $('#nearestEta').textContent = etaText(n.d);
        $('#nearestDir').href = 'https://www.google.com/maps/dir/?api=1&origin=' + userPos.lat + ',' + userPos.lng + '&destination=' + n.c.lat + ',' + n.c.lng;
        $('#nearestPickup').onclick = function () { createGroupPickup(null, n.c.id); };
        $('#nearestBox').classList.add('show');
        $all('.center-item').forEach(function (el) { el.classList.toggle('nearest', +el.dataset.id === n.c.id); });
        if (map && centerMarkers[n.c.id]) centerMarkers[n.c.id].setIcon(centerIcon(true));
    }
}
function renderNearList() {
    var box = $('#nearList');
    if (!box || !userPos) return;
    box.innerHTML = nearestCenters(3).map(function (x, i) {
        var st = openStatus(x.c.hours);
        return '<button class="near-item" onclick="focusCenter(' + x.c.id + ')">' +
            '<span class="near-rank">' + (i + 1) + '</span>' +
            '<span class="grow"><strong>' + esc(x.c.name) + '</strong><small class="muted">' + esc(x.c.address) + '</small></span>' +
            '<span class="right"><b>' + fmtDist(x.d) + '</b><small class="open-badge ' + st.cls + '">' + st.label + '</small></span></button>';
    }).join('');
}
function setCenterFilter(btn) {
    centerFilter = btn.dataset.mat;
    $all('#centerChips .chip-btn[data-mat]').forEach(function (b) { b.classList.toggle('active', b === btn); });
    filterCenters();
}
function filterCenters() {
    var q = (($('#centerSearch') || {}).value || '').toLowerCase().trim();
    var openOnly = $('#openNowOnly') && $('#openNowOnly').checked;
    var n = 0;
    $all('.center-item').forEach(function (el) {
        var acc = el.dataset.accepts;
        var matOk = centerFilter === 'all' || acc.indexOf('all') !== -1 || acc.indexOf(centerFilter) !== -1 ||
            (centerFilter === 'paper' && acc.indexOf('cardboard') !== -1);
        var ok = (!q || el.dataset.search.indexOf(q) !== -1) && matOk && (!openOnly || el.dataset.isopen === '1');
        el.hidden = !ok;
        if (ok) n++;
    });
    $('#centerCount').textContent = n + ' centers';
    $('#centerEmpty').hidden = n > 0;
}

// ---- groups: sort by date or by distance ----
var activeGroupSort = 'date';
function markGroupDistances() {
    if (!userPos) return;
    $all('.group-card[data-lat]').forEach(function (g) {
        var chip = g.querySelector('[data-gdist]');
        if (!chip || !g.dataset.lat) return;
        chip.textContent = fmtDist(haversine(userPos.lat, userPos.lng, +g.dataset.lat, +g.dataset.lng));
        chip.hidden = false;
    });
}
function sortGroups(by) {
    if (by === 'near' && !userPos) {
        locateMe(true, function () { sortGroups('near'); });
        return;
    }
    activeGroupSort = by;
    $all('[data-gsort]').forEach(function (b) { b.classList.toggle('active', b.dataset.gsort === by); });
    var grid = $('.group-grid');
    if (!grid) return;
    $all('.group-card', grid).sort(function (a, b) {
        if (by === 'near') return haversine(userPos.lat, userPos.lng, +a.dataset.lat, +a.dataset.lng) - haversine(userPos.lat, userPos.lng, +b.dataset.lat, +b.dataset.lng);
        return a.dataset.date < b.dataset.date ? -1 : 1;
    }).forEach(function (el) { grid.appendChild(el); });
    var note = $('#groupSortNote');
    if (note) note.textContent = by === 'near' ? 'Sorted by distance from you' : 'Sorted by date';
    markGroupDistances();
}

function restoreLocation() {
    try {
        var saved = JSON.parse(localStorage.getItem('sw-loc') || 'null');
        if (saved && Date.now() - saved.t < 7 * 86400000) setUserPos(saved.lat, saved.lng, saved.acc, false);
    } catch (e) {}
}
var mapAutoAsked = false;
function onMapPageShown() {
    initMap();
    setTimeout(function () { if (map) { map.invalidateSize(); if (!userPos) fitAllCenters(); } }, 200);
    // First time the map opens without a known location, ask for the real GPS location automatically
    if (!userPos && !mapAutoAsked) { mapAutoAsked = true; locateMe(false, function () { if (map) map.setView([userPos.lat, userPos.lng], 13); }); }
}

// ---- count-up numbers in the hero ----
function animateCounts() {
    $all('[data-count]').forEach(function (el) {
        var target = parseFloat(el.dataset.count) || 0, dec = parseInt(el.dataset.dec || '0', 10), pre = el.dataset.prefix || '';
        var start = performance.now(), dur = 900;
        function step(t) {
            var k = Math.min(1, (t - start) / dur), v = target * (1 - Math.pow(1 - k, 3));
            el.textContent = pre + v.toLocaleString('en-MY', { minimumFractionDigits: dec, maximumFractionDigits: dec });
            if (k < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    });
}

// =========================================================
// GROUP PICKUPS + BAG BUILDER
// =========================================================
function bagBuilderHtml() {
    return '<div class="bag-builder"><div class="bag-builder-head"><strong><i class="fas fa-bag-shopping"></i> Your bags</strong>' +
        '<button type="button" class="link-btn" data-add-bag><i class="fas fa-plus"></i> Add bag</button></div>' +
        '<div class="hint muted small" style="margin-bottom:8px">One bag per material. Each bag gets its own code (e.g. B1, B2) so it can be traced back to you.</div>' +
        '<div data-bags></div><div class="bag-summary"><span>Total <b data-total-kg>0 kg</b></span><span>Est. value <b data-total-val>RM 0.00</b></span></div></div>';
}
function initBagBuilder(root, prefill) {
    var wrap = root.querySelector('[data-bags]');
    function addRow(mid, kg) {
        var row = document.createElement('div');
        row.className = 'bag-row';
        row.innerHTML = '<span class="bag-no"></span>' +
            '<select class="form-control" data-mat aria-label="Material">' + materialOptions(mid) + '</select>' +
            '<input class="form-control" type="number" min="0.1" step="0.1" placeholder="kg" data-kg aria-label="Weight in kg" value="' + (kg || '') + '">' +
            '<button type="button" class="icon-btn small" aria-label="Remove bag"><i class="fas fa-trash"></i></button>';
        row.querySelector('button').onclick = function () {
            if (wrap.children.length > 1) { row.remove(); refresh(); }
        };
        row.querySelector('select').onchange = refresh;
        row.querySelector('input').oninput = refresh;
        wrap.appendChild(row);
        refresh();
    }
    function refresh() {
        var kg = 0, val = 0;
        $all('.bag-row', wrap).forEach(function (r, i) {
            r.querySelector('.bag-no').textContent = 'B' + (i + 1);
            var m = materialById(r.querySelector('[data-mat]').value), w = parseFloat(r.querySelector('[data-kg]').value) || 0;
            kg += w; if (m) val += w * m.price;
        });
        root.querySelector('[data-total-kg]').textContent = kg.toFixed(1) + ' kg';
        root.querySelector('[data-total-val]').textContent = rm(val);
    }
    root.querySelector('[data-add-bag]').onclick = function () {
        if (wrap.children.length >= 10) { showToast('Maximum 10 bags per person', 'error'); return; }
        addRow();
    };
    if (prefill && prefill.length) prefill.forEach(function (b) { addRow(b.material_id, b.weight); });
    else addRow();
    return function getItems() {
        return $all('.bag-row', wrap).map(function (r) {
            return { material_id: Number(r.querySelector('[data-mat]').value), weight: parseFloat(r.querySelector('[data-kg]').value) || 0 };
        });
    };
}
function formError(modal, msg) {
    var er = modal.querySelector('.form-error');
    er.textContent = msg; er.classList.add('show');
    er.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function centerOptions() {
    var list = userPos ? nearestCenters(99).map(function (x) { return x; }) : SW.centers.map(function (c) { return { c: c, d: null }; });
    return list.map(function (x) {
        return '<option value="' + x.c.id + '">' + esc(x.c.name) + (x.d !== null ? ' (' + fmtDist(x.d) + ')' : '') + '</option>';
    }).join('');
}

// ---- solo drop-off ----
function logDropOff() {
    var today = new Date();
    var iso = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    var modal = openModal(modalHead('fa-box-open', 'Log a solo drop-off', 'Took your rubbish to a center yourself? Log it and get paid once the center weighs it.') +
        '<form><div class="form-error"></div>' +
        '<div class="form-row"><div class="form-group"><label>Recycling center <span class="req">*</span></label><select class="form-control" name="center_id" required><option value="">Choose...</option>' + centerOptions() + '</select></div>' +
        '<div class="form-group"><label>Date</label><input class="form-control" type="date" name="dropoff_date" value="' + iso + '"></div></div>' +
        bagBuilderHtml() +
        '<div class="form-group"><label>Notes (optional)</label><input class="form-control" name="notes" placeholder="e.g. Receipt no. 1234"></div>' +
        '<button type="submit" class="btn btn-primary full"><i class="fas fa-check"></i> Log drop-off</button></form>');
    var near = nearestCenters(1)[0];
    if (near) modal.querySelector('[name=center_id]').value = near.c.id;
    var getItems = initBagBuilder(modal);
    modal.querySelector('form').addEventListener('submit', function (e) {
        e.preventDefault();
        var fd = new FormData(this);
        fd.append('items', JSON.stringify(getItems()));
        api('log_dropoff.php', fd).then(function (d) {
            if (d.success) { closeModal(modal); showToast('Drop-off logged: ' + d.total + ' kg. You will be paid after it is weighed.', 'success'); setTimeout(function () { reloadView('pickups'); }, 1200); }
            else formError(modal, d.error || 'Could not log drop-off');
        });
    });
}

function createGroupPickup(prefillBags, centerId) {
    var tomorrow = new Date(Date.now() + 86400000);
    var minDate = new Date().toISOString().slice(0, 10);
    var dateVal = tomorrow.getFullYear() + '-' + String(tomorrow.getMonth() + 1).padStart(2, '0') + '-' + String(tomorrow.getDate()).padStart(2, '0');
    var centerOpts = centerOptions();
    var modal = openModal(modalHead('fa-truck-ramp-box', 'Create group pickup', 'Neighbours join, share one delivery, and everyone is paid for their own bags.') +
        '<form id="createGroupForm"><div class="form-error"></div>' +
        '<div class="form-group"><label>Recycling center <span class="req">*</span></label><select class="form-control" name="center_id" required><option value="">Choose a center...</option>' + centerOpts + '</select></div>' +
        '<div class="form-row"><div class="form-group"><label>Date <span class="req">*</span></label><input class="form-control" type="date" name="pickup_date" min="' + minDate + '" value="' + dateVal + '" required></div>' +
        '<div class="form-group"><label>Time <span class="req">*</span></label><input class="form-control" type="time" name="pickup_time" value="10:00" required></div></div>' +
        '<div class="form-group"><label>Your pickup address <span class="req">*</span></label><input class="form-control" name="address" value="' + esc(SW.address || '') + '" placeholder="Full address" required></div>' +
        bagBuilderHtml() +
        '<div class="form-row"><div class="form-group"><label>Max people</label><select class="form-control" name="max_participants">' +
        [2, 3, 4, 5, 6, 8].map(function (n) { return '<option value="' + n + '"' + (n === 5 ? ' selected' : '') + '>' + n + ' people</option>'; }).join('') + '</select></div>' +
        '<div class="form-group"><label>Meeting point</label><input class="form-control" name="meeting_point" placeholder="e.g. Guard house"></div></div>' +
        '<div class="form-group"><label>Notes for the group</label><textarea class="form-control" name="notes" placeholder="e.g. Please flatten all boxes"></textarea></div>' +
        '<button type="submit" class="btn btn-primary full"><i class="fas fa-plus"></i> Create group</button></form>');
    var getItems = initBagBuilder(modal, prefillBags);
    var nearestId = centerId || (nearestCenters(1)[0] || {}).c && nearestCenters(1)[0].c.id;
    if (nearestId) modal.querySelector('[name=center_id]').value = nearestId;
    modal.querySelector('form').addEventListener('submit', function (e) {
        e.preventDefault();
        var fd = new FormData(this);
        fd.append('items', JSON.stringify(getItems()));
        var btn = this.querySelector('[type=submit]');
        btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
        api('create_group_pickup.php', fd).then(function (d) {
            if (d.success) {
                closeModal(modal);
                showTagResult(d.group_id, d.group_code, d.tag_code, d.tag_color, true);
            } else {
                formError(modal, d.error || 'Failed to create group');
                btn.disabled = false; btn.innerHTML = '<i class="fas fa-plus"></i> Create group';
            }
        }).catch(function () { formError(modal, 'Network error, please try again'); btn.disabled = false; btn.innerHTML = '<i class="fas fa-plus"></i> Create group'; });
    });
}

function joinGroup(groupId) {
    LocalAPI('group_details.php?id=' + groupId).then(function (g) {
        if (!g) { showToast('Group not found', 'error'); return; }
        closeModal();
        var modal = openModal(modalHead('fa-handshake', 'Join group ' + g.group_code,
            esc(g.center_name) + ' &middot; ' + esc(g.pickup_date_display) + ', ' + esc(g.pickup_time)) +
            '<form id="joinForm"><div class="form-error"></div>' +
            '<div class="form-group"><label>Your pickup address <span class="req">*</span></label><input class="form-control" name="address" value="' + esc(SW.address || '') + '" required></div>' +
            bagBuilderHtml() +
            '<div class="form-group"><label>Notes (optional)</label><input class="form-control" name="description" placeholder="e.g. Bags are by the gate"></div>' +
            '<button type="submit" class="btn btn-primary full"><i class="fas fa-handshake"></i> Join and get my tag</button></form>');
        var getItems = initBagBuilder(modal);
        modal.querySelector('form').addEventListener('submit', function (e) {
            e.preventDefault();
            var fd = new FormData(this);
            fd.append('group_id', groupId);
            fd.append('items', JSON.stringify(getItems()));
            var btn = this.querySelector('[type=submit]');
            btn.disabled = true;
            api('join_group_pickup.php', fd).then(function (d) {
                if (d.success) { closeModal(modal); showTagResult(groupId, g.group_code, d.tag_code, d.tag_color, false); }
                else { formError(modal, d.error || 'Could not join'); btn.disabled = false; }
            });
        });
    });
}

var TAG_HEX = { Red: '#e53935', Blue: '#1e88e5', Yellow: '#fdd835', Green: '#43a047', Purple: '#8e24aa', Orange: '#fb8c00', Pink: '#ec407a', Grey: '#78909c' };
function showTagResult(groupId, groupCode, tagCode, tagColor, created) {
    var m = openModal(modalHead('fa-circle-check', created ? 'Group ' + groupCode + ' created!' : "You're in!", created ? 'You are participant #1 and the organiser.' : 'Here is your tag for this pickup.') +
        '<div style="text-align:center;margin:8px 0 14px"><span class="tag-chip" style="--tag:' + (TAG_HEX[tagColor] || '#78909c') + ';font-size:1.3rem;padding:8px 18px 8px 10px"><span class="tag-dot" style="width:22px;height:22px"></span>' + esc(tagCode) + ' <small>' + esc(tagColor) + '</small></span></div>' +
        '<ol class="muted small" style="padding-left:18px;display:grid;gap:4px">' +
        '<li><strong>Print your labels</strong> and stick one on each bag, or write the bag code (e.g. <b class="mono">' + esc(tagCode) + '-B1</b>) with a marker.</li>' +
        '<li>Tie a <strong>' + esc(tagColor.toLowerCase()) + '</strong> ribbon or tape on your bags so they are easy to spot.</li>' +
        (created ? '<li><strong>Share the invite link</strong> so neighbours can join.</li><li>On pickup day, open the <strong>Manifest</strong> to check every bag in.</li>' : '<li>Hand your bags to the organiser on pickup day. They will weigh them and you get paid for yours.</li>') +
        '</ol><div class="btn-row">' +
        '<a class="btn btn-primary" href="#tags-' + groupId + '\"><i class="fas fa-print"></i> Print labels</a>' +
        (created ? '<button class="btn btn-ghost" onclick="shareGroup(' + groupId + ',\'' + esc(groupCode) + '\')"><i class="fas fa-share-nodes"></i> Invite link</button>' : '') +
        '<button class="btn btn-ghost" data-close-reload>Done</button></div>', { sticky: true });
    m.querySelector('[data-close-reload]').onclick = function () { reloadView('pickups'); };
}

function viewGroupDetails(groupId) {
    LocalAPI('group_details.php?id=' + groupId).then(function (d) {
        if (!d) { showToast('Unable to load group details', 'error'); return; }
        var people = d.participants.map(function (p) {
            return '<div class="person"><span class="tag-dot" style="--tag:' + p.tag_hex + ';background:' + p.tag_hex + ';width:18px;height:18px;margin-top:3px"></span>' +
                '<div class="grow"><strong>' + esc(p.username) + '</strong> ' + (p.role === 'creator' ? '<span class="chip chip-gold"><i class="fas fa-crown"></i> Organiser</span> ' : '') + (p.is_me ? '<span class="chip chip-blue">You</span>' : '') +
                '<div class="muted small"><b class="mono">' + esc(p.tag_code) + '</b> &middot; ' + esc(p.tag_color) + ' &middot; ' + p.estimated_weight.toFixed(1) + ' kg</div>' +
                '<div class="person-bags">' + p.bags.map(function (b) { return '<span style="--tag:' + p.tag_hex + '">' + esc(b.bag_code) + ' ' + esc(b.material) + (b.checked_in ? ' <i class="fas fa-check"></i>' : '') + '</span>'; }).join('') + '</div></div></div>';
        }).join('');
        var my = d.my_split;
        var actions = '';
        if (!d.is_member && (d.status === 'open')) actions += '<button class="btn btn-primary" onclick="joinGroup(' + d.id + ')"><i class="fas fa-handshake"></i> Join</button>';
        if (d.is_member) actions += '<a class="btn btn-primary" href="#tags-' + d.id + '\"><i class="fas fa-print"></i> My labels</a>';
        if (d.can_manage) actions += '<a class="btn btn-dark" href="#manifest-' + d.id + '\"><i class="fas fa-clipboard-check"></i> Manifest</a>';
        actions += '<button class="btn btn-ghost" onclick="shareGroup(' + d.id + ',\'' + esc(d.group_code) + '\')"><i class="fas fa-share-nodes"></i> Invite</button>';

        openModal(modalHead('fa-people-group', 'Group ' + d.group_code, 'Organised by ' + esc(d.creator_name)) +
            '<div class="detail-box">' +
            '<div><i class="fas fa-warehouse"></i><span><strong>' + esc(d.center_name) + '</strong><br><span class="muted">' + esc(d.center_address) + '</span></span></div>' +
            '<div><i class="fas fa-clock"></i><span>' + esc(d.pickup_date_display) + ' at ' + esc(d.pickup_time) + '</span></div>' +
            (d.meeting_point ? '<div><i class="fas fa-flag"></i><span>' + esc(d.meeting_point) + '</span></div>' : '') +
            (d.notes ? '<div><i class="fas fa-note-sticky"></i><span>' + esc(d.notes) + '</span></div>' : '') +
            '<div><i class="fas fa-users"></i><span>' + d.current_participants + '/' + d.max_participants + ' people &middot; ' + d.total_kg.toFixed(1) + ' kg &middot; delivery ' + rm(d.delivery_fee) + '</span></div></div>' +
            (my ? '<div class="split-box"><div><small>Your bags are worth</small><strong>' + rm(my.value) + '</strong></div><div><small>Your delivery share</small><strong>' + rm(my.delivery_share) + '</strong></div><div><small>You get (est.)</small><strong>' + rm(my.net) + '</strong></div></div>' : '') +
            '<div class="card-title" style="margin-top:6px"><i class="fas fa-tags"></i> Participants &amp; bag tags</div>' + people +
            '<div class="btn-row">' + actions + '</div>');
    }).catch(function () { showToast('Error loading group details', 'error'); });
}

function shareGroup(groupId, code) {
    var url = location.href.split('#')[0] + '#group-' + groupId;
    var text = 'Join my SmartWaste group pickup ' + code + ' - share one delivery and get paid for your recyclables: ' + url;
    if (navigator.share) {
        navigator.share({ title: 'SmartWaste group ' + code, text: text, url: url }).catch(function () {});
    } else {
        var m = openModal(modalHead('fa-share-nodes', 'Invite neighbours', 'Send this link on WhatsApp or Telegram.') +
            '<div class="code-box">' + esc(code) + '</div><input class="form-control" readonly value="' + esc(url) + '" onclick="this.select()">' +
            '<div class="btn-row"><button class="btn btn-primary" id="cpLink"><i class="fas fa-copy"></i> Copy link</button>' +
            '<a class="btn btn-ghost" target="_blank" href="https://wa.me/?text=' + encodeURIComponent(text) + '"><i class="fas fa-share"></i> WhatsApp</a></div>');
        m.querySelector('#cpLink').onclick = function () { copyText(url); };
    }
}

function leaveGroup(groupId) {
    askConfirm({ title: 'Leave this group?', message: 'Your bags will be removed from the manifest.', ok: 'Leave group', danger: true }).then(function (ok) {
        if (!ok) return;
        api('leave_group.php', { group_id: groupId }).then(function (d) {
            if (d.success) { showToast('You left the group', 'success'); setTimeout(function () { reloadView(); }, 700); }
            else showToast(d.error, 'error');
        });
    });
}
function cancelGroup(groupId) {
    askConfirm({ title: 'Cancel this group pickup?', message: 'Everyone in the group will be notified. This cannot be undone.', ok: 'Cancel pickup', danger: true }).then(function (ok) {
        if (!ok) return;
        api('cancel_group.php', { group_id: groupId }).then(function (d) {
            if (d.success) { showToast('Group cancelled', 'success'); setTimeout(function () { reloadView(); }, 700); }
            else showToast(d.error, 'error');
        });
    });
}

// =========================================================
// REWARDS
// =========================================================
function redeemReward(rewardId, pointsRequired, label) {
    if (pointsRequired > SW.points) {
        showToast('You need ' + (pointsRequired - SW.points).toLocaleString() + ' more points', 'error');
        return;
    }
    askConfirm({ title: 'Redeem ' + label + '?', message: 'This uses <strong>' + pointsRequired.toLocaleString() + ' points</strong>. You have ' + SW.points.toLocaleString() + '.', ok: 'Redeem', icon: 'fa-gift' }).then(function (ok) {
        if (!ok) return;
        api('redeem.php', { action: 'redeem', reward_id: rewardId }).then(function (d) {
            if (!d.success) { showToast(d.error || 'Unable to redeem', 'error'); return; }
            SW.points = d.points_left;
            $('#pointsBalance').textContent = d.points_left.toLocaleString();
            var m = openModal(modalHead('fa-gift', 'Reward redeemed!', esc(d.partner_name) + ' &middot; ' + esc(d.discount)) +
                '<p class="muted small">Show this code at checkout. Valid until ' + esc(d.expires_at) + '.</p>' +
                '<div class="code-box">' + esc(d.redemption_code) + '</div>' +
                '<div class="btn-row"><button class="btn btn-primary" id="cpCode"><i class="fas fa-copy"></i> Copy code</button>' +
                (d.link ? '<a class="btn btn-ghost" target="_blank" rel="noopener" href="' + esc(d.link) + '"><i class="fas fa-arrow-up-right-from-square"></i> Open ' + esc(d.partner_name) + '</a>' : '') +
                '<button class="btn btn-ghost" data-done>Done</button></div>', { sticky: true });
            m.querySelector('#cpCode').onclick = function () { copyText(d.redemption_code); };
            m.querySelector('[data-done]').onclick = function () { reloadView('rewards'); };
        });
    });
}

// =========================================================
// PAYMENT METHODS
// =========================================================
function addPaymentMethod() {
    var modal = openModal(modalHead('fa-wallet', 'Add payment method', 'Where should we send your recycling money?') +
        '<form id="paymentForm"><div class="form-error"></div>' +
        '<div class="form-group"><label>Type</label><select class="form-control" name="payment_type">' +
        '<option value="tng">Touch \'n Go eWallet</option><option value="grabpay">GrabPay</option><option value="bank">Bank account</option></select></div>' +
        '<div id="bankFields" hidden>' +
        '<div class="form-group"><label>Bank</label><select class="form-control" name="bank_name">' +
        ['Maybank', 'CIMB Bank', 'Public Bank', 'RHB Bank', 'Hong Leong Bank', 'AmBank', 'Bank Islam', 'BSN', 'Bank Rakyat', 'UOB Malaysia', 'OCBC Bank', 'Alliance Bank', 'Affin Bank', 'GXBank'].map(function (b) { return '<option>' + b + '</option>'; }).join('') +
        '</select></div><div class="form-group"><label>Account holder name</label><input class="form-control" name="account_name" value="' + esc(SW.fullName || '') + '"></div>' +
        '<div class="form-group"><label>Account number</label><input class="form-control" name="account_number" inputmode="numeric" placeholder="8-16 digits"></div></div>' +
        '<div id="tngFields"><div class="form-group"><label>Phone number linked to the eWallet</label><input class="form-control" type="tel" name="tng_phone" value="' + esc(SW.phone || '') + '" placeholder="e.g. 012-3456789"></div></div>' +
        '<label class="setting-row" style="cursor:pointer"><span><strong>Set as default</strong></span><span class="switch"><input type="checkbox" name="is_default" value="1" checked><span></span></span></label>' +
        '<button type="submit" class="btn btn-primary full mt-8"><i class="fas fa-plus"></i> Add payment method</button></form>');
    modal.querySelector('[name=payment_type]').onchange = function () {
        var bank = this.value === 'bank';
        modal.querySelector('#bankFields').hidden = !bank;
        modal.querySelector('#tngFields').hidden = bank;
    };
    modal.querySelector('form').addEventListener('submit', function (e) {
        e.preventDefault();
        api('add_payment_method.php', new FormData(this)).then(function (d) {
            if (d.success) { showToast('Payment method added', 'success'); closeModal(modal); setTimeout(function () { reloadView('profile'); }, 600); }
            else formError(modal, d.error || 'Failed to add payment method');
        });
    });
}
function setDefaultPayment(id) {
    api('set_default_payment.php', { method_id: id }).then(function (d) {
        if (d.success) { showToast('Default payment method updated', 'success'); setTimeout(function () { reloadView(); }, 500); }
        else showToast(d.error, 'error');
    });
}
function removePayment(id) {
    askConfirm({ title: 'Remove payment method?', message: 'You can add it again later.', ok: 'Remove', danger: true }).then(function (ok) {
        if (!ok) return;
        api('remove_payment.php', { method_id: id }).then(function (d) {
            if (d.success) { showToast('Payment method removed', 'success'); setTimeout(function () { reloadView(); }, 500); }
            else showToast(d.error, 'error');
        });
    });
}

// =========================================================
// PROFILE
// =========================================================
var AVATAR_COLORS = ['#2f9e5b', '#0f3d26', '#1e88e5', '#8e24aa', '#fb8c00', '#d81b60', '#00897b', '#5e35b1', '#e53935', '#546e7a'];
function openEditProfile() {
    var initial = (SW.username || '?').charAt(0).toUpperCase();
    var currentAvatar = $('.profile-avatar-wrap .avatar');
    var modal = openModal(modalHead('fa-user-pen', 'Edit profile', 'Update how you appear and where we pick up from.') +
        '<form id="profileForm" enctype="multipart/form-data"><div class="form-error"></div>' +
        '<div class="photo-row"><span class="avatar avatar-xl" id="pfPreview" style="border-color:var(--border)">' + (currentAvatar ? currentAvatar.innerHTML : initial) + '</span>' +
        '<div><label class="btn btn-ghost btn-sm" style="cursor:pointer"><i class="fas fa-camera"></i> Upload photo<input type="file" name="photo" accept="image/jpeg,image/png,image/webp" hidden></label>' +
        (SW.hasPhoto ? ' <button type="button" class="btn btn-danger-ghost btn-sm" id="pfRemove"><i class="fas fa-trash"></i> Remove</button>' : '') +
        '<div class="hint muted small mt-8">JPG, PNG or WEBP, max 2 MB</div></div></div>' +
        '<div class="form-group"><label>Avatar colour (when no photo)</label><div class="color-pick">' +
        AVATAR_COLORS.map(function (c, i) { return '<input type="radio" name="avatar_color" id="ac' + i + '" value="' + c + '"' + (c === SW.avatarColor ? ' checked' : '') + '><label for="ac' + i + '" style="background:' + c + '"></label>'; }).join('') + '</div></div>' +
        '<div class="form-row"><div class="form-group"><label>Full name</label><input class="form-control" name="full_name" value="' + esc(SW.fullName || '') + '"></div>' +
        '<div class="form-group"><label>Username <span class="req">*</span></label><input class="form-control" name="username" value="' + esc(SW.username) + '" required></div></div>' +
        '<div class="form-row"><div class="form-group"><label>Email <span class="req">*</span></label><input class="form-control" type="email" name="email" value="' + esc(SW.email) + '" required></div>' +
        '<div class="form-group"><label>Phone</label><input class="form-control" type="tel" name="phone" value="' + esc(SW.phone || '') + '" placeholder="012-3456789"></div></div>' +
        '<div class="form-group"><label>Pickup address</label><textarea class="form-control" name="address" placeholder="Used automatically when you join a group">' + esc(SW.address || '') + '</textarea></div>' +
        '<div class="form-row"><div class="form-group"><label>City</label><input class="form-control" name="city" value="' + esc(SW.city || '') + '" placeholder="e.g. Petaling Jaya"></div>' +
        '<div class="form-group"><label>Bio <small class="muted" id="bioCount"></small></label><input class="form-control" name="bio" maxlength="160" value="' + esc(SW.bio || '') + '" placeholder="A line about you"></div></div>' +
        '<button type="submit" class="btn btn-primary full"><i class="fas fa-floppy-disk"></i> Save changes</button></form>');

    var file = modal.querySelector('[name=photo]');
    var preview = modal.querySelector('#pfPreview');
    file.onchange = function () {
        var f = file.files[0];
        if (!f) return;
        if (f.size > 2 * 1024 * 1024) { formError(modal, 'Photo must be smaller than 2 MB'); file.value = ''; return; }
        var reader = new FileReader();
        reader.onload = function (e) { preview.innerHTML = '<img src="' + e.target.result + '" alt="">'; };
        reader.readAsDataURL(f);
    };
    $all('[name=avatar_color]', modal).forEach(function (r) {
        r.onchange = function () { if (!preview.querySelector('img')) preview.style.background = r.value; };
    });
    var bio = modal.querySelector('[name=bio]'), bc = modal.querySelector('#bioCount');
    bio.oninput = function () { bc.textContent = bio.value.length + '/160'; };
    bio.oninput();
    var rmBtn = modal.querySelector('#pfRemove');
    if (rmBtn) rmBtn.onclick = function () {
        api('edit_profile.php', { action: 'remove_photo' }).then(function () { showToast('Photo removed', 'success'); setTimeout(function () { reloadView(); }, 500); });
    };
    modal.querySelector('form').addEventListener('submit', function (e) {
        e.preventDefault();
        var btn = this.querySelector('[type=submit]');
        btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        profileFormData(this).then(function (fd) { return api('edit_profile.php', fd); }).then(function (d) {
            if (d.success) { showToast('Profile updated', 'success'); setTimeout(function () { reloadView('profile'); }, 600); }
            else { formError(modal, d.error); btn.disabled = false; btn.innerHTML = '<i class="fas fa-floppy-disk"></i> Save changes'; }
        });
    });
}
function openChangePassword() {
    var modal = openModal(modalHead('fa-key', 'Change password', 'Use at least 6 characters.') +
        '<form><div class="form-error"></div><input type="hidden" name="action" value="password">' +
        '<div class="form-group"><label>Current password</label><input class="form-control" type="password" name="current_password" required autocomplete="current-password"></div>' +
        '<div class="form-group"><label>New password</label><input class="form-control" type="password" name="new_password" required minlength="6" autocomplete="new-password"></div>' +
        '<div class="form-group"><label>Confirm new password</label><input class="form-control" type="password" name="confirm_password" required minlength="6" autocomplete="new-password"></div>' +
        '<button type="submit" class="btn btn-primary full"><i class="fas fa-key"></i> Update password</button></form>');
    modal.querySelector('form').addEventListener('submit', function (e) {
        e.preventDefault();
        api('edit_profile.php', new FormData(this)).then(function (d) {
            if (d.success) { closeModal(modal); showToast('Password updated', 'success'); }
            else formError(modal, d.error);
        });
    });
}

// =========================================================
// ECOBOT CHAT
// =========================================================
var chatLoaded = false, chatBusy = false;
function openChat(prefill) {
    var p = $('#chatPanel');
    p.classList.add('open');
    p.setAttribute('aria-hidden', 'false');
    if (!chatLoaded) loadChatHistory();
    var input = $('#chatInput');
    setTimeout(function () { input.focus(); }, 250);
    if (typeof prefill === 'string' && prefill.trim()) sendChat(prefill);
}
function closeChat() {
    var p = $('#chatPanel');
    p.classList.remove('open');
    p.setAttribute('aria-hidden', 'true');
}
function renderMd(text) {
    // safe mini-markdown: escape first, then format
    var lines = esc(text).split('\n'), html = '', list = null;
    function close() { if (list) { html += '</' + list + '>'; list = null; } }
    lines.forEach(function (line) {
        var ol = line.match(/^\s*\d+[.)]\s+(.*)/), ul = line.match(/^\s*[-*•]\s+(.*)/);
        if (ol) { if (list !== 'ol') { close(); html += '<ol>'; list = 'ol'; } html += '<li>' + ol[1] + '</li>'; }
        else if (ul) { if (list !== 'ul') { close(); html += '<ul>'; list = 'ul'; } html += '<li>' + ul[1] + '</li>'; }
        else { close(); if (line.trim()) html += '<p>' + line + '</p>'; }
    });
    close();
    return html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
}
function addMsg(role, text, source) {
    var body = $('#chatBody');
    var el = document.createElement('div');
    el.className = 'msg ' + (role === 'user' ? 'user' : 'bot');
    el.innerHTML = '<div class="bubble">' + (role === 'user' ? esc(text) : renderMd(text)) + (source === 'offline' ? '' : '') + '</div>';
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
    return el;
}
function loadChatHistory() {
    chatLoaded = true;
    LocalAPI('ai_chat.php?action=history').then(function (d) {
        (d.messages || []).forEach(function (m) { addMsg(m.role, m.message); });
    }).catch(function () {});
}
function sendChat(text) {
    var input = $('#chatInput');
    text = (typeof text === 'string' ? text : input.value).trim();
    if (!text || chatBusy) return;
    if (!$('#chatPanel').classList.contains('open')) openChat();
    input.value = '';
    addMsg('user', text);
    chatBusy = true;
    var typing = document.createElement('div');
    typing.className = 'msg bot';
    typing.innerHTML = '<div class="bubble typing"><span></span><span></span><span></span></div>';
    $('#chatBody').appendChild(typing);
    $('#chatBody').scrollTop = 1e9;
    api('ai_chat.php', { message: text }).then(function (d) {
        typing.remove();
        addMsg('bot', d.reply || d.error || 'Sorry, something went wrong.', d.source);
        if (d.source) $('#chatMode').textContent = d.source === 'ai' ? 'AI assistant' : 'Offline assistant';
    }).catch(function () {
        typing.remove();
        addMsg('bot', 'I could not reach the server. Check your connection and try again.');
    }).then(function () { chatBusy = false; });
}
function clearChat() {
    api('ai_chat.php', { action: 'clear' }).then(function () {
        $all('#chatBody .msg').slice(1).forEach(function (m) { m.remove(); });
        showToast('Chat history cleared', 'success');
    });
}

// =========================================================
// NO-SERVER EXTRAS
// =========================================================
// Re-draw the app from the in-browser database (replaces a page reload)
function reloadView(page) { closeModal(); SWApp.render(page); }

// Shrink an uploaded photo and send it as an image string (no uploads folder needed)
function profileFormData(form) {
    var fd = new FormData(form), file = fd.get('photo');
    fd.delete('photo');
    if (!file || !file.size) return Promise.resolve(fd);
    return new Promise(function (resolve) {
        var img = new Image(), url = URL.createObjectURL(file);
        img.onload = function () {
            var s = 240, c = document.createElement('canvas'), k = Math.max(s / img.width, s / img.height);
            c.width = s; c.height = s;
            c.getContext('2d').drawImage(img, (s - img.width * k) / 2, (s - img.height * k) / 2, img.width * k, img.height * k);
            URL.revokeObjectURL(url);
            fd.append('photo_data', c.toDataURL('image/jpeg', .85));
            resolve(fd);
        };
        img.onerror = function () { URL.revokeObjectURL(url); resolve(fd); };
        img.src = url;
    });
}

// Areas of the Klang Valley, for when GPS is blocked or unavailable
var AREAS = [
    ['Kuala Lumpur City Centre', 3.1579, 101.7120], ['Bangsar', 3.1300, 101.6710], ['Cheras', 3.0890, 101.7440], ['Kepong', 3.2140, 101.6360],
    ['Setapak / Wangsa Maju', 3.2010, 101.7360], ['Petaling Jaya', 3.1073, 101.6067], ['Damansara / Mutiara Damansara', 3.1560, 101.6150],
    ['Subang Jaya / USJ', 3.0450, 101.5800], ['Puchong', 3.0240, 101.6170], ['Shah Alam', 3.0733, 101.5185], ['Klang', 3.0449, 101.4456],
    ['Ampang', 3.1500, 101.7620], ['Kajang / Bangi', 2.9930, 101.7880], ['Seri Kembangan', 3.0220, 101.7060], ['Cyberjaya / Putrajaya', 2.9290, 101.6560],
    ['Rawang / Selayang', 3.2600, 101.6200], ['Sungai Buloh', 3.2050, 101.5800]
];
function pickArea() {
    if ($('.modal.area-modal')) return;
    var m = openModal(modalHead('fa-map-location-dot', 'Where are you?', 'Pick your area and we will sort centers by distance from there.') +
        '<div class="area-list">' + AREAS.map(function (a, i) { return '<button type="button" class="chip-btn" data-area="' + i + '">' + esc(a[0]) + '</button>'; }).join('') + '</div>');
    m.classList.add('area-modal');
    $all('[data-area]', m).forEach(function (b) {
        b.onclick = function () {
            var a = AREAS[+b.dataset.area];
            closeModal(m);
            setUserPos(a[1], a[2], 0, true);
            setBanner('success', '<i class="fas fa-circle-check"></i> <span>Using <strong>' + esc(a[0]) + '</strong> as your location. Centers are sorted by distance. <button class="link-btn" onclick="pickArea()">Change</button> &middot; <button class="link-btn" onclick="getLocation()">Try GPS</button></span>');
            if (map) map.setView([a[1], a[2]], 13);
        };
    });
}

function resetDemoData() {
    askConfirm({
        icon: 'fa-rotate-left', title: 'Reset all data?', danger: true,
        message: 'This removes everything you did in this browser (pickups, payments, chat, new accounts) and loads the sample data again.',
        ok: 'Reset'
    }).then(function (yes) { if (yes) { SWDB.resetDemo(); SWApp.go('login'); } });
}
function logoutNow() { LocalAPI('logout.php').then(function () { SWApp.go('login'); }); }

// =========================================================
// INIT (runs each time the main view is drawn)
// =========================================================
function initUI(page) {
    tileLayers = []; tileFails = 0; tileOk = false; map = null; homeMap = null; userMarker = null; homeUserMarker = null; centerMarkers = {}; userPos = null;
    chatLoaded = false; chatBusy = false; mapAutoAsked = false; activeCat = 'all'; activeGroupSort = 'date'; centerFilter = 'all';
    $all('[data-page]').forEach(function (b) {
        b.addEventListener('click', function () { showPage(b.dataset.page); });
    });
    applyThemeIcon();
    renderCalc();
    renderOpenBadges();
    initHomeMap();
    restoreLocation();
    animateCounts();
    if ($('#priceList')) filterPrices();
    if (page && page !== 'home') showPage(page, true);
}
