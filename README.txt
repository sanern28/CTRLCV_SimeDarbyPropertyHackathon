SmartWaste - no XAMPP, no database
==================================

HOW TO OPEN
  Double-click index.html. It opens in your browser (Chrome or Edge works best).
  That's it: no XAMPP, no MySQL, no installing.

SIGN IN
  Demo user : demo  / demo123
  Admin     : admin / demo123   (opens the Admin panel: verify drop-offs, pay out, edit prices)
  You can also create new accounts on the sign-in page.

WHERE THE DATA IS KEPT
  Everything (accounts, pickups, bag tags, payments, chat) is saved in your browser's
  own storage on this computer. Closing the browser keeps it.
  - Each browser / computer has its own copy of the data.
  - Profile > Settings > Demo data > Reset puts the sample data back.

INTERNET
  Works offline, except: the map tiles, the map itself (Leaflet) and the Google fonts
  need internet. Everything else (prices, pickups, tags, manifest, EcoBot) works offline.

LOCATION
  "Get my location" uses your real GPS like before. If the browser blocks it,
  choose your area from the list instead.

PRINTING BAG LABELS
  Pickups > My pickups & tags > Print my labels, then press Print.
  Each label has a QR code that opens the manifest for that bag.

ECOBOT
  Answers recycling questions with the built-in assistant (real prices from the app).

Switching back to the PHP version later: CTRL_CV_v3.1.zip still works with XAMPP unchanged.

FILES
  index.html      the page (open this)
  css/style.css   design (same as v3.1)
  css/pages.css   styles for labels, manifest and admin pages
  js/data.js      sample data: users, 55 material prices, centers, groups...
  js/db.js        replaces PHP + MySQL (login, create/join group, check-in, payouts...)
  js/bot.js       EcoBot answers
  js/views.js     main app screens (Home, Prices, Pickups, Map, Rewards, Profile)
  js/pages.js     Sign in, Register, Bag labels, Manifest, Admin
  js/script.js    buttons, forms, map, calculator, chat (from v3.1)
  js/app.js       switches between pages
  Icons, fonts and the map load from the internet; the rest works offline.
