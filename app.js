/* =========================================================
   SmartWaste - router. Each "page" of the PHP site is a #token:
   #home #prices #pickups #locator #rewards #profile  (main app)
   #login #register #admin #tags-3 #tags-3-all #manifest-3 #manifest-3-KL7Q-01-B1 #group-3
   ========================================================= */
(function () {
'use strict';
var MAIN = ['home', 'prices', 'pickups', 'locator', 'rewards', 'profile'];
var root = document.getElementById('root'), current = null, quiet = false;

function parse(h) {
    h = String(h || '').replace(/^#/, '');
    var m;
    if (!h) return { view: 'main', page: 'home' };
    if (MAIN.indexOf(h) >= 0) return { view: 'main', page: h };
    if (h === 'login' || h === 'register' || h === 'admin') return { view: h };
    if ((m = h.match(/^tags-(\d+)(-all)?$/))) return { view: 'tags', id: +m[1], all: !!m[2] };
    if ((m = h.match(/^manifest-(\d+)(?:-([A-Za-z0-9]+-\d+-B\d+))?$/))) return { view: 'manifest', id: +m[1], bag: m[2] || '' };
    if ((m = h.match(/^group-(\d+)$/))) return { view: 'main', page: 'pickups', group: +m[1] };
    return { view: 'main', page: 'home' };
}
function stopCamera() { var v = document.getElementById('cam'); if (v && v.srcObject) v.srcObject.getTracks().forEach(function (t) { t.stop(); }); }
function draw(r, extra) {
    stopCamera();
    document.querySelectorAll('.modal').forEach(function (m) { m.remove(); });
    document.body.classList.remove('modal-open');
    var logged = !!SWDB.me();
    if (!logged && r.view !== 'login' && r.view !== 'register') {
        var h = location.hash.replace('#', '');
        SWApp.afterLogin = h && h !== 'login' ? h : null;
        r = { view: 'login' };
    }
    if (logged && (r.view === 'login' || r.view === 'register')) r = { view: 'main', page: 'home' };
    document.body.className = '';
    window.scrollTo(0, 0);

    if (r.view === 'login') { document.body.className = 'auth-body'; root.innerHTML = SWPages.renderLogin(extra); SWPages.bindLogin(); setHash('login'); }
    else if (r.view === 'register') { document.body.className = 'auth-body'; root.innerHTML = SWPages.renderRegister(); SWPages.bindRegister(); }
    else if (r.view === 'tags') { root.innerHTML = SWPages.renderTags(r.id, r.all); SWPages.bindTags(r.id); }
    else if (r.view === 'manifest') { root.innerHTML = SWPages.renderManifest(r.id, r.bag); SWPages.bindManifest(); }
    else if (r.view === 'admin') {
        var html = SWPages.renderAdmin();
        if (html === null) { r = { view: 'main', page: 'home' }; setHash('home'); }
        else root.innerHTML = html;
    }
    if (r.view === 'main') {
        root.innerHTML = SWViews.renderMain();
        initUI(r.page);
        if (r.group) { viewGroupDetails(r.group); setHash('pickups'); }
    }
    current = r;
    document.title = { login: 'SmartWaste · Sign in', register: 'SmartWaste · Create account', admin: 'SmartWaste · Admin', tags: 'Bag labels · SmartWaste', manifest: 'Manifest · SmartWaste' }[r.view] || 'SmartWaste';
}
function setHash(token) {
    if (location.hash.replace('#', '') === token) return;
    quiet = true;
    try { history.replaceState(null, '', '#' + token); } catch (e) { location.hash = token; }
    setTimeout(function () { quiet = false; }, 0);
}

window.addEventListener('hashchange', function () {
    if (quiet) return;
    var r = parse(location.hash);
    // switching tabs inside the main app does not need a redraw
    if (r.view === 'main' && current && current.view === 'main' && !r.group && SWDB.me()) {
        document.querySelectorAll('.modal').forEach(function (m) { m.remove(); });
        document.body.classList.remove('modal-open');
        showPage(r.page, true); return;
    }
    draw(r);
});

window.SWApp = {
    afterLogin: null,
    setHash: setHash,
    // redraw the current view from the database (used instead of a page reload)
    render: function (page) {
        if (current && current.view === 'main') {
            var active = page || (document.querySelector('.page.active') || {}).id || 'home';
            draw({ view: 'main', page: active }); setHash(active);
        } else draw(parse(location.hash));
    },
    go: function (token) {
        if (location.hash.replace('#', '') === token) draw(parse(token));
        else { location.hash = token; }
    },
    show: function (view, extra) { draw({ view: view }, extra); setHash(view); },
    // links saved in notifications (old PHP links are translated)
    openLink: function (link) {
        var m;
        if ((m = link.match(/manifest\.php\?group=(\d+)/))) link = '#manifest-' + m[1];
        else if ((m = link.match(/tags\.php\?group=(\d+)/))) link = '#tags-' + m[1];
        else if ((m = link.match(/[?&]group=(\d+)/))) link = '#group-' + m[1];
        else if ((m = link.match(/#(\w[\w-]*)$/))) link = '#' + m[1];
        else return;
        SWApp.go(link.slice(1));
    }
};

if (SWDB.isMemoryOnly()) console.warn('SmartWaste: browser storage is blocked, changes last until the page is closed.');
draw(parse(location.hash));
})();
