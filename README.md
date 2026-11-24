# ScrollStopp

A tiny browser extension that blocks time wasting websites and shows you a research fact instead. It is built to help you take your time back from Instagram, TikTok and friends.

Works in **Chrome, Edge, Brave, Opera, Vivaldi, Firefox and Safari** from one shared code base. Plain Manifest V3, vanilla JavaScript, HTML and CSS. No frameworks, no bundler, no build step, no external libraries. Blocking is done entirely by the browser's own `declarativeNetRequest` engine, so there are no content scripts and nothing runs on the pages you visit.

## What it does

* **Blocks sites** by redirecting them to a friendly blocked page. A domain entry covers all of its subdomains, so `instagram.com` also blocks `www.instagram.com` and `m.instagram.com`. Only real page loads (`main_frame` requests) are touched.
* **Default blocklist:** instagram.com, tiktok.com, facebook.com, x.com, twitter.com, reddit.com and youtube.com/shorts. Only the Shorts path is blocked on YouTube, the rest of YouTube keeps working.
* **Blocked page:** the name of the blocked site, a motivating line, an estimated "time saved" counter and a **"Did you know?"** fact from published research, with a link to the study. Add your own images and it shows a random one too.
* **Popup:** shows whether the current site is blocked, a one click "Block this site" button, today's blocked attempts and your list of blocked sites.
* **Friction to unblock:** removing a site means waiting 30 seconds AND typing "I choose to waste my time" (pasting is disabled).
* **Optional schedule:** block always (default) or only during chosen hours and days.
* **Stats:** blocked attempts per day and per site, kept locally on each device.
* **English and German**, picked automatically from your browser language.
* **Light and dark mode** following your system setting.

## Install

First get the code: clone this repository or download it as a ZIP and unpack it. The extension itself is the `ScrollStopp` folder (the one that contains `manifest.json`).

### Chrome, Edge, Brave, Opera, Vivaldi

1. Open the extensions page: `chrome://extensions` (Chrome, Brave, Vivaldi), `edge://extensions` (Edge) or `opera://extensions` (Opera).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select the `ScrollStopp` folder.
4. Pin ScrollStopp from the puzzle icon in the toolbar so the popup is one click away.

### Firefox (version 140 or newer)

For a quick try:

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and pick `ScrollStopp/manifest.json`.

An extension loaded this way is removed when Firefox closes. To keep it for good, Firefox needs a signed copy: zip the folder and upload it to [addons.mozilla.org](https://addons.mozilla.org/developers/) as **"On your own"** (unlisted). Mozilla signs it, usually within minutes, and you install the `.xpi` it gives you. To make the zip:

```bash
cd ScrollStopp && zip -r ../scrollstopp.zip . -x 'tools/*'
```

### Safari (macOS, Safari 16.4 or newer)

Safari only runs extensions packaged inside a Mac app, which needs a Mac with Xcode:

1. In Terminal, from the repository folder:

```bash
xcrun safari-web-extension-converter ScrollStopp --app-name ScrollStopp
```

2. Xcode opens the generated project. Press **Run** (the play button).
3. In Safari open **Settings → Advanced** and turn on **Show features for web developers**, then **Develop → Allow Unsigned Extensions** (needed for your own builds).
4. In **Settings → Extensions**, turn on ScrollStopp and allow it on the default sites (or on every website).

Safari asks you to grant website access in its own settings, so a site may show **Needs access** in ScrollStopp until you allow it there or click **Allow**. The Safari build has not been tested yet; Chrome and Firefox have.

## Permissions and why each one is needed

ScrollStopp asks for as little as possible. When you install it, the browser only says it can "read and change your data" on the seven default sites. Nothing else triggers a warning.

* **`declarativeNetRequestWithHostAccess`**: lets ScrollStopp register redirect rules with the browser's built in blocking engine. This variant only works on sites ScrollStopp has host access to (see below), which is why it shows no "block content on any page" warning. The browser evaluates the rules itself; ScrollStopp never sees your browsing.
* **`storage`**: saves your blocklist, schedule and "minutes per visit" in `storage.sync` so they follow you to every browser where you're signed in (Chrome sync, Firefox account). Stats and the meme rotation live in `storage.local` on each device.
* **`alarms`**: wakes the background script exactly when your schedule starts or ends so it can switch the rules on or off. With the default "Always block" no alarm is ever set.
* **`activeTab`**: lets the popup read the address of the tab you're looking at, only at the moment you click the ScrollStopp icon. That's how it can say "Blocked" or offer "Block this site".
* **Host permissions for the default sites** (`*://*.instagram.com/*` and so on): a browser only lets an extension redirect a site it has access to. These seven cover the default list.
* **Optional host permissions** (`*://*/*`): when you add a new site, the browser asks you to allow access to **that one site only**. ScrollStopp never asks for all websites at once. When you remove a site you added yourself, ScrollStopp hands that access back.
* **`web_accessible_resources` for `blocked/blocked.html`**: not a permission, but required so that clicking a link to a blocked site from another website can land on the blocked page instead of an error page.

Not requested: `tabs`, `webRequest`, `history`, content scripts, or access to all websites. The manifest also tells Firefox that ScrollStopp collects no data (`data_collection_permissions: none`).

## Changing the blocklist

**From the popup.** Open the site you want gone, click the ScrollStopp icon, then **Block this site**. The browser asks to allow access to that site, and the tab reloads into the blocked page.

**From the settings page.** Click the gear in the popup (or right click the icon and choose Options or Manage extension). Type a site and press **Add**. All of these work:

* `instagram.com` blocks the domain and every subdomain
* `m.instagram.com` blocks only that subdomain (and its own subdomains)
* `youtube.com/shorts` blocks only that path on the domain and its subdomains
* full URLs like `https://www.reddit.com/r/funny` are cleaned up for you (`www.` is dropped, the query is ignored)

**Removing a site.** Click **Remove** next to it in the popup or on the settings page. A dialog asks you to wait 30 seconds and type the sentence shown. "Keep it blocked" or pressing Escape cancels.

**Changing the built in defaults.** The defaults are used until you change your list for the first time. To ship different defaults, edit `DEFAULT_SITES` in `ScrollStopp/shared/core.js` and the matching `host_permissions` in `ScrollStopp/manifest.json`, then reload ScrollStopp on your browser's extensions page.

**Across devices.** Your list syncs through your browser account, but site access is granted per device. If a site you added on another computer shows **Needs access**, click **Allow** next to it.

## Memes

ScrollStopp ships without images. Add your own and the blocked page shows them, picking the set that matches the extension's language.

* A random one each time, never the same meme twice in a row (also across page loads).
* The next meme is preloaded in the background, so **Show me another meme** swaps instantly.
* A file listed in `memes.json` that is missing or broken is skipped.
* If there are no images at all, the page shows a friendly text instead of a broken image.

**Adding your own.** Supported: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp` (any letter case, spaces in names are fine).

* Put pictures **without text** directly in `ScrollStopp/memes/`: they show in every language.
* Put captioned memes in a language folder, `ScrollStopp/memes/en/` or `ScrollStopp/memes/de/` (create it if needed): they only show in that language.
* Then run the Ruby script below. New memes show up on the next blocked page; if not, reload ScrollStopp on your browser's extensions page.

**Before you publish a copy,** only include images you have the rights to. Frames from shows and films, including common meme templates, belong to someone else.

## Running the Ruby script

Browser extensions can't list a folder at runtime, so the blocked page reads the file list from `memes/memes.json`. The script `ScrollStopp/tools/build_memes.rb` scans `memes/` and its language folders and regenerates that file. It needs Ruby 2.6 or newer (macOS and most Linux systems already have it) and no gems.

From the `ScrollStopp` folder:

```bash
ruby tools/build_memes.rb
```

It also works from anywhere if you pass the full path, because it finds the `memes` folder relative to itself. It prints how many memes it found per language. Run it again whenever you add or delete images.

## The science behind it

Every blocked page shows one of these findings, and the settings page lists them all. Each links to the original peer reviewed study.

1. **Your phone drains brainpower just by being there.** In two experiments, the mere presence of people's own smartphone reduced their available cognitive capacity, most of all for the most phone dependent. Ward, Duke, Gneezy and Bos (2017), *Brain Drain: The Mere Presence of One's Own Smartphone Reduces Available Cognitive Capacity*, Journal of the Association for Consumer Research. [doi:10.1086/691462](https://doi.org/10.1086/691462)
2. **Short video feeds make you forget what you meant to do.** Only the TikTok style feed hurt people's memory for planned tasks (prospective memory); Twitter and YouTube did not. Chiossi et al. (2023), *Short Form Videos Degrade Our Capacity to Retain Intentions*, CHI Conference on Human Factors in Computing Systems. [doi:10.1145/3544548.3580778](https://doi.org/10.1145/3544548.3580778)
3. **Cutting back makes people less lonely and less depressed.** Students who limited Facebook, Instagram and Snapchat to 10 minutes per app per day for three weeks showed significant drops in loneliness and depression. Hunt, Marx, Lipson and Young (2018), *No More FOMO: Limiting Social Media Decreases Loneliness and Depression*, Journal of Social and Clinical Psychology. [doi:10.1521/jscp.2018.37.10.751](https://doi.org/10.1521/jscp.2018.37.10.751)
4. **A break gives you real life back.** People who deactivated Facebook for four weeks spent more time offline with friends and family, reported higher well being, and used it less afterwards. Allcott, Braghieri, Eichmeyer and Gentzkow (2020), *The Welfare Effects of Social Media*, American Economic Review. [doi:10.1257/aer.20190658](https://doi.org/10.1257/aer.20190658)
5. **One week off already helps.** A one week Facebook break raised life satisfaction and positive emotions among 1,095 people, most of all for heavy and passive users. Tromholt (2016), *The Facebook Experiment: Quitting Facebook Leads to Higher Levels of Well Being*, Cyberpsychology, Behavior, and Social Networking. [doi:10.1089/cyber.2016.0259](https://doi.org/10.1089/cyber.2016.0259)
6. **Heavy scrolling goes with worse sleep.** In a national sample of 1,788 young adults, the heaviest social media users had about twice the odds of sleep disturbance of the lightest users. Levenson et al. (2016), *The Association between Social Media Use and Sleep Disturbance among Young Adults*, Preventive Medicine. [doi:10.1016/j.ypmed.2016.01.001](https://doi.org/10.1016/j.ypmed.2016.01.001)
7. **Doomscrolling travels with anxiety.** Researchers who built a doomscrolling scale found it linked to anxiety, poor self control, fear of missing out and problematic social media use. Sharma, Lee and Johnson (2022), *The Dark at the End of the Tunnel: Doomscrolling on Social Media Newsfeeds*, Technology, Mind, and Behavior. [doi:10.1037/tmb0000059](https://doi.org/10.1037/tmb0000059)

Studies 1 to 5 are experiments, so they show cause and effect. Studies 6 and 7 are surveys: they show a link, not which way it runs.

To change the facts, edit `INSIGHT_DOIS` in `ScrollStopp/shared/core.js` and the matching `insightTextN` and `insightSourceN` entries in both `messages.json` files.

## Schedule

On the settings page choose **Always block** (default) or **Only on a schedule**, then pick days and a time window.

* If the end is earlier than the start, the window runs overnight and belongs to the day it starts on (Friday 22:00 to 02:00 blocks Friday night into Saturday morning).
* The same start and end time means all day on the chosen days.
* Outside the window the rules are removed completely, so the browser does zero extra work. The popup shows "Paused by schedule" for blocked sites.

## Stats and time saved

Every time a blocked page opens because you tried to visit a blocked site, ScrollStopp counts one attempt for that site and day. Reloading the blocked page doesn't count again. The blocked page multiplies attempts by the minutes per visit (10 by default, change it on the settings page) to estimate time saved today and in total. The settings page shows today, the last 7 days, all time, a 14 day chart and a per site table. Daily numbers are kept for 90 days; per site totals are kept until you press **Reset stats**.

## Languages

All visible text lives in `ScrollStopp/_locales/en/messages.json` and `ScrollStopp/_locales/de/messages.json`. The browser picks the language from its own setting and falls back to English. To check that both files define the same keys and that every key used in the code exists:

```bash
ruby tools/check_locales.rb
```

## Good to know

* **YouTube Shorts inside YouTube.** YouTube switches videos without a real page load, and `declarativeNetRequest` only sees real page loads. Opening a Shorts link directly, refreshing a Shorts page, or opening one in a new tab is blocked; scrolling into Shorts from the YouTube home page may not be. Catching that would need a content script, which this project avoids on purpose.
* **Tabs that are already open** get blocked on their next page load. The popup's Block button reloads the current tab for you.
* **Site access settings.** If you limit ScrollStopp's site access in your browser (for example "On click"), redirects stop on those sites and the list shows **Needs access**.
* **Private and incognito windows** are not covered unless you allow ScrollStopp there in your browser's extension settings. That setup has not been tested.
* **Sync limits.** Browser sync allows about 8 KB per stored item, which is room for a few hundred blocked sites.

## Project layout

```
README.md
ScrollStopp/
  manifest.json          one manifest for Chrome, Firefox and Safari
  background.js          settings and schedule into blocking rules, nothing else
  shared/
    api.js               picks the browser or chrome API object
    core.js              defaults, site parsing, rule builder, schedule math, stats, research list
    i18n.js              fills data-i18n attributes, number and duration formatting
    sites.js             add, remove, site access and list rendering
    unblock.js           the 30 second plus typed sentence dialog
    base.css             colors, cards, buttons, dark mode
  popup/                 popup.html, popup.css, popup.js
  options/               options.html, options.css, options.js
  blocked/               blocked.html, blocked.css, blocked.js
  memes/                 memes.json, plus any images you add
  icons/                 16, 48 and 128 px placeholder icons
  _locales/              en and de messages.json
  tools/
    build_memes.rb       regenerates memes/memes.json
    check_locales.rb     verifies the translations
```
