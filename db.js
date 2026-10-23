/* =========================================================
   SmartWaste - in-browser "server"
   Replaces PHP + MySQL: the same tables and the same rules as
   auth.php and the *.php endpoints, kept in the browser's storage.
   Every page calls LocalAPI('endpoint.php', data) exactly where the
   PHP version called fetch('endpoint.php').
   ========================================================= */
(function () {
'use strict';

var STORE_KEY = 'smartwaste-db-v3';
var SESSION_KEY = 'smartwaste-session';

// ---------- settings (same as config.php) ----------
var CFG = {
    DELIVERY_BASE_FEE: 5.00, DELIVERY_FREE_KG: 10, DELIVERY_PER_KG: 0.20,
    POINTS_PER_KG: 10, CHALLENGE_KG: 5, CHALLENGE_POINTS: 100
};
var TAG_COLORS = { Red: '#e53935', Blue: '#1e88e5', Yellow: '#fdd835', Green: '#43a047', Purple: '#8e24aa', Orange: '#fb8c00', Pink: '#ec407a', Grey: '#78909c' };

// ---------- tiny SHA-256 (for password hashes) ----------
function sha256(str) {
    function rr(v, n) { return (v >>> n) | (v << (32 - n)); }
    var s = unescape(encodeURIComponent(str)), i, j, words = [], bitLen = s.length * 8;
    var K = [], H = [], primeCounter = 0, isComposite = {};
    for (var cand = 2; primeCounter < 64; cand++) {
        if (!isComposite[cand]) {
            for (i = 0; i < 313; i += cand) isComposite[i] = cand;
            if (primeCounter < 8) H[primeCounter] = (Math.pow(cand, .5) * 4294967296) | 0;
            K[primeCounter++] = (Math.pow(cand, 1 / 3) * 4294967296) | 0;
        }
    }
    s += '\x80';
    while (s.length % 64 - 56) s += '\x00';
    for (i = 0; i < s.length; i++) {
        j = s.charCodeAt(i);
        words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words.length] = ((bitLen / Math.pow(2, 32)) | 0);
    words[words.length] = (bitLen);
    for (j = 0; j < words.length;) {
        var w = words.slice(j, j += 16), oldHash = H;
        H = H.slice(0, 8);
        for (i = 0; i < 64; i++) {
            var w15 = w[i - 15], w2 = w[i - 2], a = H[0], e = H[4];
            var temp1 = H[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & H[5]) ^ ((~e) & H[6])) + K[i] +
                (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
            var temp2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & H[1]) ^ (a & H[2]) ^ (H[1] & H[2]));
            H = [(temp1 + temp2) | 0].concat(H);
            H[4] = (H[4] + temp1) | 0;
        }
        for (i = 0; i < 8; i++) H[i] = (H[i] + oldHash[i]) | 0;
    }
    var out = '';
    for (i = 0; i < 8; i++) for (j = 3; j + 1; j--) { var b = (H[i] >> (j * 8)) & 255; out += (b < 16 ? '0' : '') + b.toString(16); }
    return out;
}
function hashPassword(p) { return 'sha256$' + sha256(String(p)); }
function checkPassword(p, stored) { return !!stored && stored === hashPassword(p); }

// ---------- dates ----------
function pad(n) { return String(n).padStart(2, '0'); }
function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function stamp(d) { d = d || new Date(); return ymd(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
function today() { return ymd(new Date()); }
function parseDate(s) {
    if (!s) return null;
    var m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (!m) return new Date(s);
    return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
}
function addDays(dateStr, n) { var d = parseDate(dateStr); d.setDate(d.getDate() + n); return ymd(d); }
function weekStart() { var d = new Date(); var day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return ymd(d); }

// ---------- storage ----------
var DB = null, memoryOnly = false;
function emptyCopy(seed) { return JSON.parse(JSON.stringify(seed)); }

function shiftDates(db) {
    // the demo data was exported on SEED.exportedAt; move every date so it feels current
    var from = parseDate(db.exportedAt), to = parseDate(today());
    var days = Math.round((to - from) / 86400000);
    if (!days) return;
    var re = /^(\d{4}-\d{2}-\d{2})(.*)$/;
    Object.keys(db).forEach(function (t) {
        if (!Array.isArray(db[t])) return;
        db[t].forEach(function (row) {
            Object.keys(row).forEach(function (k) {
                var v = row[k];
                if (typeof v === 'string') {
                    var m = v.match(re);
                    if (m) row[k] = addDays(m[1], days) + m[2];
                }
            });
        });
    });
}
function freshDB() {
    var db = emptyCopy(window.SEED);
    shiftDates(db);
    ['chat_messages', 'user_redemptions', 'point_transactions', 'price_history', 'system_logs'].forEach(function (t) { db[t] = db[t] || []; });
    db.seq = {};
    return db;
}
function load() {
    try {
        var raw = localStorage.getItem(STORE_KEY);
        if (raw) { DB = JSON.parse(raw); return; }
    } catch (e) { memoryOnly = true; }
    DB = freshDB();
    save();
}
function save() {
    if (memoryOnly) return;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(DB)); }
    catch (e) { memoryOnly = true; }
}
function resetDemo() {
    try { localStorage.removeItem(STORE_KEY); localStorage.removeItem(SESSION_KEY); } catch (e) {}
    DB = freshDB(); save(); session = null;
}

// ---------- table helpers ----------
function T(name) { if (!DB[name]) DB[name] = []; return DB[name]; }
function nextId(name) {
    var max = 0; T(name).forEach(function (r) { if (r.id > max) max = r.id; });
    DB.seq[name] = Math.max(DB.seq[name] || 0, max) + 1;
    return DB.seq[name];
}
function insert(name, row) { row.id = nextId(name); T(name).push(row); return row; }
function byId(name, id) { id = +id; return T(name).filter(function (r) { return r.id === id; })[0] || null; }
function where(name, fn) { return T(name).filter(fn); }
function num(v) { return +v || 0; }
function round2(n) { return Math.round(n * 100) / 100; }
function money(n) { return 'RM ' + num(n).toFixed(2); }

// ---------- session ----------
var session = null;
function loadSession() { try { session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch (e) {} }
function setSession(u) {
    session = u ? { user_id: u.id, username: u.username, role: u.role } : null;
    try { if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session)); else localStorage.removeItem(SESSION_KEY); } catch (e) {}
}
function me() { return session ? byId('users', session.user_id) : null; }
function myId() { return session ? session.user_id : 0; }
function role() { var u = me(); return u ? u.role : ''; }
function isAdmin() { return role() === 'admin'; }

// ==========================================
// QUERIES (auth.php)
// ==========================================
function rewardsOf(uid) {
    var r = where('user_rewards', function (x) { return x.user_id === uid; })[0];
    if (!r) r = insert('user_rewards', { user_id: uid, total_points: 0, carbon_saved: 0, items_scanned: 0, times_recycled: 0, total_weight_kg: 0, total_earned: 0, current_streak: 0, longest_streak: 0, last_scan_date: null, level: 'Bronze' });
    return r;
}
function getCurrentUser() {
    var u = me(); if (!u) return null;
    var r = rewardsOf(u.id), out = Object.assign({}, u);
    ['total_points', 'carbon_saved', 'items_scanned', 'times_recycled', 'total_weight_kg', 'total_earned', 'current_streak', 'level'].forEach(function (k) { out[k] = r[k]; });
    return out;
}
function categoryLabel(c) {
    return { metal: 'Metal', plastic: 'Plastic', paper: 'Paper', glass: 'Glass', e_waste: 'E-Waste', organic: 'Organic', other: 'Other' }[c] || (c.charAt(0).toUpperCase() + c.slice(1));
}
function getMaterials() {
    return where('material_prices', function (m) { return m.is_active; }).slice().sort(function (a, b) {
        return a.category < b.category ? -1 : a.category > b.category ? 1 : b.price_per_kg - a.price_per_kg;
    });
}
function leaderboard() {
    var rows = where('users', function (u) { return u.role === 'user'; }).map(function (u) {
        var r = rewardsOf(u.id);
        return { user_id: u.id, username: u.username, full_name: u.full_name, profile_pic: u.profile_pic, avatar_color: u.avatar_color, total_points: r.total_points, level: r.level };
    }).sort(function (a, b) { return b.total_points - a.total_points; });
    rows.forEach(function (r, i) { r.rank_position = i + 1; });
    return rows;
}
function rankOf(points) {
    return 1 + where('users', function (u) { return u.role === 'user' && rewardsOf(u.id).total_points > points; }).length;
}
function center(id) { return byId('recycling_centers', id); }
function material(id) { return byId('material_prices', id); }
function getGroup(id) {
    var g = byId('group_pickups', id); if (!g) return null;
    var c = center(g.center_id), u = byId('users', g.creator_id);
    return Object.assign({}, g, { center_name: c.name, center_address: c.address, center_phone: c.phone, center_city: c.city, center_lat: c.latitude, center_lng: c.longitude, creator_name: u ? u.username : '?' });
}
function getGroupParticipants(gid) {
    return where('group_pickup_participants', function (p) { return p.group_pickup_id === +gid && p.status !== 'cancelled'; })
        .sort(function (a, b) { return a.participant_no - b.participant_no; })
        .map(function (p) {
            var u = byId('users', p.user_id) || {};
            var items = where('group_pickup_items', function (i) { return i.participant_id === p.id; })
                .sort(function (a, b) { return a.bag_no - b.bag_no; })
                .map(function (i) {
                    var m = material(i.material_id) || {};
                    return Object.assign({}, i, { material_name: m.material_name, icon: m.icon, art: m.art, resin_code: m.resin_code, price_per_kg: m.price_per_kg, category: m.category });
                });
            return Object.assign({}, p, { username: u.username, full_name: u.full_name, phone: u.phone, profile_pic: u.profile_pic, avatar_color: u.avatar_color, items: items, tag_hex: TAG_COLORS[p.tag_color] || '#78909c' });
        });
}
function deliveryCost(kg) { return CFG.DELIVERY_BASE_FEE + Math.max(0, (kg - CFG.DELIVERY_FREE_KG) * CFG.DELIVERY_PER_KG); }
function calculateGroupSplit(gid, participants) {
    participants = participants || getGroupParticipants(gid);
    var totalKg = 0, rows = [];
    participants.forEach(function (p) {
        var kg = 0, value = 0, bags = 0, checked = 0;
        p.items.forEach(function (it) {
            var w = (it.checked_in && it.actual_weight != null) ? num(it.actual_weight) : num(it.estimated_weight);
            kg += w; value += w * num(it.price_per_kg); bags++; if (it.checked_in) checked++;
        });
        totalKg += kg;
        rows.push({ participant_id: p.id, user_id: p.user_id, username: p.username, tag_code: p.tag_code, tag_color: p.tag_color, tag_hex: TAG_COLORS[p.tag_color] || '#78909c', kg: round2(kg), value: round2(value), bags: bags, checked: checked });
    });
    var fee = deliveryCost(totalKg), n = rows.length;
    rows.forEach(function (r) {
        var share = totalKg > 0 ? fee * (r.kg / totalKg) : (n ? fee / n : fee);
        r.delivery_share = round2(share);
        r.net = round2(r.value - share);
        r.savings = round2(Math.max(0, deliveryCost(r.kg) - share));
    });
    return { total_kg: round2(totalKg), delivery_fee: round2(fee), participants: rows, total_value: round2(rows.reduce(function (a, r) { return a + r.value; }, 0)) };
}
function refreshGroupTotals(gid) {
    var g = byId('group_pickups', gid);
    var ps = where('group_pickup_participants', function (p) { return p.group_pickup_id === +gid && p.status !== 'cancelled'; });
    g.current_participants = ps.length;
    g.estimated_total_weight = round2(ps.reduce(function (a, p) { return a + num(p.estimated_weight); }, 0));
    if (g.status === 'open' && g.current_participants >= g.max_participants) g.status = 'full';
    if (g.status === 'full' && g.current_participants < g.max_participants) g.status = 'open';
}
function getUserGroups(uid) {
    return where('group_pickup_participants', function (p) { return p.user_id === uid && p.status !== 'cancelled'; })
        .map(function (p) {
            var g = getGroup(p.group_pickup_id);
            if (!g || g.status === 'cancelled') return null;
            return Object.assign(g, { tag_code: p.tag_code, tag_color: p.tag_color, my_weight: p.estimated_weight, participant_id: p.id });
        }).filter(Boolean)
        .sort(function (a, b) { return (a.pickup_date + a.pickup_time) < (b.pickup_date + b.pickup_time) ? -1 : 1; });
}
function bagsOf(participantId) {
    return where('group_pickup_items', function (i) { return i.participant_id === participantId; })
        .sort(function (a, b) { return a.bag_no - b.bag_no; })
        .map(function (i) { var m = material(i.material_id) || {}; return Object.assign({}, i, { material_name: m.material_name, icon: m.icon, art: m.art, resin_code: m.resin_code, category: m.category }); });
}
function openGroups() {
    var t = today();
    return T('group_pickups').filter(function (g) { return (g.status === 'open' || g.status === 'full') && g.pickup_date >= t; })
        .map(function (g) { return getGroup(g.id); })
        .sort(function (a, b) { return (a.pickup_date + a.pickup_time) < (b.pickup_date + b.pickup_time) ? -1 : 1; })
        .slice(0, 12);
}
function canManageGroup(g) { return !!g && (g.creator_id === myId() || role() === 'admin' || role() === 'collector'); }

// ---------- notifications ----------
function addNotification(uid, title, message, type, icon, link) {
    insert('notifications', { user_id: uid, title: title, message: message, type: type || 'info', is_read: 0, link: link || null, icon: icon || 'fa-bell', created_at: stamp() });
}
function getNotifications(uid, limit) {
    return where('notifications', function (n) { return n.user_id === uid; })
        .sort(function (a, b) { return a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : b.id - a.id; })
        .slice(0, limit || 20);
}
function logAction(uid, action, details) { insert('system_logs', { user_id: uid, action: action, details: details || '', created_at: stamp() }); }

// ---------- weekly challenge ----------
function weeklyPlasticKg(uid) {
    var monday = weekStart(), kg = 0;
    T('group_pickup_items').forEach(function (i) {
        var p = byId('group_pickup_participants', i.participant_id); if (!p || p.user_id !== uid) return;
        var g = byId('group_pickups', p.group_pickup_id), m = material(i.material_id);
        if (g && g.status === 'completed' && m && m.category === 'plastic' && i.checked_in && i.checked_at && i.checked_at >= monday) kg += num(i.actual_weight);
    });
    T('drop_offs').forEach(function (d) {
        var m = material(d.material_id);
        if (d.user_id === uid && (d.status === 'verified' || d.status === 'paid') && m && m.category === 'plastic' && d.verified_at && d.verified_at >= monday) kg += num(d.actual_weight);
    });
    return round2(kg);
}
function challengeDone(uid) {
    var monday = weekStart();
    return T('point_transactions').some(function (p) { return p.user_id === uid && p.source === 'challenge' && p.created_at >= monday; });
}
function checkWeeklyChallenge(uid) {
    if (challengeDone(uid) || weeklyPlasticKg(uid) < CFG.CHALLENGE_KG) return false;
    rewardsOf(uid).total_points += CFG.CHALLENGE_POINTS;
    insert('point_transactions', { user_id: uid, amount: CFG.CHALLENGE_POINTS, type: 'earned', source: 'challenge', description: 'Weekly challenge: 5 kg of plastic', created_at: stamp() });
    addNotification(uid, 'Weekly challenge complete!', 'You recycled 5 kg of plastic this week. +' + CFG.CHALLENGE_POINTS + ' bonus points.', 'success', 'fa-trophy');
    refreshLevel(uid);
    return true;
}
function refreshLevel(uid) {
    var r = rewardsOf(uid), p = r.total_points;
    r.level = p >= 10000 ? 'Platinum' : p >= 5000 ? 'Gold' : p >= 2000 ? 'Silver' : 'Bronze';
}
function co2Factor(cat) { return { metal: 4.0, plastic: 1.5, paper: 0.9, glass: 0.3, e_waste: 2.0, organic: 0.2, other: 0.5 }[cat] || 0.5; }

// ---------- other lists ----------
function getUserDropOffs(uid) {
    return where('drop_offs', function (d) { return d.user_id === uid; })
        .sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; }).slice(0, 20)
        .map(function (d) { var m = material(d.material_id) || {}, c = center(d.center_id) || {}; return Object.assign({}, d, { material_name: m.material_name, art: m.art, resin_code: m.resin_code, category: m.category, price_per_kg: m.price_per_kg, center_name: c.name }); });
}
function getPartnerRewards() {
    var t = today();
    return where('partner_rewards', function (r) { return r.is_active && (!r.valid_until || r.valid_until > t); }).sort(function (a, b) { return a.points_required - b.points_required; });
}
function getUserRedemptions(uid) {
    return where('user_redemptions', function (r) { return r.user_id === uid; })
        .sort(function (a, b) { return a.redeemed_at < b.redeemed_at ? 1 : -1; }).slice(0, 10)
        .map(function (r) { var p = byId('partner_rewards', r.partner_reward_id) || {}; return Object.assign({}, r, { partner_name: p.partner_name, description: p.description, discount_value: p.discount_value, brand_color: p.brand_color, icon: p.icon }); });
}
function getPaymentMethods(uid) {
    return where('payment_methods', function (m) { return m.user_id === uid; })
        .sort(function (a, b) { return (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0) || (a.created_at < b.created_at ? 1 : -1); });
}
function getPaymentTransactions(uid, limit) {
    return where('payment_transactions', function (t) { return t.user_id === uid; })
        .sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; }).slice(0, limit || 10);
}

// ==========================================
// ENDPOINTS (the *.php files)
// ==========================================
function err(msg) { return { error: msg }; }
function needLogin() { return me() ? null : err('Not logged in'); }

function genGroupCode() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (var t = 0; t < 50; t++) {
        var c = ''; for (var i = 0; i < 4; i++) c += chars[Math.floor(Math.random() * chars.length)];
        if (!T('group_pickups').some(function (g) { return g.group_code === c; })) return c;
    }
    return 'G' + Date.now().toString(36).toUpperCase().slice(-5);
}
function parseBagItems(raw) {
    var items; try { items = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { items = null; }
    if (!Array.isArray(items) || !items.length) return err('Add at least one bag of rubbish');
    if (items.length > 10) return err('Maximum 10 bags per person');
    var clean = [], total = 0;
    for (var k = 0; k < items.length; k++) {
        var mid = parseInt(items[k].material_id, 10) || 0, w = round2(parseFloat(items[k].weight) || 0);
        if (mid <= 0) return err('Choose a material for every bag');
        if (w <= 0 || w > 500) return err('Each bag needs a weight between 0.1 and 500 kg');
        var m = material(mid); if (!m || !m.is_active) return err('Unknown material selected');
        clean.push({ material_id: mid, weight: w }); total += w;
    }
    return { items: clean, total: round2(total) };
}
function addParticipant(gid, code, uid, address, items, desc) {
    var no = 1 + Math.max(0, Math.max.apply(null, [0].concat(where('group_pickup_participants', function (p) { return p.group_pickup_id === gid; }).map(function (p) { return p.participant_no; }))));
    var names = Object.keys(TAG_COLORS), color = names[(no - 1) % names.length];
    var tag = code + '-' + pad(no), total = items.reduce(function (a, i) { return a + i.weight; }, 0);
    var p = insert('group_pickup_participants', { group_pickup_id: gid, user_id: uid, participant_no: no, tag_code: tag, tag_color: color, address: address, estimated_weight: round2(total), item_description: desc || null, status: 'accepted', joined_at: stamp() });
    items.forEach(function (it, i) {
        insert('group_pickup_items', { participant_id: p.id, material_id: it.material_id, bag_no: i + 1, bag_code: tag + '-B' + (i + 1), estimated_weight: it.weight, actual_weight: null, checked_in: 0, checked_at: null, notes: null });
    });
    return p;
}
function fmtDay(d) { var x = parseDate(d); return x.toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: '2-digit' }).replace(',', ','); }

var H = {};

H['login.php'] = function (d) {
    var id = String(d.username || '').trim().toLowerCase(), pw = String(d.password || '');
    var u = where('users', function (x) { return x.username.toLowerCase() === id || x.email.toLowerCase() === id; })[0];
    if (!u || !checkPassword(pw, u.password)) return err('Invalid username or password.');
    u.last_login = stamp(); setSession(u); logAction(u.id, 'login', 'Logged in');
    return { success: true };
};
H['logout.php'] = function () { setSession(null); return { success: true }; };
H['register.php'] = function (d) {
    var username = String(d.username || '').trim(), email = String(d.email || '').trim(), pw = String(d.password || '');
    if (!/^[A-Za-z0-9_.]{3,30}$/.test(username)) return err('Username must be 3-30 letters, numbers, _ or .');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return err('Please enter a valid email.');
    if (pw.length < 6) return err('Password must be at least 6 characters.');
    if (pw !== String(d.confirm || '')) return err('Passwords do not match.');
    if (T('users').some(function (u) { return u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === email.toLowerCase(); })) return err('That username or email is already registered.');
    var colors = ['#2f9e5b', '#1e88e5', '#8e24aa', '#fb8c00', '#d81b60', '#00897b', '#5e35b1', '#e53935'];
    var u = insert('users', { username: username, email: email, password: hashPassword(pw), full_name: String(d.full_name || '').trim() || username, phone: String(d.phone || '').trim() || null, address: null, city: null, bio: null, profile_pic: null, avatar_color: colors[Math.floor(Math.random() * colors.length)], role: 'user', is_verified: 0, created_at: stamp() });
    rewardsOf(u.id);
    addNotification(u.id, 'Welcome to SmartWaste!', 'Start by checking the Prices tab, then sort your recyclables and join a group pickup.', 'success', 'fa-hand-sparkles');
    return { success: true };
};

H['create_group_pickup.php'] = function (d) {
    var e = needLogin(); if (e) return e;
    var centerId = parseInt(d.center_id, 10) || 0, address = String(d.address || '').trim();
    var date = String(d.pickup_date || ''), time = String(d.pickup_time || '');
    var maxP = Math.max(2, Math.min(8, parseInt(d.max_participants, 10) || 5));
    if (!centerId || !center(centerId)) return err('Please select a recycling center');
    if (!address) return err('Please enter your pickup address');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return err('Please select a pickup date');
    if (date < today()) return err('Pickup date cannot be in the past');
    if (!/^\d{2}:\d{2}/.test(time)) return err('Please select a pickup time');
    var bags = parseBagItems(d.items); if (bags.error) return bags;
    var code = genGroupCode();
    var g = insert('group_pickups', { group_code: code, creator_id: myId(), center_id: centerId, pickup_date: date, pickup_time: time.slice(0, 5) + ':00', max_participants: maxP, current_participants: 0, estimated_total_weight: 0, meeting_point: String(d.meeting_point || '').trim() || null, notes: String(d.notes || '').trim() || null, status: 'open', created_at: stamp() });
    addParticipant(g.id, code, myId(), address, bags.items);
    refreshGroupTotals(g.id);
    addNotification(myId(), 'Group ' + code + ' created', 'Your tag is ' + code + '-01 (Red). Share the group link so neighbours can join, then print your bag labels.', 'success', 'fa-users', '#manifest-' + g.id);
    return { success: true, group_id: g.id, group_code: code, tag_code: code + '-01', tag_color: 'Red' };
};
H['join_group_pickup.php'] = function (d) {
    var e = needLogin(); if (e) return e;
    var gid = parseInt(d.group_id, 10) || 0, address = String(d.address || '').trim();
    if (!gid) return err('Group not found');
    if (!address) return err('Address is required');
    var bags = parseBagItems(d.items); if (bags.error) return bags;
    var g = getGroup(gid);
    if (!g || g.status !== 'open' || g.current_participants >= g.max_participants) return err('Group is full or no longer available');
    if (T('group_pickup_participants').some(function (p) { return p.group_pickup_id === gid && p.user_id === myId() && p.status !== 'cancelled'; })) return err('You have already joined this group');
    var p = addParticipant(gid, g.group_code, myId(), address, bags.items, String(d.description || '').trim() || null);
    refreshGroupTotals(gid);
    addNotification(myId(), 'You joined group ' + g.group_code, 'Your tag is ' + p.tag_code + ' (' + p.tag_color + '). Print your bag labels before ' + fmtDay(g.pickup_date) + '.', 'success', 'fa-tags', '#tags-' + gid);
    if (g.creator_id !== myId()) addNotification(g.creator_id, 'New member in ' + g.group_code, me().username + ' joined your group pickup as ' + p.tag_code + '.', 'info', 'fa-user-plus', '#manifest-' + gid);
    return { success: true, group_id: gid, tag_code: p.tag_code, tag_color: p.tag_color };
};
H['leave_group.php'] = function (d) {
    var e = needLogin(); if (e) return e;
    var gid = parseInt(d.group_id, 10) || 0, g = getGroup(gid);
    if (!g) return err('Group not found');
    if (g.creator_id === myId()) return err('You are the organiser. Cancel the group instead.');
    if (g.status !== 'open' && g.status !== 'full') return err('This pickup is already collected');
    var p = where('group_pickup_participants', function (x) { return x.group_pickup_id === gid && x.user_id === myId() && x.status !== 'cancelled'; })[0];
    if (!p) return err('You are not in this group');
    p.status = 'cancelled'; refreshGroupTotals(gid);
    addNotification(g.creator_id, 'Member left ' + g.group_code, me().username + ' left your group pickup. Their bags are no longer on the manifest.', 'warning', 'fa-user-minus');
    return { success: true };
};
H['cancel_group.php'] = function (d) {
    var e = needLogin(); if (e) return e;
    var gid = parseInt(d.group_id, 10) || 0, g = getGroup(gid);
    if (!g || g.creator_id !== myId()) return err('Only the organiser can cancel this group');
    if (g.status === 'completed') return err('Completed pickups cannot be cancelled');
    byId('group_pickups', gid).status = 'cancelled';
    getGroupParticipants(gid).forEach(function (p) {
        if (p.user_id !== myId()) addNotification(p.user_id, 'Pickup ' + g.group_code + ' cancelled', 'The organiser cancelled the group pickup on ' + fmtDay(g.pickup_date) + '. You can join or create another group.', 'warning', 'fa-calendar-xmark');
    });
    return { success: true };
};
H['group_details.php'] = function (d) {
    var e = needLogin(); if (e) return null;
    var gid = parseInt(d.id, 10) || 0, g = getGroup(gid); if (!g) return null;
    var ps = getGroupParticipants(gid), split = calculateGroupSplit(gid, ps), mine = myId(), isMember = false;
    var people = ps.map(function (p) {
        if (p.user_id === mine) isMember = true;
        return {
            username: p.username, role: p.user_id === g.creator_id ? 'creator' : 'participant', is_me: p.user_id === mine,
            tag_code: p.tag_code, tag_color: p.tag_color, tag_hex: p.tag_hex, estimated_weight: num(p.estimated_weight),
            bags: p.items.map(function (it) { return { bag_code: it.bag_code, material: it.material_name, icon: it.icon, estimated_weight: num(it.estimated_weight), actual_weight: it.actual_weight != null ? num(it.actual_weight) : null, checked_in: !!it.checked_in }; })
        };
    });
    var dt = parseDate(g.pickup_date + ' ' + g.pickup_time);
    return {
        id: g.id, group_code: g.group_code, center_name: g.center_name, center_address: g.center_address,
        pickup_date: g.pickup_date,
        pickup_date_display: dt.toLocaleDateString('en-GB', { weekday: 'long', month: 'short', day: '2-digit' }),
        pickup_time: dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        max_participants: g.max_participants, current_participants: ps.length, meeting_point: g.meeting_point, notes: g.notes,
        status: g.status, creator_name: g.creator_name, is_creator: g.creator_id === mine, is_member: isMember, can_manage: canManageGroup(g),
        total_kg: split.total_kg, delivery_fee: split.delivery_fee,
        my_split: split.participants.filter(function (r) { return r.user_id === mine; })[0] || null,
        participants: people
    };
};
H['update_bag.php'] = function (d) {
    var e = needLogin(); if (e) return e;
    var gid = parseInt(d.group_id, 10) || 0, code = String(d.bag_code || '').trim().toUpperCase(), action = d.action || 'checkin';
    var g = getGroup(gid);
    if (!g) return err('Group not found');
    if (!canManageGroup(g)) return err('Only the organiser can check bags in');
    if (['open', 'full', 'collected'].indexOf(g.status) < 0) return err('This pickup is closed');
    var bag = null, owner = null;
    T('group_pickup_items').forEach(function (i) {
        if (i.bag_code !== code) return;
        var p = byId('group_pickup_participants', i.participant_id);
        if (p && p.group_pickup_id === gid && p.status !== 'cancelled') { bag = i; owner = p; }
    });
    if (!bag) return err('Bag ' + code + " is not on this group's manifest. Check the label - it may belong to another group.");
    var m = material(bag.material_id), u = byId('users', owner.user_id);
    var info = { bag_code: bag.bag_code, username: u.username, tag_code: owner.tag_code, tag_color: owner.tag_color, tag_hex: TAG_COLORS[owner.tag_color], material: m.material_name, estimated_weight: num(bag.estimated_weight) };
    if (action === 'lookup') return { success: true, bag: Object.assign(info, { checked_in: !!bag.checked_in, actual_weight: bag.actual_weight }) };
    if (action === 'undo') {
        bag.checked_in = 0; bag.actual_weight = null; bag.checked_at = null;
        return { success: true, bag: Object.assign(info, { checked_in: false }), split: calculateGroupSplit(gid) };
    }
    var raw = d.actual_weight, w = (raw === '' || raw == null) ? num(bag.estimated_weight) : round2(parseFloat(raw));
    if (!(w > 0 && w <= 500)) return err('Enter a weight between 0.1 and 500 kg');
    bag.checked_in = 1; bag.actual_weight = w; bag.checked_at = stamp();
    return { success: true, bag: Object.assign(info, { checked_in: true, actual_weight: w, value: round2(w * m.price_per_kg) }), split: calculateGroupSplit(gid) };
};
H['complete_group.php'] = function (d) {
    var e = needLogin(); if (e) return e;
    var gid = parseInt(d.group_id, 10) || 0, g = getGroup(gid);
    if (!g) return err('Group not found');
    if (!canManageGroup(g)) return err('Only the organiser can complete the pickup');
    if (['open', 'full', 'collected'].indexOf(g.status) < 0) return err('This pickup is already closed');
    var ps = getGroupParticipants(gid), missing = [];
    ps.forEach(function (p) { p.items.forEach(function (i) { if (!i.checked_in) missing.push(i.bag_code); }); });
    if (missing.length) return err('Check in every bag first. Missing: ' + missing.slice(0, 6).join(', ') + (missing.length > 6 ? '...' : ''));
    var split = calculateGroupSplit(gid, ps), by = {}, results = [];
    split.participants.forEach(function (r) { by[r.participant_id] = r; });
    ps.forEach(function (p) {
        var row = by[p.id], amount = Math.max(0, row.net), points = Math.round(row.kg * CFG.POINTS_PER_KG), carbon = 0, mats = [];
        p.items.forEach(function (it) { carbon += num(it.actual_weight) * co2Factor(it.category); if (mats.indexOf(it.material_name) < 0) mats.push(it.material_name); });
        var label = ('Group ' + g.group_code + ': ' + mats.join(', ')).slice(0, 80);
        insert('payment_transactions', { user_id: p.user_id, drop_off_id: null, group_pickup_id: gid, amount: amount, weight_kg: row.kg, material_type: label, payment_method_id: null, status: 'pending', transaction_reference: null, notes: 'Value ' + money(row.value) + ' - delivery share ' + money(row.delivery_share), created_at: stamp(), completed_at: null });
        var r = rewardsOf(p.user_id);
        r.total_points += points; r.total_weight_kg = round2(r.total_weight_kg + row.kg); r.total_earned = round2(r.total_earned + amount);
        r.carbon_saved = round2(r.carbon_saved + carbon); r.times_recycled += 1; r.last_scan_date = today();
        refreshLevel(p.user_id);
        insert('point_transactions', { user_id: p.user_id, amount: points, type: 'earned', source: 'group_pickup', source_id: gid, description: label, created_at: stamp() });
        results.push({ user_id: p.user_id, tag: p.tag_code, amount: amount, points: points, kg: row.kg });
    });
    byId('group_pickups', gid).status = 'completed';
    results.forEach(function (r) {
        checkWeeklyChallenge(r.user_id);
        addNotification(r.user_id, 'Pickup ' + g.group_code + ' completed', 'Your bags (' + r.tag + ') weighed ' + r.kg.toFixed(2) + ' kg. You will receive ' + money(r.amount) + ' and earned ' + r.points + ' points.', 'payment', 'fa-money-bill-wave');
    });
    return { success: true, results: results };
};

H['edit_profile.php'] = function (d) {
    var e = needLogin(); if (e) return e;
    var u = me(), action = d.action || 'profile';
    if (action === 'password') {
        if (String(d.new_password || '').length < 6) return err('New password must be at least 6 characters');
        if (d.new_password !== d.confirm_password) return err('New passwords do not match');
        if (!checkPassword(d.current_password || '', u.password)) return err('Current password is incorrect');
        u.password = hashPassword(d.new_password);
        return { success: true, message: 'Password updated' };
    }
    if (action === 'remove_photo') { u.profile_pic = null; return { success: true }; }
    var username = String(d.username || '').trim(), email = String(d.email || '').trim(), phone = String(d.phone || '').trim(), bio = String(d.bio || '').trim();
    if (!/^[A-Za-z0-9_.]{3,30}$/.test(username)) return err('Username must be 3-30 letters, numbers, _ or .');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return err('Please enter a valid email');
    if (phone && !/^[0-9+\-\s]{9,15}$/.test(phone)) return err('Please enter a valid phone number');
    if (bio.length > 160) return err('Bio must be 160 characters or less');
    if (T('users').some(function (x) { return x.id !== u.id && (x.username.toLowerCase() === username.toLowerCase() || x.email.toLowerCase() === email.toLowerCase()); })) return err('That username or email is already taken');
    u.username = username; u.email = email; u.full_name = String(d.full_name || '').trim() || null; u.phone = phone || null;
    u.address = String(d.address || '').trim() || null; u.city = String(d.city || '').trim() || null; u.bio = bio || null;
    u.avatar_color = /^#[0-9a-fA-F]{6}$/.test(d.avatar_color || '') ? d.avatar_color : '#2f9e5b';
    if (d.photo_data) u.profile_pic = d.photo_data;
    setSession(u);
    return { success: true, photo: d.photo_data ? true : null };
};
H['mark_read.php'] = function (d) {
    var e = needLogin(); if (e) return e;
    T('notifications').forEach(function (n) { if (n.user_id === myId() && (d.all === '1' || n.id === +d.notification_id)) n.is_read = 1; });
    return { success: true };
};
H['redeem.php'] = function (d) {
    var e = needLogin(); if (e) return e;
    var rw = byId('partner_rewards', d.reward_id);
    if (!rw || !rw.is_active) return { success: false, error: 'Reward not available' };
    var r = rewardsOf(myId());
    if (r.total_points < rw.points_required) return { success: false, error: 'Not enough points. You need ' + rw.points_required.toLocaleString() + ' points.' };
    r.total_points -= rw.points_required;
    var code = rw.partner_name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() + '-' + Math.random().toString(16).slice(2, 10).toUpperCase();
    var exp = new Date(); exp.setDate(exp.getDate() + 30);
    var red = insert('user_redemptions', { user_id: myId(), partner_reward_id: rw.id, points_spent: rw.points_required, redemption_code: code, status: 'active', redeemed_at: stamp(), expires_at: stamp(exp) });
    insert('point_transactions', { user_id: myId(), amount: rw.points_required, type: 'spent', source: 'reward', source_id: red.id, description: 'Redeemed: ' + rw.partner_name + ' - ' + rw.discount_value, created_at: stamp() });
    var expires = exp.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    addNotification(myId(), 'Reward redeemed', rw.partner_name + ' ' + rw.discount_value + ' - code ' + code + ' (valid until ' + expires + ')', 'success', 'fa-gift');
    return { success: true, redemption_code: code, partner_name: rw.partner_name, discount: rw.discount_value, points_spent: rw.points_required, points_left: r.total_points, link: rw.link, expires_at: expires };
};
H['add_payment_method.php'] = function (d) {
    var e = needLogin(); if (e) return e;
    var type = d.payment_type, row = { account_name: String(d.account_name || '').trim(), account_number: String(d.account_number || '').replace(/\D/g, ''), bank_name: String(d.bank_name || '').trim(), tng_phone: String(d.tng_phone || '').replace(/\D/g, '') };
    if (type === 'bank') {
        if (!row.bank_name) return err('Bank name is required');
        if (!row.account_name) return err('Account holder name is required');
        if (!/^[0-9]{8,16}$/.test(row.account_number)) return err('Account number must be 8-16 digits');
        row.tng_phone = '';
    } else if (type === 'tng' || type === 'grabpay') {
        if (!/^01[0-9]{8,9}$/.test(row.tng_phone)) return err('Please enter a valid Malaysian phone number (e.g. 0123456789)');
        row.account_number = ''; row.bank_name = '';
    } else return err('Invalid payment type');
    var mine = getPaymentMethods(myId()), isDefault = d.is_default === '1' || !mine.length;
    if (isDefault) mine.forEach(function (m) { byId('payment_methods', m.id).is_default = 0; });
    insert('payment_methods', { user_id: myId(), payment_type: type, account_name: row.account_name || null, account_number: row.account_number || null, bank_name: row.bank_name || null, tng_phone: row.tng_phone || null, is_default: isDefault ? 1 : 0, created_at: stamp() });
    return { success: true };
};
H['remove_payment.php'] = function (d) {
    var e = needLogin(); if (e) return e;
    DB.payment_methods = T('payment_methods').filter(function (m) { return !(m.id === +d.method_id && m.user_id === myId()); });
    var mine = getPaymentMethods(myId());
    if (mine.length && !mine.some(function (m) { return m.is_default; })) byId('payment_methods', mine[0].id).is_default = 1;
    return { success: true };
};
H['set_default_payment.php'] = function (d) {
    var e = needLogin(); if (e) return e;
    T('payment_methods').forEach(function (m) { if (m.user_id === myId()) m.is_default = m.id === +d.method_id ? 1 : 0; });
    return { success: true };
};
H['log_dropoff.php'] = function (d) {
    var e = needLogin(); if (e) return e;
    var cid = parseInt(d.center_id, 10) || 0, date = d.dropoff_date || today();
    if (!cid || !center(cid)) return err('Choose the recycling center');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return err('Choose a valid date');
    if (date < addDays(today(), -14) || date > addDays(today(), 30)) return err('Date must be within the last 2 weeks or the next 30 days');
    var bags = parseBagItems(d.items); if (bags.error) return bags;
    bags.items.forEach(function (it) {
        insert('drop_offs', { user_id: myId(), center_id: cid, material_id: it.material_id, weight_kg: it.weight, actual_weight: null, dropoff_date: date, notes: String(d.notes || '').trim() || null, status: 'pending', verified_by: null, verified_at: null, created_at: stamp() });
    });
    addNotification(myId(), 'Drop-off logged', bags.items.length + ' item(s), ' + bags.total + ' kg at ' + center(cid).name + '. You will be paid once the weight is verified.', 'info', 'fa-box-open');
    return { success: true, count: bags.items.length, total: bags.total };
};
H['update_price.php'] = function (d) {
    var e = needLogin(); if (e) return e;
    if (!isAdmin()) return err('Only admins can update prices');
    var m = material(d.material_id); if (!m) return err('Material not found');
    var mn = round2(parseFloat(d.price_min) || 0), mx = round2(parseFloat(d.price_max) || 0), p = round2(parseFloat(d.price_per_kg) || 0);
    var url = String(d.source_url || '').trim();
    if (url && !/^https?:\/\/\S+$/.test(url)) return err('Source link must be a full URL (https://...)');
    if (mn < 0 || mx < mn) return err('Max price must be at least the min price');
    if (p < mn || p > mx) return err('Typical price must sit between min and max');
    var old = num(m.price_per_kg), change = old > 0 ? round2((p - old) / old * 100) : 0;
    Object.assign(m, { price_min: mn, price_max: mx, price_per_kg: p, change_percent: Math.abs(change), is_up: change >= 0 ? 1 : 0, source: (String(d.source || '').trim() || 'Updated by SmartWaste admin').slice(0, 160), source_url: url || null, price_date: today(), last_updated: stamp() });
    insert('price_history', { material_id: m.id, old_price: old, new_price: p, changed_by: myId(), changed_at: stamp() });
    return { success: true, change_percent: change };
};
H['admin_action.php'] = function (d) {
    var e = needLogin(); if (e) return e;
    if (role() !== 'admin' && role() !== 'collector') return err('Admins only');
    var id = +d.id;
    if (d.action === 'verify_dropoff') {
        var x = byId('drop_offs', id); if (!x || x.status !== 'pending') return err('Drop-off not found or already handled');
        var m = material(x.material_id), c = center(x.center_id) || {};
        var kg = round2(parseFloat(d.actual_weight != null && d.actual_weight !== '' ? d.actual_weight : x.weight_kg));
        if (!(kg > 0 && kg <= 1000)) return err('Enter a weight between 0.1 and 1000 kg');
        var amount = round2(kg * m.price_per_kg), points = Math.round(kg * CFG.POINTS_PER_KG);
        Object.assign(x, { status: 'verified', actual_weight: kg, verified_by: myId(), verified_at: stamp() });
        insert('payment_transactions', { user_id: x.user_id, drop_off_id: id, group_pickup_id: null, amount: amount, weight_kg: kg, material_type: m.material_name, status: 'pending', notes: 'Drop-off at ' + c.name, created_at: stamp(), completed_at: null });
        var r = rewardsOf(x.user_id);
        r.total_points += points; r.total_weight_kg = round2(r.total_weight_kg + kg); r.total_earned = round2(r.total_earned + amount);
        r.carbon_saved = round2(r.carbon_saved + kg * co2Factor(m.category)); r.times_recycled += 1; r.last_scan_date = today();
        insert('point_transactions', { user_id: x.user_id, amount: points, type: 'earned', source: 'dropoff', source_id: id, description: 'Drop-off: ' + m.material_name, created_at: stamp() });
        refreshLevel(x.user_id);
        addNotification(x.user_id, 'Drop-off verified', m.material_name + ': ' + kg.toFixed(2) + ' kg verified at ' + c.name + '. ' + money(amount) + ' is on the way and you earned ' + points + ' points.', 'success', 'fa-circle-check');
        checkWeeklyChallenge(x.user_id);
        return { success: true, amount: amount, points: points };
    }
    if (d.action === 'reject_dropoff') {
        var y = byId('drop_offs', id); if (!y || y.status !== 'pending') return err('Drop-off not found or already handled');
        var reason = String(d.reason || '').trim() || 'Not received at the center';
        Object.assign(y, { status: 'rejected', notes: reason.slice(0, 250), verified_by: myId(), verified_at: stamp() });
        addNotification(y.user_id, 'Drop-off not accepted', reason, 'warning', 'fa-circle-xmark');
        return { success: true };
    }
    if (d.action === 'mark_paid') {
        var t = byId('payment_transactions', id); if (!t || t.status !== 'pending') return err('Payment not found or already paid');
        var ref = String(d.reference || '').trim() || ('SW' + today().replace(/-/g, '').slice(2) + Math.random().toString(16).slice(2, 8).toUpperCase());
        Object.assign(t, { status: 'completed', completed_at: stamp(), transaction_reference: ref.slice(0, 100) });
        if (t.drop_off_id) { var dd = byId('drop_offs', t.drop_off_id); if (dd) dd.status = 'paid'; }
        var pm = getPaymentMethods(t.user_id)[0];
        var via = !pm ? 'your payment method' : pm.payment_type === 'bank' ? pm.bank_name : pm.payment_type === 'tng' ? "Touch 'n Go" : 'GrabPay';
        addNotification(t.user_id, 'Payment received!', money(t.amount) + ' for ' + t.material_type + ' was sent to ' + via + '. Ref: ' + ref, 'payment', 'fa-money-bill-wave');
        return { success: true, reference: ref };
    }
    return err('Unknown action');
};
H['ai_chat.php'] = function (d) {
    var e = needLogin(); if (e) return e;
    if (d.action === 'history') {
        return { messages: where('chat_messages', function (m) { return m.user_id === myId(); }).slice(-30).map(function (m) { return { role: m.role, message: m.message }; }) };
    }
    if (d.action === 'clear') { DB.chat_messages = T('chat_messages').filter(function (m) { return m.user_id !== myId(); }); return { success: true }; }
    var msg = String(d.message || '').trim().slice(0, 1000);
    if (!msg) return err('Type a question first');
    // asynchronous: the answer comes from EcoBot (AI when available, otherwise offline)
    var history = where('chat_messages', function (m) { return m.user_id === myId(); }).slice(-8);
    return window.EcoBot.answer(msg, history, botContext()).then(function (res) {
        insert('chat_messages', { user_id: myId(), role: 'user', message: msg, created_at: stamp() });
        insert('chat_messages', { user_id: myId(), role: 'assistant', message: res.reply, created_at: stamp() });
        save();
        return res;
    });
};
function botContext() {
    var u = getCurrentUser();
    return {
        user: u, materials: getMaterials(), groups: getUserGroups(u.id), cfg: CFG, deliveryCost: deliveryCost,
        centers: T('recycling_centers').slice().sort(function (a, b) { return b.rating - a.rating; }).slice(0, 8)
    };
}

// ---------- the single entry point used by the pages ----------
function LocalAPI(url, data) {
    var name = String(url).split('?')[0];
    var params = {};
    String(url).split('?')[1] && String(url).split('?')[1].split('&').forEach(function (kv) { var p = kv.split('='); params[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); });
    if (data && typeof FormData !== 'undefined' && data instanceof FormData) { data.forEach(function (v, k) { params[k] = v; }); }
    else if (data) Object.keys(data).forEach(function (k) { params[k] = data[k]; });
    var h = H[name];
    return new Promise(function (resolve) {
        var out;
        try { out = h ? h(params) : { error: 'Unknown action ' + name }; }
        catch (e) { console.error(e); out = { error: 'Something went wrong: ' + e.message }; }
        Promise.resolve(out).then(function (res) { save(); resolve(res); }, function (e) { console.error(e); resolve({ error: 'Something went wrong' }); });
    });
}

load(); loadSession();
if (session && !me()) setSession(null);

window.SWDB = {
    CFG: CFG, TAG_COLORS: TAG_COLORS, today: today, parseDate: parseDate, stamp: stamp, money: money, round2: round2,
    me: me, getCurrentUser: getCurrentUser, isAdmin: isAdmin, role: role, getMaterials: getMaterials, categoryLabel: categoryLabel,
    leaderboard: leaderboard, rankOf: rankOf, openGroups: openGroups, getUserGroups: getUserGroups, bagsOf: bagsOf,
    getUserDropOffs: getUserDropOffs, weeklyPlasticKg: weeklyPlasticKg, challengeDone: challengeDone,
    getPartnerRewards: getPartnerRewards, getUserRedemptions: getUserRedemptions, getPaymentMethods: getPaymentMethods,
    getNotifications: getNotifications, getPaymentTransactions: getPaymentTransactions, getGroup: getGroup,
    getGroupParticipants: getGroupParticipants, calculateGroupSplit: calculateGroupSplit, canManageGroup: canManageGroup,
    deliveryCost: deliveryCost, T: T, byId: byId, resetDemo: resetDemo, isMemoryOnly: function () { return memoryOnly; },
    sha256: sha256
};
window.LocalAPI = LocalAPI;
})();
