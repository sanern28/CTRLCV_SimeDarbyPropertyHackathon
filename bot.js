/* =========================================================
   EcoBot - same answers as ai_chat.php.
   Uses Claude when the page runs as a claude.ai artifact (the "sample"
   capability); everywhere else it uses the built-in offline answers,
   which read the real prices from the local database.
   ========================================================= */
(function () {
'use strict';

function nf(n) { return (+n || 0).toFixed(2); }
function rx(w) { return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function hasAny(text, words) {
    return words.some(function (w) { return new RegExp('(?<![a-z])' + rx(w), 'i').test(text); });
}
var ALIASES = {
    'Aluminium Drink Cans': ['cans', 'drink can', 'soda can', 'beer can', 'tin minuman', 'tin aluminium', 'aluminium can', 'aluminum can', 'coke can'],
    'Aluminium (Clean / Rims)': ['rim', 'aluminium sheet', 'aluminum sheet'],
    'Aluminium (Mixed)': ['aluminium', 'aluminum'],
    'PET Bottles (Clear)': ['bottle', 'botol', 'pet', 'mineral water', 'air mineral'],
    'HDPE Bottles': ['hdpe', 'milk jug', 'detergent', 'shampoo'],
    'Cardboard (OCC)': ['cardboard', 'kotak', 'carton box', 'box', 'kadbod'],
    'Old Newspaper': ['newspaper', 'surat khabar', 'akhbar'],
    'White Office Paper': ['a4', 'office paper', 'kertas putih', 'printing paper'],
    'Mixed Paper / Magazines': ['paper', 'kertas', 'magazine', 'majalah'],
    'Books (Softcover)': ['book', 'buku', 'textbook'],
    'Beverage Cartons': ['tetra', 'milk carton', 'juice carton'],
    'Clear Glass Bottles': ['glass', 'kaca', 'jar'],
    'Copper Grade A': ['copper', 'tembaga'],
    'Insulated Copper Cable': ['wire', 'cable', 'wayar', 'kabel'],
    'Brass (Loyang)': ['brass', 'loyang', 'tap', 'faucet'],
    'Stainless Steel (Mixed)': ['stainless', 'steel'],
    'Light Mixed Iron': ['iron', 'besi', 'scrap metal', 'besi buruk'],
    'Steel Food Cans': ['food can', 'sardine', 'tin susu'],
    'Car Battery (Lead-Acid)': ['car battery', 'bateri kereta', 'motorcycle battery'],
    'Lithium-ion Batteries': ['power bank', 'lithium', 'li-ion', 'battery', 'bateri'],
    'Mobile Phones': ['phone', 'handphone', 'telefon', 'smartphone'],
    'Laptops (Whole)': ['laptop', 'notebook'],
    'Motherboards / PCB': ['motherboard', 'pcb', 'circuit board'],
    'Cables & Chargers': ['charger', 'usb'],
    'Small Appliances': ['kettle', 'fan', 'rice cooker', 'iron (clothes)', 'appliance'],
    'Used Cooking Oil': ['cooking oil', 'minyak masak', 'oil', 'minyak'],
    'Used Clothes / Textiles': ['clothes', 'baju', 'textile', 'cloth', 'shirt', 'pakaian'],
    'Shoes & Bags': ['shoe', 'kasut', 'handbag'],
    'PP Containers & Caps': ['container', 'cap', 'bekas', 'tupperware'],
    'LDPE Film / Plastic Bags': ['plastic bag', 'beg plastik', 'shrink wrap'],
    'Polystyrene (Styrofoam)': ['styrofoam', 'polystyrene', 'polisterin'],
    'PVC Pipes': ['pvc', 'pipe', 'paip'],
    'Mixed Plastic': ['plastic', 'plastik'],
    'Food & Garden Waste': ['food waste', 'sisa makanan', 'leaves', 'compost'],
    'Electric Motors': ['motor'],
    'Aircon Radiator (Cu/Al)': ['aircon', 'radiator', 'penghawa']
};
function findMaterials(text, materials) {
    var byName = {}, found = {}, order = [];
    materials.forEach(function (m) { byName[m.material_name] = m; });
    function add(n) { if (!found[n]) order.push(n); found[n] = byName[n]; }
    Object.keys(ALIASES).forEach(function (name) {
        if (!byName[name]) return;
        if (ALIASES[name].some(function (w) { return new RegExp('\\b' + rx(w) + 's?\\b', 'i').test(text); })) add(name);
    });
    materials.forEach(function (m) { if (text.indexOf(m.material_name.toLowerCase()) >= 0) add(m.material_name); });
    function drop(n) { delete found[n]; }
    if (found['Aluminium Drink Cans']) drop('Aluminium (Mixed)');
    if (found['PET Bottles (Clear)'] || found['LDPE Film / Plastic Bags']) drop('Mixed Plastic');
    if (found['Car Battery (Lead-Acid)']) drop('Lithium-ion Batteries');
    if (found['Steel Food Cans']) drop('Aluminium Drink Cans');
    if (found['Insulated Copper Cable'] && !/\bcopper|tembaga/i.test(text)) drop('Copper Grade A');
    if (found['Old Newspaper'] || found['White Office Paper']) drop('Mixed Paper / Magazines');
    return order.filter(function (n) { return found[n]; }).map(function (n) { return found[n]; }).slice(0, 4);
}
function priceList(found) {
    return "Today's prices:\n\n" + found.map(function (m) {
        return '- **' + m.material_name + '**: RM ' + nf(m.price_min) + ' - ' + nf(m.price_max) + '/kg (typical **RM ' + nf(m.price_per_kg) + '**). ' + m.prep_tips;
    }).join('\n') + '\n\nThese are indicative Malaysian buy-back prices. Clean, sorted material gets the higher end. Ask me something like "how much for 5kg of cans" to calculate.';
}
function fmtDate(d, t) {
    var x = window.SWDB.parseDate(d + ' ' + (t || '00:00'));
    return x.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit' }) + ' ' + x.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function offlineAnswer(message, ctx) {
    var t = message.toLowerCase(), user = ctx.user, materials = ctx.materials, myGroups = ctx.groups, centers = ctx.centers, C = ctx.cfg;
    var name = (user.full_name || user.username).split(' ')[0];
    var asksPrice = hasAny(t, ['price', 'harga', 'how much', 'worth', 'rm', 'sell', 'jual', 'earn', 'value', 'pay for', 'berapa', 'rate']);
    var found = findMaterials(t, materials), mm;

    if (found.length && (mm = t.match(/(\d+(?:\.\d+)?)\s*(kg|kilo|kilogram)/))) {
        var kg = parseFloat(mm[1]), m = found[0];
        return '**' + kg + ' kg of ' + m.material_name + '** is worth about **RM ' + nf(kg * m.price_per_kg) + '** (range RM ' + nf(kg * m.price_min) + ' - RM ' + nf(kg * m.price_max) + ').\n\n' +
            'Prep tip: ' + m.prep_tips + '\n\nIn a group pickup you also pay a small share of the delivery fee, split by weight. You can try other amounts in the **calculator on the Prices tab**.';
    }
    if (hasAny(t, ['my group', 'my pickup', 'my tag', 'my code', 'when is my', 'upcoming'])) {
        if (!myGroups.length) return "You're not in any group pickup yet. Open the **Pickups** tab to join one near you, or tap **Create group** to start your own.";
        return 'Your group pickups:\n\n' + myGroups.map(function (g) {
            return '- **' + g.group_code + '** at ' + g.center_name + ' on ' + fmtDate(g.pickup_date, g.pickup_time) + '. Your tag: **' + g.tag_code + ' (' + g.tag_color + ')**, status: ' + g.status;
        }).join('\n') + '\n\nOpen **Pickups > My Tags** to print your bag labels.';
    }
    if (hasAny(t, ['whose', 'tag', 'label', 'mix up', 'mixed up', 'mixup', 'which bag', 'identify', 'qr', 'someone else', 'my bag', 'siapa punya', 'mark my'])) {
        return 'Every bag in a group pickup is tagged, so nothing gets mixed up:\n\n' +
            '1. When you join a group you get a **number, a colour and a tag code**, e.g. **KL7Q-02 (Blue)**.\n' +
            '2. Each bag you list gets its own **bag code**, e.g. **KL7Q-02-B1**, **KL7Q-02-B2**.\n' +
            '3. Go to **Pickups > My Tags** and print the labels (they have a QR code). No printer? Write the bag code on the bag with a marker and tie a ribbon or tape in your colour.\n' +
            '4. On pickup day the organiser opens the **Manifest**, scans or types each code and enters the **real weight**.\n' +
            '5. When the organiser taps **Complete**, each person is paid only for their own bags, minus their share of the delivery fee.';
    }
    if (hasAny(t, ['first step', 'how do i send', 'how to send', 'send my', 'send rubbish', 'send the rubbish', 'get started', 'where do i start', 'where to start', 'how does it work', 'how it works', 'what should i do', 'what do i do', 'macam mana', 'bagaimana', 'cara hantar', 'steps', 'step by step', 'begin'])) {
        return "Here's how to send your rubbish, " + name + ':\n\n' +
            '1. **Sort it** by material: plastic, paper, metal, glass, e-waste. Check the **Prices tab** to see what each is worth.\n' +
            '2. **Clean and prepare**: rinse bottles and cans, flatten boxes, keep paper dry.\n' +
            '3. **Bag and weigh** each material separately. A bathroom scale works: weigh yourself with and without the bag.\n' +
            '4. **Group them together with neighbours**: open **Pickups**, join a group near you or create one. Sharing one delivery is cheaper.\n' +
            "5. **Add your bags** (material + kg). You'll get your colour and tag code.\n" +
            '6. **Label your bags**: print them from **My Tags** or write the code on each bag.\n' +
            "7. **Hand over** on pickup day. The organiser checks each bag and its weight, and your money goes to your **Touch 'n Go / GrabPay / bank**.\n\n" +
            'Tip: add a payment method in **Profile** first so you can be paid.';
    }
    if (found.length && hasAny(t, ['can i recycle', 'recyclable', 'recycle this', 'boleh kitar', 'accept', 'can you recycle'])) {
        var a = found[0], ok = a.price_per_kg > 0.05;
        return (ok ? 'Yes, **' + a.material_name + '** can be recycled' : '**' + a.material_name + '** has little or no cash value') +
            ' - about **RM ' + nf(a.price_min) + ' - ' + nf(a.price_max) + ' per kg**.\n\nHow to prepare it: ' + a.prep_tips;
    }
    if (found.length && asksPrice) return priceList(found);
    if (found.length && hasAny(t, ['clean', 'prepare', 'wash', 'rinse', 'separate', 'basuh', 'how should i', 'how do i pack'])) {
        return 'How to prepare it:\n\n' + found.map(function (m) { return '- **' + m.material_name + '**: ' + m.prep_tips; }).join('\n') + '\n\nClean, dry and sorted material gets the **top of the price range**.';
    }
    if (hasAny(t, ['most valuable', 'highest price', 'best price', 'most money', 'paling mahal', 'top price', 'what pays'])) {
        return 'The most valuable materials right now:\n\n' + materials.slice().sort(function (x, y) { return y.price_per_kg - x.price_per_kg; }).slice(0, 6)
            .map(function (m) { return '- **' + m.material_name + '**: ~RM ' + nf(m.price_per_kg) + '/kg'; }).join('\n') +
            '\n\nMetals (especially **copper** and **aluminium**) pay the most. Paper and glass pay little per kg, but they add up in a group pickup.';
    }
    if (hasAny(t, ['group', 'together', 'neighbour', 'neighbor', 'join', 'share delivery', 'kongsi', 'create a pickup', 'organise', 'organize'])) {
        return '**Group pickups** let neighbours share one delivery:\n\n' +
            '- **Join**: open **Pickups**, pick a group, tap **Join**, add your bags (material + kg).\n' +
            '- **Create**: tap **Create group**, choose a recycling center, date, time and how many people can join, then share the link.\n' +
            '- **Cost**: one trip costs RM ' + nf(C.DELIVERY_BASE_FEE) + ' (first ' + C.DELIVERY_FREE_KG + ' kg free, then RM ' + nf(C.DELIVERY_PER_KG) + "/kg). It's split **by weight**, so a small bag pays a small share.\n" +
            '- **No mix-ups**: everyone gets a colour and tag code, and every bag has its own code and QR label.';
    }
    if (hasAny(t, ['delivery', 'fee', 'cost', 'charge', 'kos', 'bayar', 'transport'])) {
        return 'Delivery fee per group trip: **RM ' + nf(C.DELIVERY_BASE_FEE) + '** base, with the first ' + C.DELIVERY_FREE_KG + ' kg free, then **RM ' + nf(C.DELIVERY_PER_KG) + ' per kg**.\n\n' +
            'The fee is split **in proportion to weight**. Example: a 30 kg group pays RM ' + nf(ctx.deliveryCost(30)) + '; if your bags are 6 kg (20%), your share is RM ' + nf(ctx.deliveryCost(30) * 0.2) + '.';
    }
    if (hasAny(t, ['clean', 'prepare', 'sort', 'wash', 'rinse', 'separate', 'asing', 'basuh'])) {
        return 'How to prepare your recyclables:\n\n- **Plastic bottles & cans**: empty, rinse, squash. Keep caps separate.\n' +
            '- **Cardboard & paper**: flatten, remove tape and styrofoam, keep **dry** (wet paper is often rejected).\n' +
            "- **Metal**: use a magnet - aluminium and copper don't stick and are worth much more than iron.\n" +
            '- **Glass**: rinse, remove caps, no broken window glass or mirrors.\n- **E-waste**: wipe your data, tape battery terminals.\n' +
            '- **Cooking oil**: cool, strain, store in a sealed bottle.\n\nClean, sorted material gets the **top of the price range**.';
    }
    if (hasAny(t, ['not recyclable', 'cannot recycle', "can't recycle", 'tak boleh', 'diaper', 'tissue', 'ceramic', 'mirror'])) {
        return 'Usually **not accepted**: diapers, used tissue, food-soiled paper or boxes, ceramics, mirrors and window glass, light bulbs (take them to an e-waste point), and most styrofoam.\n\nWhen unsure, check the **Prices tab** or ask me "can I recycle ...".';
    }
    if (hasAny(t, ['e-waste', 'ewaste', 'electronic', 'hazard', 'dangerous'])) {
        return '**E-waste tips:**\n\n1. Back up and wipe phones and laptops (factory reset, remove SIM/SD).\n2. Tape lithium battery terminals - they can start fires.\n3. Never break open batteries or CRT screens.\n4. Car batteries: keep upright and hand to a licensed buyer.\n\nMotherboards, phones and cables pay well - see the **E-Waste** filter on the Prices tab.';
    }
    if (hasAny(t, ['point', 'reward', 'redeem', 'voucher', 'level', 'mata'])) {
        return 'You have **' + (+user.total_points || 0).toLocaleString('en-US') + ' points** (' + user.level + ' level).\n\n- You earn **' + C.POINTS_PER_KG + ' points per kg** when a pickup is completed.\n' +
            '- Redeem them in the **Rewards** tab for partner vouchers.\n- Levels: Silver at 2,000, Gold at 5,000, Platinum at 10,000 points.';
    }
    if (hasAny(t, ['paid', 'payment', 'money', 'bank', 'tng', 'touch n go', "touch 'n go", 'grabpay', 'ewallet', 'e-wallet', 'duit', 'wang'])) {
        return "How you get paid:\n\n1. Add a payment method in **Profile > Payment Method** (Touch 'n Go, GrabPay or bank).\n2. After the pickup the organiser checks your bags in and taps **Complete**.\n3. Your earnings (weight x price, minus your delivery share) appear in **Payment History** as pending, then paid.";
    }
    if (hasAny(t, ['center', 'centre', 'nearest', 'near me', 'location', 'where can', 'open', 'pusat', 'dekat'])) {
        return 'Some top-rated recycling centers:\n\n' + centers.slice(0, 4).map(function (c) { return '- **' + c.name + '** (' + c.city + ') - ' + c.operating_hours; }).join('\n') +
            '\n\nOpen the **Map** (Home > Find centers) and tap **Get my location** to see the nearest one and its distance.';
    }
    if (hasAny(t, ['profile', 'photo', 'picture', 'password', 'username', 'email', 'address', 'edit'])) {
        return 'Go to **Profile > Edit profile** to change your name, username, email, phone, address, bio, avatar colour or photo. **Change password** is in the same place. Your saved address is filled in automatically when you join a group.';
    }
    if (asksPrice) {
        return 'There are ' + materials.length + ' materials on the **Prices tab**, with a min-max range and a typical price for each. You can search, filter by category and use the earnings calculator there.\n\n' +
            'Ask me about a specific item, for example: "price of copper", "how much for 10kg cardboard" or "berapa harga tin aluminium".';
    }
    if (found.length) return priceList(found);
    if (/^(hi|hello|hey|hai|helo|salam|yo|good (morning|afternoon|evening))\b/.test(t)) {
        return 'Hi ' + name + "! I'm **EcoBot**. Ask me things like:\n\n- What's the first step to send my rubbish?\n- How much is copper?\n- How do we know whose rubbish is whose in a group?\n- How is the delivery fee split?";
    }
    if (hasAny(t, ['thank', 'thanks', 'terima kasih', 'tq'])) return "You're welcome! Every kg you recycle keeps it out of a landfill.";
    return 'I can help with:\n\n- **Getting started**: "What\'s the first step to send my rubbish?"\n- **Prices**: "How much is copper?" or "how much for 5kg of cans"\n- **Group pickups**: "How do group pickups work?"\n- **Bag tags**: "How do we know whose rubbish is whose?"\n- **Preparing items**: "How should I clean plastic bottles?"\n- **Payments & points**\n\nTry asking one of these!';
}

// ---------- Claude (only inside a claude.ai artifact) ----------
var sampleFn = null, EcoBot = { aiReady: false };
function systemPrompt(ctx) {
    var C = ctx.cfg, u = ctx.user;
    return "You are EcoBot, the friendly assistant inside SmartWaste, a Malaysian 'turn trash to cash' recycling app.\n" +
        "Answer in the user's language (English, Malay or Chinese). Keep answers short and practical: use numbered steps for how-to questions and **bold** for key words. Prices are in RM and are indicative ranges - real prices depend on the buyer, grade and cleanliness.\n\n" +
        'HOW SMARTWASTE WORKS (use these exact feature names):\n1. Sort rubbish by material (Prices tab shows what each is worth and how to prepare it).\n' +
        '2. Clean, dry, flatten. Weigh each bag roughly (bathroom scale: weigh yourself with and without the bag).\n' +
        '3. Pickups tab: join a nearby group pickup or create one (choose a recycling center, date, time). Groups share one delivery fee: RM ' + nf(C.DELIVERY_BASE_FEE) + ' per trip, first ' + C.DELIVERY_FREE_KG + ' kg free, then RM ' + nf(C.DELIVERY_PER_KG) + '/kg, split by weight.\n' +
        '4. When you join, you add each bag (material + estimated kg). You get a colour + number + tag code, e.g. KL7Q-02 (Blue), and every bag gets a code like KL7Q-02-B1.\n' +
        '5. Print bag labels (Pickups > My Tags) or write the bag code on the bag with a marker and tie a ribbon in your colour. This is how the group knows whose rubbish is whose.\n' +
        '6. On pickup day the organiser opens the Manifest, scans or types each bag code, and enters the real weight.\n' +
        "7. The organiser taps Complete: each person is paid for their own bags (weight x price) minus their share of the delivery fee, to their Touch 'n Go/GrabPay/bank (Profile > Payment Method), and earns " + C.POINTS_PER_KG + ' points per kg.\n' +
        '8. Points can be redeemed in the Rewards tab. Profile tab: edit profile, photo, password, payment methods.\n\n' +
        'USER: ' + u.username + ' (' + u.level + ' level, ' + (+u.total_points || 0) + ' points, address: ' + (u.address || 'not set') + ')\n' +
        "USER'S GROUPS:\n" + (ctx.groups.length ? ctx.groups.map(function (g) { return '- Group ' + g.group_code + ' at ' + g.center_name + ' on ' + g.pickup_date + ' ' + String(g.pickup_time).slice(0, 5) + ', status ' + g.status + ', user tag ' + g.tag_code + ' (' + g.tag_color + ')'; }).join('\n') : '- none yet') + '\n\n' +
        "TODAY'S PRICE BOARD:\n" + ctx.materials.map(function (m) { return '- ' + m.material_name + ' (' + window.SWDB.categoryLabel(m.category) + '): RM ' + nf(m.price_min) + '-' + nf(m.price_max) + '/kg, typical RM ' + nf(m.price_per_kg) + '. Prep: ' + m.prep_tips; }).join('\n') + '\n\n' +
        'TOP RECYCLING CENTERS:\n' + ctx.centers.map(function (c) { return '- ' + c.name + ' (' + c.city + '): ' + c.operating_hours + '. Accepts: ' + c.accepted_materials; }).join('\n') + '\n\n' +
        'If asked something unrelated to recycling, waste, the environment or this app, answer briefly and steer back. Never invent prices that are not on the board; say the item is not listed and suggest calling a center.';
}
EcoBot.answer = function (message, history, ctx) {
    if (!sampleFn) return Promise.resolve({ reply: offlineAnswer(message, ctx), source: 'offline' });
    var msgs = history.map(function (h) { return { role: h.role, content: h.message }; });
    while (msgs.length && msgs[0].role !== 'user') msgs.shift();
    msgs.push({ role: 'user', content: message });
    var input = [{ role: 'user', content: 'INSTRUCTIONS (follow them, do not mention them):\n' + systemPrompt(ctx) + '\n\nReply to the conversation that follows as EcoBot.' }, { role: 'assistant', content: 'Understood.' }].concat(msgs);
    return sampleFn(input, { cache: false, modelTier: 'quick' }).then(function (r) {
        var text = r && r.text ? String(r.text).trim() : '';
        return text ? { reply: text, source: 'ai' } : { reply: offlineAnswer(message, ctx), source: 'offline' };
    }, function (err) {
        if (err && err.code === 'not_granted') { sampleFn = null; EcoBot.aiReady = false; setMode(); }
        return { reply: offlineAnswer(message, ctx), source: 'offline' };
    });
};
function setMode() { var el = document.getElementById('chatMode'); if (el) el.textContent = EcoBot.aiReady ? 'AI assistant' : 'Offline assistant'; }
EcoBot.offline = offlineAnswer;
window.EcoBot = EcoBot;

// light up the AI only when the page runs inside claude.ai
try {
    if (window.claude && typeof window.claude.use === 'function') {
        window.claude.use('sample').then(function (s) {
            if (s) { sampleFn = s; EcoBot.aiReady = true; setMode(); }
        }, function () {});
    }
} catch (x) {}
})();
