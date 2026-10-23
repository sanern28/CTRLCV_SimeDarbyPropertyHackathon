/* =========================================================
   SmartWaste - the other pages: sign in, register, bag labels,
   manifest (check-in) and admin. Each was its own .php file.
   ========================================================= */
(function () {
'use strict';
var D = window.SWDB, V = window.SWViews;
var e = V.e, nf = V.nf, money = V.money, date = V.date, each = V.each, matIcon = V.matIcon;

function brand() { return '<div class="brand"><span class="brand-mark"><i class="fas fa-recycle"></i></span> SmartWaste</div>'; }
function esc(s) { return e(s); }
function rm(n) { return 'RM ' + (Number(n) || 0).toFixed(2); }
function toast(msg, type) {
    var t = document.getElementById('toast'); if (!t) return;
    t.className = 'toast ' + (type || '');
    t.innerHTML = '<i class="fas ' + (type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check') + '"></i><span></span>';
    t.querySelector('span').textContent = msg;
    void t.offsetWidth; t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('show'); }, 3000);
}
function canPrint() { try { return window.top === window.self; } catch (x) { return false; } }

// ==========================================
// SIGN IN / REGISTER
// ==========================================
function renderLogin(msg) {
    return '<div class="auth-wrap"><div class="auth-side">' + brand() +
        '<h2>Turn your trash into cash.</h2><p>Sort it, share a pickup with neighbours, and get paid for every kg.</p><ul>' +
        '<li><i class="fas fa-tags"></i> Live prices for ' + D.getMaterials().length + ' materials</li><li><i class="fas fa-people-group"></i> Group pickups with fair, tagged bags</li>' +
        '<li><i class="fas fa-robot"></i> EcoBot answers your recycling questions</li><li><i class="fas fa-gift"></i> Points and partner rewards</li></ul></div>' +
        '<div class="auth-screen">' + brand() + '<h1>Welcome back</h1><div class="subtitle">Sign in to continue recycling</div>' +
        '<form class="auth-form" id="loginForm"><div id="authMsg">' + (msg || '') + '</div>' +
        '<div class="input-icon"><i class="fas fa-user"></i><input type="text" name="username" placeholder="Username or email" required autofocus autocomplete="username"></div>' +
        '<div class="input-icon"><i class="fas fa-lock"></i><input type="password" name="password" id="pw" placeholder="Password" required autocomplete="current-password">' +
        '<button type="button" class="toggle-pass" onclick="var p=document.getElementById(\'pw\');p.type=p.type===\'password\'?\'text\':\'password\';this.firstElementChild.className=\'fas \'+(p.type===\'password\'?\'fa-eye\':\'fa-eye-slash\')" aria-label="Show password"><i class="fas fa-eye"></i></button></div>' +
        '<button class="btn btn-primary btn-auth" type="submit"><i class="fas fa-right-to-bracket"></i> Sign in</button>' +
        '<div class="toggle-auth">New here? <a href="#register">Create an account</a></div></form>' +
        '<div class="demo-hint"><i class="fas fa-circle-info"></i> Demo: <b>demo</b> / <b>demo123</b> &middot; Admin: <b>admin</b> / <b>demo123</b></div></div></div>';
}
function bindLogin() {
    var f = document.getElementById('loginForm');
    f.onsubmit = function (ev) {
        ev.preventDefault();
        LocalAPI('login.php', { username: f.username.value, password: f.password.value }).then(function (d) {
            if (d.success) { SWApp.go(SWApp.afterLogin || 'home'); SWApp.afterLogin = null; }
            else document.getElementById('authMsg').innerHTML = '<div class="error-msg"><i class="fas fa-circle-exclamation"></i> ' + e(d.error) + '</div>';
        });
    };
}
function renderRegister() {
    return '<div class="auth-wrap"><div class="auth-side">' + brand() +
        '<h2>Join your neighbours in recycling.</h2><p>Takes less than a minute. You can add a photo and payment method later.</p><ul>' +
        '<li><i class="fas fa-layer-group"></i> Sort your recyclables</li><li><i class="fas fa-users"></i> Join a group pickup near you</li>' +
        '<li><i class="fas fa-tags"></i> Tag your bags with your code</li><li><i class="fas fa-money-bill-wave"></i> Get paid for your own rubbish</li></ul></div>' +
        '<div class="auth-screen">' + brand() + '<h1>Create your account</h1><div class="subtitle">Start turning trash into cash</div>' +
        '<form class="auth-form" id="regForm"><div id="authMsg"></div>' +
        '<div class="input-icon"><i class="fas fa-id-card"></i><input type="text" name="full_name" placeholder="Full name (optional)" autocomplete="name"></div>' +
        '<div class="input-icon"><i class="fas fa-at"></i><input type="text" name="username" placeholder="Username" required autocomplete="username"></div>' +
        '<div class="input-icon"><i class="fas fa-envelope"></i><input type="email" name="email" placeholder="Email" required autocomplete="email"></div>' +
        '<div class="input-icon"><i class="fas fa-phone"></i><input type="tel" name="phone" placeholder="Phone (optional)" autocomplete="tel"></div>' +
        '<div class="input-icon"><i class="fas fa-lock"></i><input type="password" name="password" placeholder="Password (min 6 characters)" required minlength="6" autocomplete="new-password"></div>' +
        '<div class="input-icon"><i class="fas fa-lock"></i><input type="password" name="confirm" placeholder="Confirm password" required minlength="6" autocomplete="new-password"></div>' +
        '<button class="btn btn-primary btn-auth" type="submit"><i class="fas fa-user-plus"></i> Create account</button>' +
        '<div class="toggle-auth">Already have an account? <a href="#login">Sign in</a></div></form></div></div>';
}
function bindRegister() {
    var f = document.getElementById('regForm');
    f.onsubmit = function (ev) {
        ev.preventDefault();
        var data = {}; ['full_name', 'username', 'email', 'phone', 'password', 'confirm'].forEach(function (k) { data[k] = f[k].value; });
        LocalAPI('register.php', data).then(function (d) {
            if (d.success) SWApp.show('login', '<div class="success-msg"><i class="fas fa-circle-check"></i> Account created! Sign in below.</div>');
            else document.getElementById('authMsg').innerHTML = '<div class="error-msg"><i class="fas fa-circle-exclamation"></i> ' + e(d.error) + '</div>';
        });
    };
}

// ==========================================
// BAG LABELS (tags.php)
// ==========================================
function notFound() { return '<div class="pg-wrap"><div class="card empty-state"><i class="fas fa-circle-question"></i>Group not found.<div class="btn-row center"><a class="btn btn-primary btn-sm" href="#pickups">Back</a></div></div></div>'; }
function renderTags(groupId, showAllAsked) {
    var group = D.getGroup(groupId); if (!group) return notFound();
    var participants = D.getGroupParticipants(groupId), canManage = D.canManageGroup(group);
    var showAll = showAllAsked && canManage, me = D.me().id, labels = [];
    participants.forEach(function (p) { if (!showAll && p.user_id !== me) return; p.items.forEach(function (it) { labels.push({ p: p, it: it }); }); });
    var isMember = participants.some(function (p) { return p.user_id === me; });
    var h = '<div class="pg-tags"><div class="sheet"><div class="sheet-head no-print"><div><a href="#pickups" class="link-btn"><i class="fas fa-arrow-left"></i> Back to pickups</a>' +
        '<h1>Bag labels &middot; Group ' + e(group.group_code) + '</h1><p class="muted small">' + e(group.center_name) + ' &middot; ' + date('l, M d', group.pickup_date) + ' at ' + date('h:i A', group.pickup_date + ' ' + group.pickup_time) + '</p></div>' +
        '<div class="btn-row" style="margin:0">' +
        (canManage ? (showAll ? '<a class="btn btn-ghost btn-sm" href="#tags-' + groupId + '"><i class="fas fa-user"></i> Only mine</a>' : '<a class="btn btn-ghost btn-sm" href="#tags-' + groupId + '-all"><i class="fas fa-users"></i> Everyone\'s labels</a>') +
            '<a class="btn btn-ghost btn-sm" href="#manifest-' + groupId + '"><i class="fas fa-clipboard-check"></i> Manifest</a>' : '') +
        (canPrint() ? '<button class="btn btn-primary btn-sm" onclick="window.print()"><i class="fas fa-print"></i> Print</button>' : '') + '</div></div>';
    if (!canPrint()) h += '<div class="banner info no-print"><i class="fas fa-circle-info"></i> <span>To print, open the SmartWaste folder version on a computer and press <b>Print</b> - or simply copy each bag code onto the bag with a marker.</span></div>';
    if (!labels.length) h += '<div class="card empty-state"><i class="fas fa-tags"></i>' + (isMember ? 'You have no bags in this group.' : 'You are not part of this group yet.') +
        '<div class="btn-row center"><a class="btn btn-primary btn-sm" href="#group-' + groupId + '">Open group</a></div></div>';
    h += '<div class="labels">' + each(labels, function (l) {
        var p = l.p, it = l.it;
        return '<div class="label" style="--tag:' + e(p.tag_hex) + '"><div class="label-band"><span class="no">' + String(p.participant_no).padStart(2, '0') + '</span><span class="col">' + e(p.tag_color) + '</span></div>' +
            '<div class="label-body"><div class="label-code">' + e(it.bag_code) + '</div><div class="label-owner">' + e(p.full_name || p.username) + ' <span style="font-weight:400;color:#666">(@' + e(p.username) + ')</span></div>' +
            '<div class="label-line"><i class="fas ' + e(it.icon) + '"></i> ' + e(it.material_name) + ' &middot; ~' + nf(it.estimated_weight, 1) + ' kg</div>' +
            '<div class="label-line"><i class="fas fa-bag-shopping"></i> Bag ' + it.bag_no + ' of ' + p.items.length + '</div>' +
            '<div class="label-foot">SmartWaste group ' + e(group.group_code) + ' &middot; ' + date('d M Y', group.pickup_date) + ' &middot; ' + e(group.center_name) + '</div></div>' +
            '<div class="label-qr"><div class="qr" data-code="' + e(it.bag_code) + '"></div><small>Scan to check in</small></div></div>';
    }) + '</div>';
    if (labels.length) h += '<div class="card tips no-print"><div class="card-title"><i class="fas fa-lightbulb"></i> Tips</div><ul class="muted small" style="padding-left:18px;display:grid;gap:4px">' +
        '<li>Cut along the dashed lines and tape one label to each bag (clear tape keeps it dry).</li>' +
        '<li>No printer? Write the bag code (e.g. <b class="mono">' + e(labels[0].it.bag_code) + '</b>) on the bag with a marker and tie a ' + e(labels[0].p.tag_color.toLowerCase()) + ' ribbon on it.</li>' +
        '<li>Keep one material per bag, so the weight and price are accurate.</li></ul></div>';
    return h + '</div></div><div class="toast" id="toast"></div>';
}
function bindTags(groupId) {
    var base = location.href.split('#')[0];
    document.querySelectorAll('.qr').forEach(function (el) {
        var url = base + '#manifest-' + groupId + '-' + el.dataset.code;
        if (window.SWQR) el.innerHTML = SWQR.svg(url, 92); else el.textContent = el.dataset.code;
    });
}

// ==========================================
// MANIFEST (manifest.php)
// ==========================================
var M = { gid: 0, split: null, stream: null, detector: null };
function renderManifest(groupId, focusBag) {
    var group = D.getGroup(groupId); if (!group) return notFound();
    var canManage = D.canManageGroup(group), participants = D.getGroupParticipants(groupId), split = D.calculateGroupSplit(groupId, participants);
    var totalBags = 0, checkedBags = 0;
    participants.forEach(function (p) { p.items.forEach(function (it) { totalBags++; if (it.checked_in) checkedBags++; }); });
    var closed = ['completed', 'cancelled'].indexOf(group.status) >= 0;
    focusBag = String(focusBag || '').trim().toUpperCase();
    M.gid = groupId; M.split = split; M.closed = closed; M.canManage = canManage; M.focus = focusBag;

    var h = '<div class="pg-manifest"><div class="wrap"><a href="#pickups" class="link-btn"><i class="fas fa-arrow-left"></i> Back to pickups</a><div class="m-head"><div>' +
        '<h1><span class="group-code" style="font-size:1rem">' + e(group.group_code) + '</span> Pickup manifest</h1>' +
        '<p class="muted small"><i class="fas fa-warehouse"></i> ' + e(group.center_name) + ' &middot; <i class="fas fa-clock"></i> ' + date('l, M d', group.pickup_date) + ' at ' + date('h:i A', group.pickup_date + ' ' + group.pickup_time) +
        (group.meeting_point ? ' &middot; <i class="fas fa-flag"></i> ' + e(group.meeting_point) : '') + '</p></div>' +
        '<div class="btn-row" style="margin:0"><a class="btn btn-ghost btn-sm" href="#tags-' + groupId + '-all"><i class="fas fa-print"></i> Print all labels</a></div></div>';
    if (!canManage) {
        return h + '<div class="card empty-state"><i class="fas fa-lock"></i>Only the organiser (' + e(group.creator_name) + ') can check bags in.<br>' +
            (focusBag ? 'This label is bag <b class="mono">' + e(focusBag) + '</b>. Hand it to the organiser.' : '') +
            '<div class="btn-row center"><a class="btn btn-primary btn-sm" href="#group-' + groupId + '">View group</a></div></div></div></div><div class="toast" id="toast"></div>';
    }
    if (closed) h += '<div class="banner ' + (group.status === 'completed' ? 'success' : 'error') + '"><i class="fas fa-circle-info"></i> This pickup is ' + e(group.status) + '. The manifest is read-only.</div>';
    h += '<div class="progress-card"><div><small>Bags checked in</small><strong id="pgBags">' + checkedBags + '/' + totalBags + '</strong><div class="fill-bar mt-8"><span id="pgBar" style="width:' + (totalBags ? Math.round(checkedBags / totalBags * 100) : 0) + '%"></span></div></div>' +
        '<div><small>Total weight</small><strong id="pgKg">' + nf(split.total_kg, 2) + ' kg</strong></div><div><small>Total value</small><strong id="pgVal">' + money(split.total_value) + '</strong></div>' +
        '<div><small>Delivery fee</small><strong id="pgFee">' + money(split.delivery_fee) + '</strong></div></div>';
    if (!closed) {
        var sample = (participants[0] && participants[0].items[0] && participants[0].items[0].bag_code) || 'KL7Q-01-B1';
        h += '<div class="card"><div class="card-title"><i class="fas fa-barcode"></i> Check in a bag</div><p class="muted small" style="margin-bottom:10px">Type the code on the label (e.g. <b class="mono">' + e(sample) + '</b>), use a barcode scanner, or scan the QR with your camera.</p>' +
            '<form class="scan-bar" id="scanForm"><input class="form-control" id="scanInput" placeholder="Bag code" autocomplete="off" value="' + e(focusBag) + '">' +
            '<button class="btn btn-primary" type="submit"><i class="fas fa-magnifying-glass"></i> Find</button><button class="btn btn-ghost" type="button" id="camBtn" hidden><i class="fas fa-camera"></i></button></form>' +
            '<video id="cam" playsinline muted></video><div class="found" id="found"><div class="found-top"><div class="found-swatch" id="fSwatch"></div><div class="grow">' +
            '<div class="mono" style="font-weight:800;font-size:1.2rem" id="fCode"></div><div><strong id="fOwner"></strong> &middot; <span id="fTag"></span></div><div class="muted small" id="fMat"></div></div></div>' +
            '<div class="found-row"><label class="small" for="fWeight"><strong>Real weight</strong></label><input class="form-control" type="number" step="0.01" min="0.1" id="fWeight"><span class="small muted">kg</span>' +
            '<button class="btn btn-primary" id="fConfirm"><i class="fas fa-check"></i> Confirm check-in</button></div></div></div>';
    }
    h += '<div class="card-title" style="margin-top:6px"><i class="fas fa-users"></i> Bags by person</div>' +
        each(participants, function (p) {
            return '<div class="person-block" style="--tag:' + e(p.tag_hex) + '"><div class="person-head"><div class="found-swatch" style="width:42px;height:42px;font-size:1rem">' + String(p.participant_no).padStart(2, '0') + '</div>' +
                '<div class="grow"><strong>' + e(p.full_name || p.username) + '</strong> <span class="muted">@' + e(p.username) + '</span>' +
                '<small><b class="mono">' + e(p.tag_code) + '</b> &middot; ' + e(p.tag_color) + ' &middot; ' + e(p.address) + (p.phone ? ' &middot; ' + e(p.phone) : '') + '</small>' +
                (p.item_description ? '<small><i class="fas fa-note-sticky"></i> ' + e(p.item_description) + '</small>' : '') + '</div></div>' +
                each(p.items, function (it) {
                    return '<div class="bag-line ' + (it.checked_in ? 'checked' : '') + '" id="bag-' + e(it.bag_code) + '" data-code="' + e(it.bag_code) + '"><div><span class="code">' + e(it.bag_code) + '</span>' +
                        '<small>' + matIcon(it, 'bag-icon') + ' ' + e(it.material_name) + ' &middot; est. ' + nf(it.estimated_weight, 2) + ' kg &middot; ' + money(it.price_per_kg) + '/kg</small></div>' +
                        '<input class="form-control" type="number" step="0.01" min="0.1" placeholder="kg" value="' + (it.checked_in ? e(it.actual_weight) : '') + '" ' + (it.checked_in || closed ? 'disabled' : '') + ' aria-label="Real weight"><div class="act">' +
                        (!closed ? '<button class="btn btn-sm btn-primary full" data-checkin ' + (it.checked_in ? 'hidden' : '') + '><i class="fas fa-check"></i> Check in</button>' +
                            '<button class="btn btn-sm btn-ghost full" data-undo ' + (it.checked_in ? '' : 'hidden') + '><i class="fas fa-rotate-left"></i> Undo</button>'
                            : (it.checked_in ? '<span class="chip chip-green"><i class="fas fa-check"></i> Checked</span>' : '<span class="chip chip-gray">Not checked</span>')) + '</div></div>';
                }) + '</div>';
        });
    h += '<div class="card"><div class="card-title"><i class="fas fa-scale-balanced"></i> Fair split</div><p class="muted small" style="margin-bottom:8px">Each person earns weight &times; price for their own bags. The delivery fee is shared by weight. Estimated weights are used until a bag is checked in.</p>' +
        '<div style="overflow-x:auto"><table class="split-table"><thead><tr><th>Person</th><th>Bags</th><th>kg</th><th>Value</th><th>Delivery</th><th>Payout</th></tr></thead><tbody id="splitBody"></tbody>' +
        '<tfoot><tr><td>Total</td><td></td><td id="sfKg"></td><td id="sfVal"></td><td id="sfFee"></td><td id="sfNet" class="net"></td></tr></tfoot></table></div>' +
        (!closed ? '<button class="btn btn-primary full mt-8" id="completeBtn" ' + (checkedBags < totalBags ? 'disabled' : '') + '><i class="fas fa-flag-checkered"></i> Complete pickup &amp; pay everyone</button>' +
            '<p class="muted small mt-8" id="completeHint">' + (checkedBags < totalBags ? 'Check in all bags to complete the pickup.' : 'All bags checked in.') + '</p>' : '') + '</div>';
    return h + '</div></div><div class="toast" id="toast"></div>';
}
function post(data) { return LocalAPI('update_bag.php', data); }
function renderSplit() {
    var body = document.getElementById('splitBody'); if (!body) return;
    var split = M.split, net = 0;
    body.innerHTML = split.participants.map(function (r) {
        net += Math.max(0, r.net);
        return '<tr><td><span class="tag-chip" style="--tag:' + r.tag_hex + ';font-size:.75rem"><span class="tag-dot"></span>' + esc(r.tag_code) + '</span> ' + esc(r.username) + '</td>' +
            '<td>' + r.checked + '/' + r.bags + '</td><td>' + r.kg.toFixed(2) + '</td><td>' + rm(r.value) + '</td><td>-' + rm(r.delivery_share) + '</td><td class="net">' + rm(Math.max(0, r.net)) + '</td></tr>';
    }).join('');
    document.getElementById('sfKg').textContent = split.total_kg.toFixed(2);
    document.getElementById('sfVal').textContent = rm(split.total_value);
    document.getElementById('sfFee').textContent = '-' + rm(split.delivery_fee);
    document.getElementById('sfNet').textContent = rm(net);
    var bags = 0, checked = 0;
    split.participants.forEach(function (r) { bags += r.bags; checked += r.checked; });
    document.getElementById('pgBags').textContent = checked + '/' + bags;
    document.getElementById('pgBar').style.width = (bags ? Math.round(checked / bags * 100) : 0) + '%';
    document.getElementById('pgKg').textContent = split.total_kg.toFixed(2) + ' kg';
    document.getElementById('pgVal').textContent = rm(split.total_value);
    document.getElementById('pgFee').textContent = rm(split.delivery_fee);
    var btn = document.getElementById('completeBtn');
    if (btn) {
        btn.disabled = checked < bags;
        document.getElementById('completeHint').textContent = checked < bags ? (bags - checked) + ' bag(s) still to check in.' : 'All bags checked in - ready to complete.';
    }
}
function setRow(code, checked, weight) {
    var row = document.getElementById('bag-' + code); if (!row) return;
    row.classList.toggle('checked', checked);
    var input = row.querySelector('input');
    input.disabled = checked;
    if (weight != null) input.value = weight;
    if (!checked) input.value = '';
    row.querySelector('[data-checkin]').hidden = checked;
    row.querySelector('[data-undo]').hidden = !checked;
    row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash');
}
function lookupBag(code) {
    var input = document.getElementById('scanInput');
    code = String(code || input.value).trim().toUpperCase();
    // QR codes hold a link like ...#manifest-3-KL7Q-01-B1 : pull the bag code out
    var m = code.match(/#MANIFEST-\d+-([A-Z0-9]+-\d+-B\d+)/) || code.match(/BAG=([A-Z0-9-]+)/);
    if (m) code = m[1];
    if (!code) return;
    input.value = code;
    post({ group_id: M.gid, bag_code: code, action: 'lookup' }).then(function (d) {
        var f = document.getElementById('found');
        if (!d.success) { f.classList.remove('show'); toast(d.error, 'error'); return; }
        var b = d.bag;
        f.style.setProperty('--tag', b.tag_hex);
        document.getElementById('fSwatch').textContent = b.tag_code.split('-').pop();
        document.getElementById('fCode').textContent = b.bag_code;
        document.getElementById('fOwner').textContent = b.username;
        document.getElementById('fTag').textContent = b.tag_code + ' (' + b.tag_color + ')';
        document.getElementById('fMat').textContent = b.material + ' - estimated ' + b.estimated_weight + ' kg' + (b.checked_in ? ' - already checked in at ' + b.actual_weight + ' kg' : '');
        document.getElementById('fWeight').value = b.checked_in ? b.actual_weight : b.estimated_weight;
        f.classList.add('show');
        document.getElementById('fWeight').focus(); document.getElementById('fWeight').select();
        var row = document.getElementById('bag-' + b.bag_code);
        if (row) { row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash'); }
    });
}
function checkIn(code, weight) {
    post({ group_id: M.gid, bag_code: code, actual_weight: weight || '', action: 'checkin' }).then(function (d) {
        if (!d.success) { toast(d.error, 'error'); return; }
        M.split = d.split; setRow(d.bag.bag_code, true, d.bag.actual_weight); renderSplit();
        toast(d.bag.bag_code + ' checked in for ' + d.bag.username + ' (' + d.bag.actual_weight + ' kg)', 'success');
        document.getElementById('found').classList.remove('show');
        var input = document.getElementById('scanInput'); input.value = ''; input.focus();
    });
}
function completePickup() {
    var m = document.createElement('div'); m.className = 'modal';
    var rows = M.split.participants.map(function (r) { return '<li><b class="mono">' + esc(r.tag_code) + '</b> ' + esc(r.username) + ': ' + rm(Math.max(0, r.net)) + ' &middot; ' + Math.round(r.kg * D.CFG.POINTS_PER_KG) + ' pts</li>'; }).join('');
    m.innerHTML = '<div class="modal-content"><div class="modal-head"><span class="modal-icon"><i class="fas fa-flag-checkered"></i></span><div><h3>Complete pickup?</h3><p>Everyone gets a pending payment for their own bags and earns points.</p></div></div>' +
        '<ul class="muted small" style="padding-left:18px;display:grid;gap:4px;margin-bottom:12px">' + rows + '</ul>' +
        '<div class="btn-row"><button class="btn btn-ghost" id="cNo">Not yet</button><button class="btn btn-primary" id="cYes"><i class="fas fa-check"></i> Complete</button></div></div>';
    document.body.appendChild(m);
    m.querySelector('#cNo').onclick = function () { m.remove(); };
    m.querySelector('#cYes').onclick = function () {
        this.disabled = true;
        LocalAPI('complete_group.php', { group_id: M.gid }).then(function (d) {
            m.remove();
            if (d.success) { toast('Pickup completed - everyone has been notified', 'success'); setTimeout(function () { SWApp.render(); }, 1200); }
            else toast(d.error, 'error');
        });
    };
}
function toggleCamera() {
    var video = document.getElementById('cam');
    if (M.stream) { M.stream.getTracks().forEach(function (t) { t.stop(); }); M.stream = null; video.style.display = 'none'; return; }
    M.detector = M.detector || new BarcodeDetector({ formats: ['qr_code', 'code_128'] });
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(function (s) {
        M.stream = s; video.srcObject = s; video.style.display = 'block'; video.play();
        var tick = function () {
            if (!M.stream || !document.body.contains(video)) { if (M.stream) { M.stream.getTracks().forEach(function (t) { t.stop(); }); M.stream = null; } return; }
            M.detector.detect(video).then(function (codes) { if (codes.length) { toggleCamera(); lookupBag(codes[0].rawValue); } else requestAnimationFrame(tick); })
                .catch(function () { requestAnimationFrame(tick); });
        };
        tick();
    }).catch(function () { toast('Could not open the camera. Type the code instead.', 'error'); });
}
function bindManifest() {
    if (!M.canManage) return;
    var f = document.getElementById('scanForm');
    if (f) f.onsubmit = function (ev) { ev.preventDefault(); lookupBag(); };
    var fc = document.getElementById('fConfirm');
    if (fc) fc.onclick = function () { checkIn(document.getElementById('fCode').textContent, document.getElementById('fWeight').value); };
    var cb = document.getElementById('completeBtn'); if (cb) cb.onclick = completePickup;
    var cam = document.getElementById('camBtn');
    if (cam && 'BarcodeDetector' in window && navigator.mediaDevices) { cam.hidden = false; cam.onclick = toggleCamera; }
    document.querySelectorAll('.bag-line').forEach(function (row) {
        var code = row.dataset.code, ci = row.querySelector('[data-checkin]'), un = row.querySelector('[data-undo]');
        if (ci) ci.onclick = function () { checkIn(code, row.querySelector('input').value); };
        if (un) un.onclick = function () {
            post({ group_id: M.gid, bag_code: code, action: 'undo' }).then(function (d) {
                if (!d.success) { toast(d.error, 'error'); return; }
                M.split = d.split; setRow(code, false); renderSplit();
            });
        };
    });
    renderSplit();
    if (M.focus && !M.closed) lookupBag(M.focus);
}

// ==========================================
// ADMIN (admin.php)
// ==========================================
function renderAdmin() {
    var role = D.role();
    if (role !== 'admin' && role !== 'collector') return null;
    var T = D.T, users = T('users');
    var stats = {
        users: users.filter(function (u) { return u.role === 'user'; }).length,
        groups: T('group_pickups').filter(function (g) { return ['open', 'full', 'collected'].indexOf(g.status) >= 0; }).length,
        dropoffs: T('drop_offs').filter(function (d) { return d.status === 'pending'; }).length,
        owed: T('payment_transactions').filter(function (t) { return t.status === 'pending'; }).reduce(function (a, t) { return a + (+t.amount || 0); }, 0),
        kg: T('user_rewards').reduce(function (a, r) { return a + (+r.total_weight_kg || 0); }, 0)
    };
    var dropoffs = T('drop_offs').filter(function (d) { return d.status === 'pending'; }).sort(function (a, b) { return a.created_at < b.created_at ? -1 : 1; }).map(function (d) {
        var u = D.byId('users', d.user_id) || {}, m = D.byId('material_prices', d.material_id) || {}, c = D.byId('recycling_centers', d.center_id) || {};
        return Object.assign({}, d, { username: u.username, full_name: u.full_name, material_name: m.material_name, art: m.art, resin_code: m.resin_code, category: m.category, price_per_kg: m.price_per_kg, center_name: c.name });
    });
    var payouts = T('payment_transactions').filter(function (t) { return t.status === 'pending'; }).sort(function (a, b) { return a.created_at < b.created_at ? -1 : 1; }).map(function (t) {
        var u = D.byId('users', t.user_id) || {}, pm = T('payment_methods').filter(function (p) { return p.user_id === t.user_id && p.is_default; })[0] || {};
        return Object.assign({}, t, { username: u.username, full_name: u.full_name, payment_type: pm.payment_type, bank_name: pm.bank_name, account_number: pm.account_number, account_name: pm.account_name, tng_phone: pm.tng_phone });
    });
    var materials = T('material_prices').slice().sort(function (a, b) { return a.category < b.category ? -1 : a.category > b.category ? 1 : a.material_name.localeCompare(b.material_name); });
    var history = T('price_history').slice().sort(function (a, b) { return a.changed_at < b.changed_at ? 1 : -1; }).slice(0, 10);

    var h = '<div class="pg-admin"><div class="wrap"><a href="#home" class="link-btn"><i class="fas fa-arrow-left"></i> Back to app</a><div class="page-head"><div>' +
        '<h2><i class="fas fa-shield-halved" style="color:var(--brand-2)"></i> Admin panel</h2><p class="muted">Verify drop-offs, send payouts and keep prices current.</p></div></div>' +
        '<div class="stat-grid"><div class="stat"><i class="fas fa-users"></i><div><strong>' + stats.users + '</strong><small>Recyclers</small></div></div>' +
        '<div class="stat"><i class="fas fa-truck-ramp-box"></i><div><strong>' + stats.groups + '</strong><small>Active group pickups</small></div></div>' +
        '<div class="stat"><i class="fas fa-box-open"></i><div><strong>' + stats.dropoffs + '</strong><small>Drop-offs to verify</small></div></div>' +
        '<div class="stat"><i class="fas fa-money-bill-wave"></i><div><strong>' + money(stats.owed) + '</strong><small>Payouts owed</small></div></div>' +
        '<div class="stat"><i class="fas fa-weight-scale"></i><div><strong>' + nf(stats.kg, 0) + ' kg</strong><small>Recycled in total</small></div></div></div>';
    h += '<div class="card"><div class="card-title"><i class="fas fa-box-open"></i> Drop-offs waiting for verification</div>' +
        (dropoffs.length ? '<div class="scroll"><table class="tbl"><thead><tr><th>User</th><th>Material</th><th>Center &amp; date</th><th>Claimed</th><th>Weighed kg</th><th></th></tr></thead><tbody>' +
            each(dropoffs, function (d) {
                return '<tr id="do-' + d.id + '"><td><strong>' + e(d.full_name || d.username) + '</strong><br><small class="muted">@' + e(d.username) + '</small></td>' +
                    '<td><div class="mat">' + matIcon(d) + '<span>' + e(d.material_name) + '<br><small class="muted">' + money(d.price_per_kg) + '/kg</small></span></div></td>' +
                    '<td>' + e(d.center_name) + '<br><small class="muted">' + (d.dropoff_date ? date('D, M d', d.dropoff_date) : '-') + (d.notes ? ' &middot; ' + e(d.notes) : '') + '</small></td>' +
                    '<td>' + nf(d.weight_kg, 2) + ' kg</td><td><input class="form-control" type="number" step="0.01" min="0.1" value="' + e(d.weight_kg) + '"></td>' +
                    '<td style="white-space:nowrap"><button class="btn btn-primary btn-sm" onclick="SWAdmin.verify(' + d.id + ')"><i class="fas fa-check"></i> Verify</button> ' +
                    '<button class="btn btn-danger-ghost btn-sm" onclick="SWAdmin.reject(' + d.id + ')" title="Reject"><i class="fas fa-xmark"></i></button></td></tr>' +
                    '<tr class="reject-row" id="rj-' + d.id + '" hidden><td colspan="6"><div class="reject-box"><input class="form-control" value="Not received at the center" aria-label="Reason shown to the user">' +
                    '<button class="btn btn-danger-ghost btn-sm" onclick="SWAdmin.confirmReject(' + d.id + ')">Reject drop-off</button><button class="btn btn-ghost btn-sm" onclick="SWAdmin.reject(' + d.id + ')">Cancel</button></div></td></tr>';
            }) + '</tbody></table></div>' : '<div class="empty-state small"><i class="fas fa-circle-check"></i>Nothing to verify.</div>') + '</div>';
    h += '<div class="card"><div class="card-title"><i class="fas fa-money-bill-transfer"></i> Payouts to send</div><p class="muted small" style="margin-bottom:8px">Send the money with the user\'s payment method, then mark it paid. The user gets a notification with the reference.</p>' +
        (payouts.length ? '<div class="scroll"><table class="tbl"><thead><tr><th>User</th><th>For</th><th>Amount</th><th>Send to</th><th>Reference (optional)</th><th></th></tr></thead><tbody>' +
            each(payouts, function (t) {
                var to = !t.payment_type ? '<span class="chip chip-red">No payment method</span>' : (t.payment_type === 'bank' ? e(t.bank_name) + '<br><small class="muted">' + e(t.account_name) + ' &middot; ' + e(t.account_number) + '</small>'
                    : (t.payment_type === 'tng' ? "Touch 'n Go" : 'GrabPay') + '<br><small class="muted">' + e(t.tng_phone) + '</small>');
                return '<tr id="pay-' + t.id + '"><td><strong>' + e(t.full_name || t.username) + '</strong><br><small class="muted">@' + e(t.username) + '</small></td>' +
                    '<td>' + e(t.material_type) + '<br><small class="muted">' + nf(t.weight_kg, 2) + ' kg &middot; ' + date('M d', t.created_at) + '</small></td><td><strong>' + money(t.amount) + '</strong></td><td>' + to + '</td>' +
                    '<td><input class="form-control src" placeholder="e.g. TNG ref"></td><td><button class="btn btn-primary btn-sm" onclick="SWAdmin.markPaid(' + t.id + ')"><i class="fas fa-check-double"></i> Mark paid</button></td></tr>';
            }) + '</tbody></table></div>' : '<div class="empty-state small"><i class="fas fa-circle-check"></i>All payouts sent.</div>') + '</div>';
    if (role === 'admin') {
        h += '<div class="card"><div class="card-title"><i class="fas fa-tags"></i> Price board <span class="muted small ml-auto">' + materials.length + ' materials</span></div>' +
            '<p class="muted small" style="margin-bottom:8px">Check a recycler\'s latest list (e.g. <a href="https://unclerecycle.com/scrap-price-list/" target="_blank" rel="noopener">Uncle Recycle</a>), then update the price, source and link. Today\'s date is saved automatically.</p>' +
            '<div class="search-box price-filter"><i class="fas fa-magnifying-glass"></i><input type="search" placeholder="Filter materials" oninput="SWAdmin.filterRows(this.value)"></div>' +
            '<div class="scroll"><table class="tbl" id="priceTbl"><thead><tr><th>Material</th><th>Min</th><th>Max</th><th>Price</th><th>Source</th><th>Link</th><th>Checked</th><th></th></tr></thead><tbody>' +
            each(materials, function (m) {
                return '<tr data-id="' + m.id + '" data-name="' + e(m.material_name.toLowerCase()) + '"><td><div class="mat">' + matIcon(m) + '<span>' + e(m.material_name) + '</span></div></td>' +
                    '<td><input class="form-control" data-f="price_min" type="number" step="0.01" value="' + e(m.price_min) + '"></td><td><input class="form-control" data-f="price_max" type="number" step="0.01" value="' + e(m.price_max) + '"></td>' +
                    '<td><input class="form-control" data-f="price_per_kg" type="number" step="0.01" value="' + e(m.price_per_kg) + '"></td><td><input class="form-control src" data-f="source" value="' + e(m.source) + '"></td>' +
                    '<td><input class="form-control src" data-f="source_url" value="' + e(m.source_url) + '" placeholder="https://"></td><td><small class="muted" data-date>' + (m.price_date ? date('d M Y', m.price_date) : '-') + '</small></td>' +
                    '<td><button class="btn btn-ghost btn-sm" onclick="SWAdmin.savePrice(this)"><i class="fas fa-floppy-disk"></i> Save</button></td></tr>';
            }) + '</tbody></table></div></div>';
        h += '<div class="card"><div class="card-title"><i class="fas fa-clock-rotate-left"></i> Recent price changes</div>' +
            each(history, function (x) {
                var m = D.byId('material_prices', x.material_id) || {}, u = D.byId('users', x.changed_by) || {};
                var chg = x.old_price > 0 ? (x.new_price - x.old_price) / x.old_price * 100 : 0;
                return '<div class="list-row"><div class="grow"><strong>' + e(m.material_name) + '</strong><small class="muted">' + money(x.old_price) + ' &rarr; ' + money(x.new_price) + ' by ' + e(u.username || '?') + ' &middot; ' + V.timeAgo(x.changed_at) + '</small></div>' +
                    '<span class="trend ' + (chg >= 0 ? 'up' : 'down') + '">' + (chg >= 0 ? '+' : '') + nf(chg, 1) + '%</span></div>';
            }) + (history.length ? '' : '<div class="empty-state small">No changes yet.</div>') + '</div>';
    }
    return h + '</div></div><div class="toast" id="toast"></div>';
}
window.SWAdmin = {
    verify: function (id) {
        var row = document.getElementById('do-' + id);
        LocalAPI('admin_action.php', { action: 'verify_dropoff', id: id, actual_weight: row.querySelector('input').value }).then(function (d) {
            if (!d.success) return toast(d.error, 'error');
            row.classList.add('row-done'); document.getElementById('rj-' + id).hidden = true;
            toast('Verified: RM ' + d.amount.toFixed(2) + ' payout created, +' + d.points + ' points');
        });
    },
    reject: function (id) { var r = document.getElementById('rj-' + id); r.hidden = !r.hidden; if (!r.hidden) r.querySelector('input').focus(); },
    confirmReject: function (id) {
        var reason = document.querySelector('#rj-' + id + ' input').value;
        LocalAPI('admin_action.php', { action: 'reject_dropoff', id: id, reason: reason }).then(function (d) {
            if (!d.success) return toast(d.error, 'error');
            document.getElementById('do-' + id).classList.add('row-done'); document.getElementById('rj-' + id).hidden = true;
            toast('Drop-off rejected');
        });
    },
    markPaid: function (id) {
        var row = document.getElementById('pay-' + id);
        LocalAPI('admin_action.php', { action: 'mark_paid', id: id, reference: row.querySelector('input').value }).then(function (d) {
            if (!d.success) return toast(d.error, 'error');
            row.classList.add('row-done'); toast('Marked paid - ref ' + d.reference);
        });
    },
    savePrice: function (btn) {
        var row = btn.closest('tr'), data = { material_id: row.dataset.id };
        row.querySelectorAll('[data-f]').forEach(function (i) { data[i.dataset.f] = i.value; });
        LocalAPI('update_price.php', data).then(function (d) {
            if (!d.success) return toast(d.error, 'error');
            row.querySelector('[data-date]').textContent = 'Today';
            toast('Saved (' + (d.change_percent >= 0 ? '+' : '') + d.change_percent + '%)');
        });
    },
    filterRows: function (q) {
        q = q.toLowerCase();
        document.querySelectorAll('#priceTbl tbody tr').forEach(function (r) { r.hidden = r.dataset.name.indexOf(q) === -1; });
    }
};

window.SWPages = { renderLogin: renderLogin, bindLogin: bindLogin, renderRegister: renderRegister, bindRegister: bindRegister, renderTags: renderTags, bindTags: bindTags, renderManifest: renderManifest, bindManifest: bindManifest, renderAdmin: renderAdmin };
})();
