---
feature: site/page-loading
status: active
surfaces:
  - src/App.tsx                                  # each page is lazy
  - src/components/layout/Layout.tsx             # loading state
  - src/components/app/PageErrorBoundary.tsx     # PAGE-001
  - src/lib/reloadForNewRelease.ts
  - src/main.tsx                                 # waits for the starting language
  - src/lib/i18n/i18n.ts                         # loadLanguage, PAGE-002
  - src/domain/legal/policyVersions.ts           # versions, apart from policy text
  - vite.config.js                               # library download groups
  - src/components/home/HeroParallax.tsx         # home hero showcase
  - public/hero/                                 # its VTuber model, emote sheet, pixel-art GIF and video
unmatched_tier: 2
---

# Page loading — Support Playbook

The website used to be one 2 MB download. Now a first visit downloads the site's
frame and the page it lands on, about 810 KB (250 KB compressed), and every other
page downloads the first time it's opened. French and Spanish download only for
people reading them, and policy text only on legal pages.

If this breaks, one page or the whole site can fail to appear. Payments and
commissions in the database are unaffected, and nothing is lost.

**When a release goes out.** A release replaces the page files, so someone with
the site already open can ask for a file that's gone. The site reloads itself once
to get the new release, at most once a minute so a broken page can't loop.

## Quick triage

| Symptom the user reports | Likely issue |
| --- | --- |
| "This page didn't load" with a Reload page button | [`PAGE-001`](#page-001--a-page-failed-to-load-or-crashed) |
| The page reloaded by itself once | Expected, just after a release |
| The site is in English after choosing French or Spanish | [`PAGE-002`](#page-002--a-language-could-not-be-downloaded) |
| "Loading..." for a moment on a page's first visit | Expected on a slow connection |
| The home page's video is still, not moving | [Home hero showcase](#home-hero-showcase) |
| The page zooms in when tapping a text box on a phone | [Phones and tablets](#phones-and-tablets) |

---

## `PAGE-001` — A page failed to load or crashed

```yaml
id: PAGE-001
tier: 2
signals:
  - source: client
    match: "PAGE-001: a page failed to load or crashed."
    where: "src/components/app/PageErrorBoundary.tsx, also counted in the ops digest (OPS-006)"
  - source: client
    match: "Failed to fetch dynamically imported module"
    where: "browser console, on the same failure"
auto_fix: none
reason_not_automatable: "either the visitor's connection or a bug in a page, and telling them apart takes a person"
escalate_if:
  - "many people report it on the same page"
  - "the ops digest shows it rising just after a release"
```

**Cause.** A page's file couldn't be downloaded and reloading didn't help, or the
page itself crashed while drawing. A crash used to blank the whole site. Now the
top bar and footer stay, and moving to another page clears the message.

**Fix.** One person: a connection problem, so ask them to reload. Everyone on one
page: read the error after `PAGE-001` in the console. If it's a crash, roll back
the release. If it's a file that won't download, check the website's Worker has
the release and that `dist/assets` was published.

**Money impact.** None directly, but a failure on a payment page stops that buyer
until it is fixed.

---

## `PAGE-002` — A language could not be downloaded

```yaml
id: PAGE-002
tier: 2
signals:
  - source: client
    match: "PAGE-002: a language could not be downloaded, so English is showing."
    where: "src/lib/i18n/i18n.ts (loadOrWarn)"
auto_fix: none
reason_not_automatable: "usually one person's connection, and it clears by itself"
```

**Cause.** The French or Spanish file didn't download. The site shows English
rather than an unfinished page.

**Fix.** Ask them to reload. If it affects everyone, treat it as `PAGE-001`.

**Money impact.** None.

---

## Home hero showcase

Not an error the code produces. Since 2026-11-10 the large-screen home hero
shows four fixed pieces from `public/hero/`:
- a VTuber model cutout in the middle, the main piece. It's mirrored in the
  file itself, so it faces the headline; don't flip it with CSS, because the
  scroll animation overwrites transforms.
- an emote sheet on a card, upper left by her head, turned in toward the
  model in 3D
- a pixel-art GIF below the emote card, a little left of its centre. Like
  the model, it's mirrored in the file itself, not with CSS.
- a short-form video edit behind the model on the right, turned in toward it

Only the emote sheet sits on a card. The model and the GIF came with transparent
backgrounds. The emote sheet's black background was removed when it was
added, keeping the black line art: only large black areas joined to the
picture's edge were cleared. A replacement sheet needs the same treatment, or
it will show as a black rectangle.

All four pieces, and the arches behind the model, sit in one box the size of the
model's picture (80% of the screen height), so they stay beside her at any
screen size.

The video is a silent 9-second loop of about 1.2 MB, played like a GIF. The
source clip ends on about a second of black, so the last 2 seconds were cut.
Phones and tablets (below `lg`, 1024px) show a smaller group under the text:
the model, the emote card and the pixel art, sized by the screen's width.
They don't get the video or the arches, to keep it calm. The video isn't put
in the page at all there, so phones never download it; which one a visitor
gets is decided once when the page opens, so widening a window past 1024px
only adds the video after a reload.

- **The video shows a still frame.** That's expected for anyone whose device
  asks for reduced motion, and for browsers that block autoplay (some battery
  savers do). The still is `video-edit-poster.jpg`.
- **The headline and buttons are invisible.** Fixed 2026-11-10. The hero's
  animations must use `opacity`, never `autoAlpha`: `autoAlpha` reads the
  page fade-in's hidden state on load and keeps the text hidden.
- **A piece is blank.** Its file is missing from `public/hero/` in the
  release. Check the file is in the repo and the deploy finished. Nothing else
  depends on these files.

To swap a piece, replace the file with one of the same name, or change the
path in `media` at the top of `HeroParallax.tsx`. Keep the video small: it
downloads on every first visit to the home page on a large screen. FFmpeg
settings used: `-t 9.366 -an -vf scale=480:-2,fps=30 -c:v libx264 -crf 27
-preset slow -movflags +faststart`.

---

## Phones and tablets

Not an error the code produces. Since 2026-11-10 every text box, drop-down
and text area is 16px on touch screens (`pointer: coarse` in
`src/styles/ui.css`), because phones zoom the page in on any field smaller
than that and leave it zoomed. If the zoom comes back, a field has a rule that
beats it, usually an inline style; it shouldn't set its own font size.

Checked on 2026-11-10: no public page runs off the side of the screen at 320px
or 375px wide. Pages behind sign-in weren't checked.

---

## Known gaps

- **No file is fetched ahead of time.** The first click on each page waits for a
  small download. Fetching likely pages early would add data for everyone.
- **English stays in the main download,** about 160 KB before compression, as the
  fallback for any missing text.
- **A reload loses unsent text.** If someone is typing when a release lands and
  they then open a page that has never loaded, the reload clears their form.
