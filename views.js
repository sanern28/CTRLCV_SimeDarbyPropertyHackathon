/* =========================================================
   SmartWaste - page templates
   The HTML that index.php used to print, now built in the browser
   from the same data (window.SWDB).
   ========================================================= */
(function () {
'use strict';
var D = window.SWDB;

// ---------- helpers (same names as auth.php) ----------
function e(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
function nf(n, dec) {
    n = +n || 0; dec = dec || 0;
    var s = Math.abs(n).toFixed(dec).split('.');
    s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (n < 0 && +s.join('.') !== 0 ? '-' : '') + s.join('.');
}
function money(n) { return 'RM ' + nf(n, 2); }
var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// PHP date() for the letters the pages use
function date(fmt, s) {
    var d = s instanceof Date ? s : (s ? D.parseDate(s) : new Date());
    if (!d || isNaN(d)) return '';
    var p = function (n) { return String(n).padStart(2, '0'); };
    return fmt.replace(/\\?[a-zA-Z]/g, function (c) {
        if (c.charAt(0) === '\\') return c.charAt(1);
        switch (c) {
            case 'd': return p(d.getDate());
            case 'j': return d.getDate();
            case 'D': return DAYS[d.getDay()].slice(0, 3);
            case 'l': return DAYS[d.getDay()];
            case 'M': return MONTHS[d.getMonth()].slice(0, 3);
            case 'F': return MONTHS[d.getMonth()];
            case 'm': return p(d.getMonth() + 1);
            case 'n': return d.getMonth() + 1;
            case 'Y': return d.getFullYear();
            case 'y': return String(d.getFullYear()).slice(2);
            case 'H': return p(d.getHours());
            case 'G': return d.getHours();
            case 'h': return p(d.getHours() % 12 || 12);
            case 'g': return d.getHours() % 12 || 12;
            case 'i': return p(d.getMinutes());
            case 's': return p(d.getSeconds());
            case 'A': return d.getHours() < 12 ? 'AM' : 'PM';
            case 'a': return d.getHours() < 12 ? 'am' : 'pm';
            default: return c;
        }
    });
}
function timeAgo(s) {
    var diff = (Date.now() - D.parseDate(s).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + ' min ago';
    if (diff < 86400) return Math.floor(diff / 3600) + ' h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + ' d ago';
    return date('M d', s);
}
function avatarHtml(u, cls) {
    cls = cls || 'avatar';
    if (u.profile_pic && /^data:image\//.test(u.profile_pic)) return '<span class="' + e(cls) + '"><img src="' + e(u.profile_pic) + '" alt=""></span>';
    return '<span class="' + e(cls) + '" style="background:' + e(u.avatar_color || '#2f9e5b') + '">' + e(String(u.username || '?').charAt(0).toUpperCase()) + '</span>';
}
function matIcon(m, cls) {
    cls = cls || 'mat-icon';
    var art = String(m.art || 'bag').replace(/[^a-z]/g, '') || 'bag';
    var cat = String(m.category || 'other').replace(/[^a-z_]/g, '');
    var code = m.resin_code ? '<text x="24" y="34.2" text-anchor="middle" font-size="8.5" font-weight="900" fill="currentColor" font-family="Arial,sans-serif">' + (+m.resin_code) + '</text>' : '';
    return '<span class="' + e(cls) + ' cat-' + cat + '" title="' + e(m.material_name || '') + '"><svg viewBox="0 0 48 48" aria-hidden="true"><use href="#mi-' + art + '"/>' + code + '</svg></span>';
}
function maskAccount(n) { n = String(n || '').replace(/\D/g, ''); return n.length <= 4 ? n : '•••• ' + n.slice(-4); }
function tagColorHex(c) { return D.TAG_COLORS[c] || '#78909c'; }
function statusChip(s) {
    var map = { open: ['Open', 'chip-green'], full: ['Full', 'chip-red'], collected: ['Collected', 'chip-blue'], completed: ['Completed', 'chip-gray'], cancelled: ['Cancelled', 'chip-gray'] };
    var x = map[s] || [s.charAt(0).toUpperCase() + s.slice(1), 'chip-gray'];
    return '<span class="chip ' + x[1] + '">' + x[0] + '</span>';
}
function tagChip(code, color) {
    return '<span class="tag-chip" style="--tag:' + e(tagColorHex(color)) + '"><span class="tag-dot"></span>' + e(code) + ' <small>' + e(color) + '</small></span>';
}
function each(arr, fn) { return (arr || []).map(fn).join(''); }
function js(s) { return e(String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")); } // like e(addslashes())

// ==========================================
// MAIN APP (index.php)
// ==========================================
function renderMain() {
    var user = D.getCurrentUser();
    var userId = user.id, username = user.username, displayName = user.full_name || username, firstName = displayName.split(' ')[0];
    var rewardPoints = +user.total_points || 0, carbonSaved = +user.carbon_saved || 0, totalKg = +user.total_weight_kg || 0;
    var totalEarned = +user.total_earned || 0, timesRecycled = +user.times_recycled || 0, level = user.level || 'Bronze';
    var levels = { Bronze: 0, Silver: 2000, Gold: 5000, Platinum: 10000 }, nextLevel = null, nextAt = null;
    Object.keys(levels).some(function (n) { if (rewardPoints < levels[n]) { nextLevel = n; nextAt = levels[n]; return true; } return false; });
    var currentAt = levels[level] || 0;
    var levelProgress = nextAt ? Math.min(100, Math.round((rewardPoints - currentAt) / Math.max(1, nextAt - currentAt) * 100)) : 100;

    var leaderboard = D.leaderboard().slice(0, 10);
    var centers = D.T('recycling_centers').filter(function (c) { return c.is_active; }).sort(function (a, b) { return a.name.localeCompare(b.name); }).slice(0, 30);
    var materials = D.getMaterials();
    var topPrices = materials.slice().sort(function (a, b) { return b.price_per_kg - a.price_per_kg; }).slice(0, 5);
    var categories = {}; materials.forEach(function (m) { categories[m.category] = D.categoryLabel(m.category); });
    var rank = D.rankOf(rewardPoints);
    var openGroups = D.openGroups();
    var myGroups = D.getUserGroups(userId);
    var myDropOffs = D.getUserDropOffs(userId);
    var CFG = D.CFG;
    var weeklyKg = D.weeklyPlasticKg(userId), challengeDone = D.challengeDone(userId);
    var challengePct = Math.min(100, Math.round(weeklyKg / CFG.CHALLENGE_KG * 100));
    var priceDates = materials.map(function (m) { return m.price_date; }).filter(Boolean).sort();
    var latestPriceDate = priceDates.length ? priceDates[priceDates.length - 1] : D.today();
    var myGroupIds = myGroups.map(function (g) { return g.id; });
    var upcoming = myGroups.filter(function (g) { return ['open', 'full', 'collected'].indexOf(g.status) >= 0; });
    var nextPickup = upcoming[0] || null;
    var myBags = {}; myGroups.forEach(function (g) { myBags[g.id] = D.bagsOf(g.participant_id); });
    var partnerRewards = D.getPartnerRewards(), userRedemptions = D.getUserRedemptions(userId), paymentMethods = D.getPaymentMethods(userId);
    var notifications = D.getNotifications(userId, 20);
    var unreadCount = notifications.filter(function (n) { return !n.is_read; }).length;
    var paymentTransactions = D.getPaymentTransactions(userId, 10);
    var hour = new Date().getHours();
    var greeting = hour < 12 ? 'Good morning' : (hour < 18 ? 'Good afternoon' : 'Good evening');
    var isStaff = ['admin', 'collector'].indexOf(user.role) >= 0, isAdmin = user.role === 'admin';
    var news = [
        { title: 'Bag tags for group pickups', desc: 'Every bag now gets its own code and QR label. Each person is paid for their own rubbish, by real weight.', date: 'New', icon: 'fa-tags' },
        { title: 'Prices checked against real recyclers', desc: materials.length + ' materials with the latest posted buy-back prices from Malaysian recyclers, each with its source and date.', date: 'Checked ' + date('M d', latestPriceDate), icon: 'fa-chart-line' },
        { title: 'Drop off by yourself', desc: 'No group nearby? Log a solo drop-off at any center and get paid once it is weighed.', date: 'New', icon: 'fa-box-open' },
        { title: 'Meet EcoBot', desc: 'Ask anything: "what is the first step to send my rubbish?", "how much for 5kg of cans?"', date: 'New', icon: 'fa-robot' }
    ];
    var maxPrice = materials.length ? Math.max.apply(null, materials.map(function (m) { return +m.price_max; })) : 1;
    var catArt = { metal: 'can', plastic: 'bag', paper: 'box', glass: 'glass', e_waste: 'phone', organic: 'leaf', other: 'oil' };

    // data the scripts need (was window.SW)
    window.SW = {
        userId: userId, username: username, fullName: user.full_name, email: user.email, phone: user.phone, address: user.address,
        city: user.city, bio: user.bio, avatarColor: user.avatar_color || '#2f9e5b', hasPhoto: !!user.profile_pic, points: rewardPoints,
        isAdmin: isAdmin,
        centers: centers.filter(function (c) { return c.latitude && c.longitude; }).map(function (c) { return { id: c.id, name: c.name, lat: +c.latitude, lng: +c.longitude, address: c.address, phone: c.phone, hours: c.operating_hours, accepts: c.accepted_materials, city: c.city }; }),
        materials: materials.map(function (m) { return { id: m.id, name: m.material_name, category: m.category, icon: m.icon, art: m.art, resin: m.resin_code ? +m.resin_code : null, min: +m.price_min, max: +m.price_max, price: +m.price_per_kg }; }),
        categories: categories,
        fee: { base: CFG.DELIVERY_BASE_FEE, freeKg: CFG.DELIVERY_FREE_KG, perKg: CFG.DELIVERY_PER_KG }
    };

    var h = '';
    h += '<div class="app">';
    // ----- sidebar
    h += '<aside class="sidebar"><div class="brand"><span class="brand-mark"><i class="fas fa-recycle"></i></span> SmartWaste</div><nav class="side-nav">' +
        '<button data-page="home" class="active"><i class="fas fa-house"></i> Home</button>' +
        '<button data-page="prices"><i class="fas fa-tags"></i> Prices</button>' +
        '<button data-page="pickups"><i class="fas fa-truck-ramp-box"></i> Pickups</button>' +
        '<button data-page="locator"><i class="fas fa-map-location-dot"></i> Map</button>' +
        '<button data-page="rewards"><i class="fas fa-gift"></i> Rewards</button>' +
        '<button data-page="profile"><i class="fas fa-user"></i> Profile</button>' +
        (isStaff ? '<a class="side-link" href="#admin"><i class="fas fa-shield-halved"></i> Admin panel</a>' : '') +
        '</nav><button class="side-bot" onclick="openChat()"><span class="bot-face"><i class="fas fa-robot"></i></span><span><strong>Ask EcoBot</strong><small>Your recycling assistant</small></span></button></aside>';

    h += '<div class="main">';
    // ----- topbar
    h += '<header class="topbar"><div class="brand brand-mobile"><span class="brand-mark"><i class="fas fa-recycle"></i></span> SmartWaste</div>' +
        '<nav class="top-nav" aria-label="Main">' +
        '<button data-page="home" class="active"><i class="fas fa-house"></i><span>Home</span></button>' +
        '<button data-page="prices"><i class="fas fa-tags"></i><span>Prices</span></button>' +
        '<button data-page="pickups"><i class="fas fa-truck-ramp-box"></i><span>Pickups</span></button>' +
        '<button data-page="locator"><i class="fas fa-map-location-dot"></i><span>Map</span></button>' +
        '<button data-page="rewards"><i class="fas fa-gift"></i><span>Rewards</span></button>' +
        '<button data-page="profile"><i class="fas fa-user"></i><span>Profile</span></button>' +
        (isStaff ? '<a class="top-link" href="#admin" title="Admin panel"><i class="fas fa-shield-halved"></i><span>Admin</span></a>' : '') +
        '</nav>' +
        '<div class="topbar-title" id="topbarTitle">Home</div><div class="topbar-actions">' +
        '<button class="top-bot" onclick="openChat()" aria-label="Ask EcoBot"><i class="fas fa-robot"></i><span>Ask EcoBot</span></button>' +
        '<button class="icon-btn" onclick="toggleTheme()" title="Dark mode" aria-label="Toggle dark mode"><i class="fas fa-moon" id="themeIcon"></i></button>' +
        '<button class="icon-btn" onclick="toggleNotifs(event)" title="Notifications" aria-label="Notifications"><i class="fas fa-bell"></i>' +
        (unreadCount ? '<span class="badge-dot" id="notifBadge">' + unreadCount + '</span>' : '') + '</button>' +
        '<button class="avatar-btn" onclick="showPage(\'profile\')" aria-label="Profile">' + avatarHtml(user, 'avatar') + '</button></div>' +
        '<div class="notif-panel" id="notifPanel"><div class="notif-head"><strong>Notifications</strong><button class="link-btn" onclick="markAllRead()">Mark all read</button></div><div class="notif-list">' +
        each(notifications, function (n) {
            return '<div class="notif ' + (n.is_read ? '' : 'unread') + '" data-id="' + n.id + '" data-link="' + e(n.link) + '" onclick="openNotif(this)">' +
                '<span class="notif-icon type-' + e(n.type) + '"><i class="fas ' + e(n.icon || 'fa-bell') + '"></i></span><div>' +
                '<div class="notif-title">' + e(n.title) + '</div><div class="notif-msg">' + e(n.message) + '</div><div class="notif-time">' + timeAgo(n.created_at) + '</div></div></div>';
        }) +
        (notifications.length ? '' : '<div class="empty-state small">No notifications yet</div>') + '</div></div></header>';

    h += '<main class="content">';

    // ===== HOME
    h += '<section id="home" class="page active" data-title="Home">' +
        '<div class="hero"><div class="hero-blob b1"></div><div class="hero-blob b2"></div><div class="hero-top"><div class="hero-text">' +
        '<div class="hero-greet">' + greeting + ',</div><h1>' + e(firstName) + ' <span class="wave"><i class="fas fa-leaf"></i></span></h1>' +
        '<p>You\'ve recycled <strong>' + nf(totalKg, 1) + ' kg</strong> and kept about <strong>' + nf(carbonSaved, 1) + ' kg CO&#8322;</strong> out of the air.</p>' +
        '<button class="loc-pill" id="heroLoc" onclick="locateMe(true)"><i class="fas fa-location-crosshairs"></i> <span>Use my location to find centers near you</span></button></div>' +
        '<div class="hero-ring" style="--p:' + levelProgress + '"><div><strong>' + e(level) + '</strong><small>' + (nextLevel ? nf(nextAt - rewardPoints) + ' pts to ' + nextLevel : 'Top level') + '</small></div></div></div>' +
        '<div class="hero-stats">' +
        '<div class="hero-stat"><i class="fas fa-star"></i><span data-count="' + rewardPoints + '">' + nf(rewardPoints) + '</span><small>Points</small></div>' +
        '<div class="hero-stat"><i class="fas fa-ranking-star"></i><span>#' + rank + '</span><small>Rank</small></div>' +
        '<div class="hero-stat"><i class="fas fa-wallet"></i><span data-count="' + totalEarned + '" data-prefix="RM " data-dec="2">' + money(totalEarned) + '</span><small>Earned</small></div>' +
        '<div class="hero-stat"><i class="fas fa-weight-scale"></i><span data-count="' + totalKg + '" data-dec="1">' + nf(totalKg, 1) + '</span><small>kg recycled</small></div>' +
        '</div></div>';

    h += '<div class="card"><div class="card-title"><i class="fas fa-route"></i> How to send your rubbish' +
        '<button class="link-btn ml-auto" onclick="openChat(\'What is the first step to send my rubbish?\')"><i class="fas fa-robot"></i> Ask EcoBot</button></div><ol class="steps">' +
        '<li><span class="step-icon"><i class="fas fa-layer-group"></i></span><strong>Sort</strong><small>By material: plastic, paper, metal...</small></li>' +
        '<li><span class="step-icon"><i class="fas fa-hand-sparkles"></i></span><strong>Clean</strong><small>Rinse, flatten, keep dry</small></li>' +
        '<li><span class="step-icon"><i class="fas fa-users"></i></span><strong>Group</strong><small>Join neighbours, share delivery</small></li>' +
        '<li><span class="step-icon"><i class="fas fa-tags"></i></span><strong>Tag</strong><small>Label each bag with your code</small></li>' +
        '<li><span class="step-icon"><i class="fas fa-money-bill-wave"></i></span><strong>Get paid</strong><small>For your own bags, by weight</small></li></ol></div>';

    h += '<div class="grid-2"><div class="card"><div class="card-title"><i class="fas fa-bolt"></i> Quick actions</div><div class="action-grid">' +
        '<button class="action-btn" onclick="createGroupPickup()"><i class="fas fa-circle-plus"></i><span>Create pickup</span></button>' +
        '<button class="action-btn" onclick="showPage(\'pickups\')"><i class="fas fa-people-group"></i><span>Join pickup</span></button>' +
        '<button class="action-btn" onclick="showPage(\'prices\')"><i class="fas fa-calculator"></i><span>Prices</span></button>' +
        '<button class="action-btn" onclick="showPage(\'locator\')"><i class="fas fa-map-pin"></i><span>Find centers</span></button>' +
        '<button class="action-btn" onclick="showPage(\'pickups\'); switchPickupTab(\'mine\')"><i class="fas fa-tag"></i><span>My tags</span></button>' +
        '<button class="action-btn" onclick="openChat()"><i class="fas fa-robot"></i><span>Ask EcoBot</span></button></div></div>';
    h += '<div class="card"><div class="card-title"><i class="fas fa-calendar-check"></i> Your next pickup</div>';
    if (nextPickup) {
        h += '<div class="next-pickup"><div class="next-date"><span>' + date('M', nextPickup.pickup_date) + '</span><strong>' + date('d', nextPickup.pickup_date) + '</strong></div>' +
            '<div class="next-info"><div class="next-title">' + e(nextPickup.center_name) + '</div>' +
            '<div class="muted"><i class="fas fa-clock"></i> ' + date('l, h:i A', nextPickup.pickup_date + ' ' + nextPickup.pickup_time) + '</div>' +
            '<div class="mt-8">' + tagChip(nextPickup.tag_code, nextPickup.tag_color) + '</div></div></div>' +
            '<div class="btn-row"><a class="btn btn-primary btn-sm" href="#tags-' + nextPickup.id + '"><i class="fas fa-print"></i> Bag labels</a>' +
            '<button class="btn btn-ghost btn-sm" onclick="viewGroupDetails(' + nextPickup.id + ')"><i class="fas fa-circle-info"></i> Details</button></div>';
    } else {
        h += '<div class="empty-state"><i class="fas fa-truck-fast"></i>No pickups booked yet.<div class="btn-row center"><button class="btn btn-primary btn-sm" onclick="showPage(\'pickups\')">Find a group</button></div></div>';
    }
    h += '</div></div>';

    h += '<div class="grid-2"><div class="card near-card"><div class="card-title"><i class="fas fa-location-dot"></i> Centers near you' +
        '<button class="link-btn ml-auto" onclick="showPage(\'locator\')">Full map <i class="fas fa-chevron-right"></i></button></div>' +
        '<div class="home-map-wrap"><div id="homeMap" class="home-map"></div><button class="map-ctrl map-switch" onclick="nextMapStyle()" title="Map not showing? Change map" aria-label="Change map"><i class="fas fa-layer-group"></i></button></div><div id="nearList"><div class="near-empty"><span class="pulse-dot"><i class="fas fa-location-crosshairs"></i></span>' +
        '<div><strong>See what\'s closest to you</strong><small class="muted">We use your location only in your browser to sort centers by distance.</small></div>' +
        '<button class="btn btn-primary btn-sm" onclick="locateMe(true)">Use my location</button></div></div></div>';
    h += '<div class="card"><div class="card-title"><i class="fas fa-arrow-trend-up"></i> Top prices today' +
        '<button class="link-btn ml-auto" onclick="showPage(\'prices\')">All ' + materials.length + ' <i class="fas fa-chevron-right"></i></button></div>' +
        each(topPrices, function (m) { return '<div class="mini-price">' + matIcon(m) + '<span class="mini-price-name">' + e(m.material_name) + '</span><span class="mini-price-val">' + money(m.price_per_kg) + '<small>/kg</small></span></div>'; }) +
        '</div></div>';

    h += '<div class="card challenge-card ' + (challengeDone ? 'done' : '') + '"><div class="challenge-art">' + matIcon({ art: 'bag', category: 'plastic', material_name: 'Plastic' }, 'challenge-icon') + '</div>' +
        '<div class="grow"><div class="challenge-top"><strong>Weekly challenge: recycle ' + CFG.CHALLENGE_KG + ' kg of plastic</strong>' +
        '<span class="chip ' + (challengeDone ? 'chip-green' : 'chip-gold') + '">' + (challengeDone ? '<i class="fas fa-check"></i> +' + CFG.CHALLENGE_POINTS + ' pts earned' : '+' + CFG.CHALLENGE_POINTS + ' pts') + '</span></div>' +
        '<div class="level-bar"><span style="width:' + challengePct + '%"></span></div>' +
        '<small class="muted">' + nf(weeklyKg, 1) + ' / ' + CFG.CHALLENGE_KG + ' kg this week &middot; counts plastic from completed pickups and verified drop-offs &middot; resets Monday</small></div></div>';

    h += '<div class="card"><div class="card-title"><i class="fas fa-newspaper"></i> What\'s new</div><div class="news-grid">' +
        each(news, function (n) { return '<div class="news-item"><div class="news-icon"><i class="fas ' + e(n.icon) + '"></i></div><div><div class="news-title">' + e(n.title) + '</div><div class="news-desc">' + e(n.desc) + '</div><div class="news-date">' + e(n.date) + '</div></div></div>'; }) +
        '</div></div></section>';

    // ===== PRICES
    h += '<section id="prices" class="page" data-title="Prices"><div class="page-head"><div><h2>Today\'s rubbish prices</h2>' +
        '<p class="muted">' + materials.length + ' materials &middot; latest posted buy-back prices from Malaysian recyclers &middot; checked ' + date('d M Y', latestPriceDate) + '</p></div>' +
        '<button class="btn btn-ghost btn-sm" onclick="document.getElementById(\'calcCard\').scrollIntoView({behavior:\'smooth\'})"><i class="fas fa-calculator"></i> Calculator</button></div>' +
        '<div class="price-tools"><div class="search-box"><i class="fas fa-magnifying-glass"></i><input type="search" id="priceSearch" placeholder="Search e.g. copper, kotak, botol..." oninput="filterPrices()"></div>' +
        '<select id="priceSort" onchange="filterPrices()" aria-label="Sort"><option value="high">Highest price</option><option value="low">Lowest price</option><option value="az">A - Z</option></select></div>' +
        '<div class="cat-tiles" id="catChips"><button class="cat-tile active" data-cat="all" onclick="setCat(this)"><span class="cat-tile-icon cat-all"><i class="fas fa-recycle"></i></span><strong>All</strong><small>' + materials.length + ' items</small></button>' +
        each(Object.keys(categories), function (key) {
            var inCat = materials.filter(function (m) { return m.category === key; });
            var top = Math.max.apply(null, inCat.map(function (m) { return +m.price_per_kg; }));
            return '<button class="cat-tile" data-cat="' + e(key) + '" onclick="setCat(this)">' + matIcon({ art: catArt[key] || 'bag', category: key, material_name: categories[key] }, 'cat-tile-icon') +
                '<strong>' + e(categories[key]) + '</strong><small>' + inCat.length + ' items' + (top > 0 ? ' &middot; up to ' + money(top) : '') + '</small></button>';
        }) + '</div>';
    h += '<div class="price-layout"><div class="card price-list" id="priceList">' +
        each(materials, function (m) {
            var left = maxPrice > 0 ? (m.price_min / maxPrice) * 100 : 0;
            var width = maxPrice > 0 ? Math.max(1.5, ((m.price_max - m.price_min) / maxPrice) * 100) : 0;
            var searchText = (m.material_name + ' ' + (m.description || '') + ' ' + D.categoryLabel(m.category)).toLowerCase();
            return '<div class="price-row" data-cat="' + e(m.category) + '" data-price="' + (+m.price_per_kg) + '" data-name="' + e(m.material_name) + '" data-search="' + e(searchText) + '">' +
                '<button class="price-main" onclick="this.parentElement.classList.toggle(\'open\')">' + matIcon(m) +
                '<span class="price-info"><span class="price-name">' + e(m.material_name) + '</span><span class="price-desc">' + e(m.description) + '</span>' +
                '<span class="range-bar" title="RM ' + nf(m.price_min, 2) + ' - ' + nf(m.price_max, 2) + '"><span style="left:' + (Math.round(left * 100) / 100) + '%;width:' + (Math.round(width * 100) / 100) + '%"></span></span></span>' +
                '<span class="price-val"><strong>' + money(m.price_per_kg) + '<small>/kg</small></strong><small>range ' + nf(m.price_min, 2) + ' - ' + nf(m.price_max, 2) + '</small>' +
                (+m.change_percent ? '<span class="trend ' + (m.is_up ? 'up' : 'down') + '"><i class="fas fa-caret-' + (m.is_up ? 'up' : 'down') + '"></i> ' + nf(m.change_percent, 1) + '%</span>' : '') +
                '</span></button><div class="price-more"><p><i class="fas fa-lightbulb"></i> <strong>How to prepare:</strong> ' + e(m.prep_tips) + '</p>' +
                '<p class="muted small src-line"><i class="fas fa-circle-check"></i> Checked ' + (m.price_date ? date('d M Y', m.price_date) : '-') + ' &middot; ' + e(m.source) +
                (m.source_url ? ' &middot; <a href="' + e(m.source_url) + '" target="_blank" rel="noopener">View source <i class="fas fa-arrow-up-right-from-square"></i></a>' : '') + '</p>' +
                '<div class="btn-row"><button class="btn btn-primary btn-sm" onclick="addToCalc(' + m.id + ')"><i class="fas fa-plus"></i> Add to calculator</button>' +
                '<button class="btn btn-ghost btn-sm" onclick="openChat(\'How should I prepare ' + js(m.material_name) + ' and what is it worth?\')"><i class="fas fa-robot"></i> Ask EcoBot</button>' +
                (isAdmin ? '<a class="btn btn-ghost btn-sm" href="#admin"><i class="fas fa-pen"></i> Edit in admin</a>' : '') + '</div></div></div>';
        }) +
        '<div class="empty-state" id="priceEmpty" hidden><i class="fas fa-magnifying-glass"></i>No material matches your search.<br><button class="link-btn" onclick="openChat(document.getElementById(\'priceSearch\').value)">Ask EcoBot instead</button></div></div>' +
        '<div class="card calc-card" id="calcCard"><div class="card-title"><i class="fas fa-calculator"></i> Earnings calculator</div><p class="muted small">Add materials and weights to estimate what your rubbish is worth.</p>' +
        '<div id="calcRows"></div><button class="btn btn-ghost btn-sm full" onclick="addToCalc()"><i class="fas fa-plus"></i> Add material</button>' +
        '<div class="calc-total"><div><small>Estimated value</small><strong id="calcTotal">RM 0.00</strong></div><div class="right"><small>Range</small><span id="calcRange">RM 0.00 - 0.00</span></div></div>' +
        '<p class="muted small" id="calcNote"></p><button class="btn btn-primary full" onclick="calcToGroup()"><i class="fas fa-truck-ramp-box"></i> Book these in a group pickup</button></div></div>' +
        '<p class="disclaimer"><i class="fas fa-circle-info"></i> The big number is the latest price posted by a Malaysian recycler (mostly Uncle Recycle, Johor Bahru, list of 11 Sep 2026). The range shows what other buyers and guides quote. Small kedai usually pay towards the low end; clean, sorted bulk gets the top. Tap any item to see its source.</p></section>';

    // ===== PICKUPS
    h += '<section id="pickups" class="page" data-title="Pickups"><div class="page-head"><div><h2>Group pickups</h2>' +
        '<p class="muted">Share one delivery with neighbours. Everyone\'s bags are tagged, so everyone gets paid for their own rubbish.</p></div>' +
        '<div class="btn-row" style="margin:0"><button class="btn btn-ghost" onclick="logDropOff()"><i class="fas fa-box-open"></i> Drop off myself</button>' +
        '<button class="btn btn-primary" onclick="createGroupPickup()"><i class="fas fa-plus"></i> Create group</button></div></div>' +
        '<div class="card tag-explainer"><div class="tag-explainer-head"><div class="card-title"><i class="fas fa-tags"></i> How we know whose rubbish is whose</div>' +
        '<button class="link-btn" onclick="openChat(\'How do we know whose rubbish is whose in a group pickup?\')"><i class="fas fa-robot"></i> Explain more</button></div><div class="tag-steps">' +
        '<div class="tag-step"><span class="num">1</span><div><strong>You get a colour + code</strong><small>Join a group and you become e.g.</small><div class="mt-8"><span class="tag-chip" style="--tag:#1e88e5"><span class="tag-dot"></span>KL7Q-02 <small>Blue</small></span></div></div></div>' +
        '<div class="tag-step"><span class="num">2</span><div><strong>Every bag gets a code</strong><small>List each bag you bring. Print the QR labels or write the code with a marker.</small><div class="mini-label mt-8" style="--tag:#1e88e5"><b>KL7Q-02-B1</b><span>Cardboard &middot; 6 kg</span></div></div></div>' +
        '<div class="tag-step"><span class="num">3</span><div><strong>Organiser checks bags in</strong><small>On pickup day they scan or type each code on the manifest and enter the real weight.</small></div></div>' +
        '<div class="tag-step"><span class="num">4</span><div><strong>Fair split</strong><small>You\'re paid for your own bags (weight &times; price). The delivery fee is split by weight.</small></div></div></div></div>' +
        '<div class="tabs"><button class="tab active" data-tab="nearby" onclick="switchPickupTab(\'nearby\')">Open groups <span class="count">' + openGroups.length + '</span></button>' +
        '<button class="tab" data-tab="mine" onclick="switchPickupTab(\'mine\')">My pickups &amp; tags <span class="count">' + myGroups.length + '</span></button></div>';
    h += '<div class="tab-panel active" id="tab-nearby"><div class="sort-row"><span class="muted small" id="groupSortNote">Sorted by date</span><div class="seg">' +
        '<button class="active" data-gsort="date" onclick="sortGroups(\'date\')"><i class="fas fa-calendar"></i> Soonest</button>' +
        '<button data-gsort="near" onclick="sortGroups(\'near\')"><i class="fas fa-location-dot"></i> Nearest</button></div></div><div class="group-grid">' +
        each(openGroups, function (g) {
            var isMember = myGroupIds.indexOf(g.id) >= 0, isFull = g.current_participants >= g.max_participants, spots = Math.max(0, g.max_participants - g.current_participants);
            return '<div class="group-card" data-lat="' + e(g.center_lat) + '" data-lng="' + e(g.center_lng) + '" data-date="' + e(g.pickup_date + ' ' + g.pickup_time) + '">' +
                '<div class="group-top"><div class="group-code">' + e(g.group_code) + '</div>' + statusChip(g.status) + (isMember ? '<span class="chip chip-blue">You\'re in</span>' : '') +
                '<span class="chip chip-dist ml-auto" data-gdist hidden></span></div>' +
                '<div class="group-center">' + e(g.center_name) + '</div><div class="group-meta"><i class="fas fa-location-dot"></i> ' + e(g.center_address) + '</div>' +
                '<div class="group-meta"><i class="fas fa-clock"></i> ' + date('D, M d', g.pickup_date) + ' at ' + date('h:i A', g.pickup_date + ' ' + g.pickup_time) + '</div>' +
                (g.meeting_point ? '<div class="group-meta"><i class="fas fa-flag"></i> ' + e(g.meeting_point) + '</div>' : '') +
                '<div class="group-fill"><div class="fill-bar"><span style="width:' + Math.min(100, Math.round(g.current_participants / Math.max(1, g.max_participants) * 100)) + '%"></span></div>' +
                '<small>' + g.current_participants + '/' + g.max_participants + ' people &middot; ' + nf(g.estimated_total_weight, 1) + ' kg &middot; ' + (isFull ? 'full' : spots + ' spots left') + '</small></div>' +
                '<div class="btn-row">' + (!isMember && !isFull ? '<button class="btn btn-primary btn-sm" onclick="joinGroup(' + g.id + ')"><i class="fas fa-handshake"></i> Join</button>' : '') +
                '<button class="btn btn-ghost btn-sm" onclick="viewGroupDetails(' + g.id + ')"><i class="fas fa-circle-info"></i> Details</button>' +
                '<button class="btn btn-ghost btn-sm" onclick="shareGroup(' + g.id + ', \'' + e(g.group_code) + '\')"><i class="fas fa-share-nodes"></i> Invite</button></div></div>';
        }) + '</div>' +
        (openGroups.length ? '' : '<div class="card empty-state"><i class="fas fa-users"></i>No open group pickups right now.<div class="btn-row center"><button class="btn btn-primary btn-sm" onclick="createGroupPickup()"><i class="fas fa-plus"></i> Create one</button></div></div>') +
        '</div>';
    h += '<div class="tab-panel" id="tab-mine">' +
        each(myGroups, function (g) {
            var isOrganiser = g.creator_id === userId, bags = myBags[g.id] || [], active = ['open', 'full', 'collected'].indexOf(g.status) >= 0;
            return '<div class="card my-group"><div class="my-group-head"><div><div class="group-top"><div class="group-code">' + e(g.group_code) + '</div>' + statusChip(g.status) +
                (isOrganiser ? '<span class="chip chip-gold"><i class="fas fa-crown"></i> Organiser</span>' : '') + '</div>' +
                '<div class="group-center">' + e(g.center_name) + '</div><div class="group-meta"><i class="fas fa-clock"></i> ' + date('l, M d', g.pickup_date) + ' at ' + date('h:i A', g.pickup_date + ' ' + g.pickup_time) + '</div></div>' +
                '<div class="my-tag"><small>Your tag</small>' + tagChip(g.tag_code, g.tag_color) + '</div></div><div class="bag-list">' +
                each(bags, function (b) {
                    return '<div class="bag" style="--tag:' + e(tagColorHex(g.tag_color)) + '">' + matIcon(b, 'bag-icon') + '<div><strong>' + e(b.bag_code) + '</strong><small>' + e(b.material_name) + ' &middot; ' +
                        (b.checked_in ? nf(b.actual_weight, 2) + ' kg weighed' : nf(b.estimated_weight, 2) + ' kg est.') + '</small></div>' +
                        (b.checked_in ? '<span class="chip chip-green"><i class="fas fa-check"></i> In</span>' : '') + '</div>';
                }) + '</div><div class="btn-row">' +
                '<a class="btn btn-primary btn-sm" href="#tags-' + g.id + '"><i class="fas fa-print"></i> Print my labels</a>' +
                (isOrganiser || isStaff ? '<a class="btn btn-dark btn-sm" href="#manifest-' + g.id + '"><i class="fas fa-clipboard-check"></i> Manifest &amp; check-in</a>' : '') +
                '<button class="btn btn-ghost btn-sm" onclick="viewGroupDetails(' + g.id + ')"><i class="fas fa-circle-info"></i> Details</button>' +
                (active && g.status !== 'collected' ? (isOrganiser ? '<button class="btn btn-danger-ghost btn-sm" onclick="cancelGroup(' + g.id + ')"><i class="fas fa-ban"></i> Cancel group</button>'
                    : '<button class="btn btn-danger-ghost btn-sm" onclick="leaveGroup(' + g.id + ')"><i class="fas fa-right-from-bracket"></i> Leave</button>') : '') +
                '</div></div>';
        }) +
        (myGroups.length ? '' : '<div class="card empty-state"><i class="fas fa-tags"></i>You haven\'t joined any pickups yet.<br>Join one and your bag tags will appear here.</div>') +
        '<div class="card"><div class="card-title"><i class="fas fa-box-open"></i> My solo drop-offs<button class="btn btn-ghost btn-sm ml-auto" onclick="logDropOff()"><i class="fas fa-plus"></i> Log drop-off</button></div>' +
        each(myDropOffs, function (d) {
            var st = { pending: ['Waiting to be weighed', 'chip-gold'], verified: ['Verified - payment pending', 'chip-blue'], paid: ['Paid', 'chip-green'], rejected: ['Not accepted', 'chip-red'] }[d.status] || [d.status, 'chip-gray'];
            return '<div class="list-row">' + matIcon(d) + '<div class="grow"><strong>' + e(d.material_name) + '</strong><small class="muted">' + e(d.center_name) + ' &middot; ' + (d.dropoff_date ? date('M d', d.dropoff_date) : '') + ' &middot; ' +
                (d.actual_weight != null ? nf(d.actual_weight, 2) + ' kg weighed' : nf(d.weight_kg, 2) + ' kg claimed') + '</small></div>' +
                '<div class="right"><span class="chip ' + st[1] + '">' + st[0] + '</span>' + (d.status === 'pending' ? '<small class="muted">~' + money(d.weight_kg * d.price_per_kg) + '</small>' : '') + '</div></div>';
        }) +
        (myDropOffs.length ? '' : '<div class="empty-state small"><i class="fas fa-box-open"></i>Dropped rubbish at a center yourself? Log it here to get paid.</div>') +
        '</div></div></section>';

    // ===== MAP
    h += '<section id="locator" class="page" data-title="Map"><div class="page-head"><div><h2>Recycling centers near you</h2>' +
        '<p class="muted">' + centers.length + ' centers in the Klang Valley &middot; uses your real location (GPS) to find the closest one</p></div>' +
        '<button class="btn btn-primary" onclick="getLocation()" id="locBtn"><i class="fas fa-location-crosshairs"></i> Get my location</button></div>' +
        '<div id="locBanner" class="banner info"><i class="fas fa-circle-info"></i> <span>Tap <strong>Get my location</strong> and allow location access to sort centers by distance.</span></div>' +
        '<div class="map-layout"><div class="map-col"><div class="card map-card"><div class="map-wrap"><div id="map"></div><div class="map-controls">' +
        '<button class="map-ctrl" onclick="getLocation()" title="My location" aria-label="Go to my location"><i class="fas fa-location-crosshairs"></i></button>' +
        '<button class="map-ctrl" onclick="fitAllCenters()" title="Show all centers" aria-label="Show all centers"><i class="fas fa-expand"></i></button>' +
        '<button class="map-ctrl" onclick="nextMapStyle()" title="Map not showing? Change map" aria-label="Change map"><i class="fas fa-layer-group"></i></button></div>' +
        '<div class="map-fallback" id="mapFallback" hidden><i class="fas fa-map"></i><span>The map could not load. Check your internet connection - the list still works.</span></div></div><div class="coords" id="locCoords"></div></div>' +
        '<div class="nearest-box" id="nearestBox"><div class="nearest-main"><div class="nearest-label"><i class="fas fa-star"></i> Nearest center</div><div class="nearest-name" id="nearestName">-</div><div class="nearest-addr" id="nearestAddr">-</div>' +
        '<div class="nearest-actions"><a class="btn btn-light btn-sm" id="nearestDir" target="_blank" rel="noopener"><i class="fas fa-diamond-turn-right"></i> Directions</a>' +
        '<button class="btn btn-outline-light btn-sm" id="nearestPickup"><i class="fas fa-truck-ramp-box"></i> Create pickup here</button></div></div>' +
        '<div class="nearest-dist-wrap"><div class="nearest-dist" id="nearestDist">-</div><div class="nearest-label" id="nearestEta"></div></div></div></div>' +
        '<div class="card list-col"><div class="card-title"><i class="fas fa-list"></i> All centers <span class="muted small ml-auto" id="centerCount">' + centers.length + ' centers</span></div>' +
        '<div class="search-box mb-12"><i class="fas fa-magnifying-glass"></i><input type="search" id="centerSearch" placeholder="Search by name or area" oninput="filterCenters()"></div><div class="chip-row" id="centerChips">' +
        each([['all', 'All'], ['plastic', 'Plastic'], ['paper', 'Paper'], ['metal', 'Metal'], ['glass', 'Glass'], ['e-waste', 'E-Waste']], function (k) {
            return '<button class="chip-btn ' + (k[0] === 'all' ? 'active' : '') + '" data-mat="' + k[0] + '" onclick="setCenterFilter(this)">' + k[1] + '</button>';
        }) + '<label class="chip-btn chip-check"><input type="checkbox" id="openNowOnly" onchange="filterCenters()"> Open now</label></div><div id="centerList">' +
        each(centers, function (c) {
            return '<div class="center-item" data-id="' + c.id + '" data-lat="' + e(c.latitude) + '" data-lng="' + e(c.longitude) + '" data-search="' + e((c.name + ' ' + c.city + ' ' + c.address).toLowerCase()) + '"' +
                ' data-accepts="' + e(String(c.accepted_materials || '').toLowerCase()) + '" data-hours="' + e(c.operating_hours) + '">' +
                '<button class="center-icon" onclick="focusCenter(' + c.id + ')" title="Show on map"><i class="fas fa-warehouse"></i></button>' +
                '<div class="center-info" onclick="focusCenter(' + c.id + ')"><h4>' + e(c.name) + ' <span class="rating"><i class="fas fa-star"></i> ' + nf(c.rating, 1) + '</span></h4>' +
                '<p><i class="fas fa-location-dot"></i> ' + e(c.address) + ', ' + e(c.city) + '</p><p><i class="fas fa-clock"></i> <span class="open-badge" data-open></span> ' + e(c.operating_hours) + '</p>' +
                '<p><i class="fas fa-recycle"></i> ' + e(c.accepted_materials) + '</p></div><div class="center-side"><div class="dist" id="dist_' + c.id + '"></div><div class="center-btns">' +
                '<button class="icon-btn small" onclick="copyText(\'' + js(c.phone) + '\')" title="Copy phone ' + e(c.phone) + '"><i class="fas fa-phone"></i></button>' +
                '<a class="icon-btn small" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&amp;destination=' + e(c.latitude + ',' + c.longitude) + '" title="Directions"><i class="fas fa-diamond-turn-right"></i></a></div></div></div>';
        }) + '<div class="empty-state small" id="centerEmpty" hidden><i class="fas fa-warehouse"></i>No centers match.</div></div></div></div></section>';

    // ===== REWARDS
    h += '<section id="rewards" class="page" data-title="Rewards"><div class="reward-summary"><div class="reward-total"><small>Available points</small>' +
        '<div class="reward-total-amount" id="pointsBalance">' + nf(rewardPoints) + '</div><small>' + CFG.POINTS_PER_KG + ' points for every kg you recycle</small></div>' +
        '<div class="reward-level"><div class="level-badge level-' + level.toLowerCase() + '"><i class="fas fa-medal"></i> ' + e(level) + '</div>' +
        (nextLevel ? '<div class="level-bar"><span style="width:' + levelProgress + '%"></span></div><small>' + nf(nextAt - rewardPoints) + ' points to ' + nextLevel + '</small>' : '<small>Top level reached!</small>') +
        '</div></div><div class="card"><div class="card-title"><i class="fas fa-store"></i> Partner rewards</div><div class="partner-grid">' +
        each(partnerRewards, function (r) {
            var can = rewardPoints >= r.points_required;
            return '<div class="partner-card"><div class="partner-art" style="--brand:' + e(r.brand_color) + '"><i class="fas ' + e(r.icon) + '"></i>' + (r.badge ? '<span class="partner-badge">' + e(r.badge) + '</span>' : '') + '</div>' +
                '<div class="partner-body"><div class="partner-brand">' + e(r.partner_name) + '</div><div class="partner-title">' + e(r.discount_value) + '</div><div class="partner-desc">' + e(r.description) + '</div>' +
                '<button class="btn btn-sm full ' + (can ? 'btn-primary' : 'btn-ghost') + '" onclick="redeemReward(' + r.id + ', ' + r.points_required + ', \'' + js(r.partner_name + ' ' + r.discount_value) + '\')">' +
                nf(r.points_required) + ' pts ' + (can ? '' : '<i class="fas fa-lock"></i>') + '</button></div></div>';
        }) + '</div>' + (partnerRewards.length ? '' : '<div class="empty-state">No partner rewards at the moment.</div>') + '</div>';
    h += '<div class="grid-2"><div class="card"><div class="card-title"><i class="fas fa-ticket"></i> My redemptions</div>' +
        each(userRedemptions, function (r) {
            return '<div class="list-row"><span class="mat-icon" style="background:' + e(r.brand_color) + ';color:#fff"><i class="fas ' + e(r.icon) + '"></i></span><div class="grow">' +
                '<strong>' + e(r.partner_name) + ' &middot; ' + e(r.discount_value) + '</strong><small class="muted">Code <b class="mono">' + e(r.redemption_code) + '</b> &middot; until ' + date('M d', r.expires_at) + '</small></div>' +
                '<button class="icon-btn small" onclick="copyText(\'' + e(r.redemption_code) + '\')" title="Copy code"><i class="fas fa-copy"></i></button></div>';
        }) + (userRedemptions.length ? '' : '<div class="empty-state small"><i class="fas fa-receipt"></i>No redemptions yet.</div>') + '</div>';
    h += '<div class="card"><div class="card-title"><i class="fas fa-trophy"></i> Top recyclers</div><div class="podium">' +
        each([1, 0, 2], function (i) {
            var p = leaderboard[i]; if (!p) return '';
            var heights = [100, 74, 56], medals = ['gold', 'silver', 'bronze'];
            return '<div class="podium-item">' + avatarHtml(p, 'avatar avatar-lg') + '<div class="podium-name">' + e(p.username) + '</div><div class="podium-pts">' + nf(p.total_points) + ' pts</div>' +
                '<div class="podium-block ' + medals[i] + '" style="height:' + heights[i] + 'px">' + (i + 1) + '</div></div>';
        }) + '</div>' +
        each(leaderboard.slice(3, 10), function (p, idx) {
            var mine = p.user_id === userId;
            return '<div class="leader-row ' + (mine ? 'me' : '') + '"><span class="leader-rank">' + (idx + 4) + '</span>' + avatarHtml(p, 'avatar avatar-sm') +
                '<span class="grow">' + e(p.username) + (mine ? ' <small class="you">(you)</small>' : '') + '</span><span class="muted small">' + nf(p.total_points) + '</span></div>';
        }) +
        '<div class="leader-row me"><span class="leader-rank">' + rank + '</span>' + avatarHtml(user, 'avatar avatar-sm') + '<span class="grow">You</span><span class="muted small">' + nf(rewardPoints) + '</span></div></div></div></section>';

    // ===== PROFILE
    h += '<section id="profile" class="page" data-title="Profile"><div class="profile-header"><div class="profile-avatar-wrap">' + avatarHtml(user, 'avatar avatar-xl') +
        '<button class="avatar-edit" onclick="openEditProfile()" title="Change photo"><i class="fas fa-camera"></i></button></div>' +
        '<div class="profile-main"><div class="profile-name">' + e(displayName) + '</div><div class="profile-handle">@' + e(username) + (user.city ? ' &middot; <i class="fas fa-location-dot"></i> ' + e(user.city) : '') + '</div>' +
        (user.bio ? '<div class="profile-bio">' + e(user.bio) + '</div>' : '') +
        '<div class="btn-row"><button class="btn btn-light btn-sm" onclick="openEditProfile()"><i class="fas fa-pen"></i> Edit profile</button>' +
        '<button class="btn btn-outline-light btn-sm" onclick="openChangePassword()"><i class="fas fa-key"></i> Password</button></div></div>' +
        '<div class="profile-stats"><div><strong>' + nf(rewardPoints) + '</strong><small>Points</small></div><div><strong>' + e(level) + '</strong><small>Level</small></div>' +
        '<div><strong>' + timesRecycled + '</strong><small>Pickups</small></div><div><strong>' + nf(carbonSaved, 1) + '</strong><small>kg CO&#8322; saved</small></div></div></div>';
    h += '<div class="grid-2"><div class="card"><div class="card-title"><i class="fas fa-id-card"></i> Account details<button class="link-btn ml-auto" onclick="openEditProfile()">Edit</button></div><dl class="details">' +
        '<dt>Full name</dt><dd>' + e(user.full_name || '-') + '</dd><dt>Email</dt><dd>' + e(user.email) + '</dd><dt>Phone</dt><dd>' + e(user.phone || '-') + '</dd>' +
        '<dt>Pickup address</dt><dd>' + e(user.address || 'Not set - add one to join groups faster') + '</dd><dt>Member since</dt><dd>' + date('M Y', user.created_at) + '</dd></dl></div>';
    h += '<div class="card"><div class="card-title"><i class="fas fa-wallet"></i> Payment methods<button class="btn btn-primary btn-sm ml-auto" onclick="addPaymentMethod()"><i class="fas fa-plus"></i> Add</button></div>' +
        each(paymentMethods, function (m) {
            var icon = m.payment_type === 'bank' ? 'fa-building-columns' : (m.payment_type === 'tng' ? 'fa-mobile-screen-button' : 'fa-wallet');
            var title = m.payment_type === 'bank' ? m.bank_name : (m.payment_type === 'tng' ? "Touch 'n Go eWallet" : 'GrabPay');
            var sub = m.payment_type === 'bank' ? m.account_name + ' · ' + maskAccount(m.account_number) : m.tng_phone;
            return '<div class="list-row"><span class="mat-icon cat-pay"><i class="fas ' + icon + '"></i></span><div class="grow"><strong>' + e(title) + '</strong>' +
                (m.is_default ? '<span class="chip chip-green">Default</span>' : '') + '<small class="muted">' + e(sub) + '</small></div>' +
                (m.is_default ? '' : '<button class="link-btn" onclick="setDefaultPayment(' + m.id + ')">Make default</button>') +
                '<button class="icon-btn small danger" onclick="removePayment(' + m.id + ')" title="Remove"><i class="fas fa-trash"></i></button></div>';
        }) + (paymentMethods.length ? '' : '<div class="empty-state small"><i class="fas fa-wallet"></i>Add Touch \'n Go, GrabPay or a bank account to receive payments.</div>') + '</div></div>';
    h += '<div class="grid-2"><div class="card"><div class="card-title"><i class="fas fa-clock-rotate-left"></i> Payment history</div>' +
        each(paymentTransactions, function (t) {
            var done = t.status === 'completed';
            return '<div class="list-row"><span class="mat-icon ' + (done ? 'cat-paid' : 'cat-pending') + '"><i class="fas ' + (done ? 'fa-check' : 'fa-hourglass-half') + '"></i></span><div class="grow">' +
                '<strong>' + e(t.material_type) + '</strong><small class="muted">' + nf(t.weight_kg, 2) + ' kg &middot; ' + date('M d, h:i A', t.created_at) + '</small></div>' +
                '<div class="right"><strong class="amount">+' + money(t.amount) + '</strong><small class="' + (done ? 'text-green' : 'text-amber') + '">' + (done ? 'Paid' : 'Pending') + '</small></div></div>';
        }) + (paymentTransactions.length ? '' : '<div class="empty-state small">No payments yet. Complete a pickup to get paid!</div>') + '</div>';
    h += '<div class="card"><div class="card-title"><i class="fas fa-sliders"></i> Settings</div>' +
        '<div class="setting-row"><div><strong>Dark mode</strong><small class="muted">Easier on the eyes at night</small></div><label class="switch"><input type="checkbox" id="darkToggle" onchange="toggleTheme()"><span></span></label></div>' +
        '<div class="setting-row"><div><strong>EcoBot chat history</strong><small class="muted">Delete your saved conversation</small></div><button class="btn btn-ghost btn-sm" onclick="clearChat()">Clear</button></div>' +
        '<div class="setting-row"><div><strong>Notifications</strong><small class="muted">' + unreadCount + ' unread</small></div><button class="btn btn-ghost btn-sm" onclick="toggleNotifs(event)">Open</button></div>' +
        '<div class="setting-row"><div><strong>Demo data</strong><small class="muted">Everything is saved in this browser only. Start again from the sample data.</small></div><button class="btn btn-ghost btn-sm" onclick="resetDemoData()"><i class="fas fa-rotate-left"></i> Reset</button></div>' +
        '<form class="setting-row" onsubmit="event.preventDefault(); logoutNow();"><div><strong>Sign out</strong><small class="muted">Signed in as ' + e(user.email) + '</small></div>' +
        '<button class="btn btn-danger-ghost btn-sm" type="submit"><i class="fas fa-right-from-bracket"></i> Log out</button></form></div></div></section>';

    h += '</main></div>';
    // ----- bottom nav
    h += '<nav class="bottom-nav"><button data-page="home" class="active"><i class="fas fa-house"></i><span>Home</span></button>' +
        '<button data-page="prices"><i class="fas fa-tags"></i><span>Prices</span></button><button data-page="pickups"><i class="fas fa-truck-ramp-box"></i><span>Pickups</span></button>' +
        '<button data-page="locator"><i class="fas fa-map-location-dot"></i><span>Map</span></button><button data-page="rewards"><i class="fas fa-gift"></i><span>Rewards</span></button>' +
        '<button data-page="profile"><i class="fas fa-user"></i><span>Profile</span></button></nav></div>';
    // ----- EcoBot
    h += '<button class="bot-fab" onclick="openChat()" aria-label="Ask EcoBot"><i class="fas fa-robot"></i></button>' +
        '<div class="chat-panel" id="chatPanel" aria-hidden="true"><div class="chat-head"><span class="bot-face"><i class="fas fa-robot"></i></span>' +
        '<div class="grow"><strong>EcoBot</strong><small id="chatMode">' + (window.EcoBot && window.EcoBot.aiReady ? 'AI assistant' : 'Offline assistant') + '</small></div>' +
        '<button class="icon-btn" onclick="clearChat()" title="Clear chat"><i class="fas fa-broom"></i></button><button class="icon-btn" onclick="closeChat()" title="Close"><i class="fas fa-xmark"></i></button></div>' +
        '<div class="chat-body" id="chatBody"><div class="msg bot"><div class="bubble">Hi ' + e(firstName) + '! I\'m <strong>EcoBot</strong>. Ask me how to send your rubbish, what something is worth, or how group pickups and bag tags work.</div></div></div>' +
        '<div class="chat-suggest" id="chatSuggest">' +
        each(["What's the first step to send my rubbish?", 'How do we know whose rubbish is whose?', 'How much for 5kg of cans?', 'What pays the most?', 'How is the delivery fee split?'], function (q) { return '<button onclick="sendChat(this.textContent)">' + e(q) + '</button>'; }) +
        '</div><form class="chat-input" onsubmit="event.preventDefault(); sendChat();"><input type="text" id="chatInput" placeholder="Ask anything about recycling..." autocomplete="off" maxlength="1000">' +
        '<button type="submit" aria-label="Send"><i class="fas fa-paper-plane"></i></button></form></div><div class="toast" id="toast"></div>';
    return h;
}

window.SWViews = { renderMain: renderMain, e: e, nf: nf, money: money, date: date, timeAgo: timeAgo, avatarHtml: avatarHtml, matIcon: matIcon, tagChip: tagChip, statusChip: statusChip, tagColorHex: tagColorHex, each: each, js: js };
})();
