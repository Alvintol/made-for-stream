---
feature: site/ads
status: active
surfaces:
  - src/domain/ads/ads.ts                  # getAdsenseConfig, isAdPage
  - src/components/ads/SiteAds.tsx         # AdBanner, AdGutters
  - src/components/layout/Layout.tsx
  - src/domain/legal/cookiePreferences.ts  # activeOptionalCookieCategories
  - src/domain/legal/cookiePolicy.ts
  - src/domain/legal/privacyPolicy.ts
  - src/domain/legal/serviceProviderRegister.ts
unmatched_tier: 2
---

# Banner ads (Google AdSense) — Support Playbook

The site can show Google AdSense ads on the pages people browse. **It is off.**
With no publisher id there is no Google script, no ad space and no consent
question. Ads never run on checkout, chat, settings, policies, admin pages or a
creator's own tools. No money or commission depends on them: a broken ad leaves
the page as it was.

**How it works.** With the build variables set, `advertising` becomes an active
cookie category, so every visitor is asked again. Google's script loads only
after someone opts in. If they opt out, the page reloads so the script stops.
On a screen at least 768 pixels wide, the banner sits above the page. A phone
gets one small 320 by 50 pixel banner under the page's content, which never
sticks to the screen and never covers anything. With no phone slot, a phone
shows no ad. Side ads show only on screens at least 1880 pixels wide, because
the gutters are narrower than a 160 pixel ad below that.

## Turning ads on

Do these in order. Google reviews a public site, so this starts after launch.

1. **Policies.** The Privacy Policy (section 7) and Cookie Policy (Storage
   Register) say no advertising is in use, and the Service Provider Register
   does not list Google for ads. Rewrite all three with the lawyer's input, and
   bump each version. **Do not set the variables before this ships.**
2. **Apply.** Add the public site in AdSense. Prove ownership with the meta tag
   Google gives you in `index.html`, not its script tag: the script must wait
   for consent. Review can take a few days or up to four weeks.
3. **ads.txt.** Add `public/ads.txt` with the line Google gives you.
4. **Limit the ads.** In AdSense, block the categories that conflict with the
   Community Guidelines, such as adult content and gambling, and block
   competitors. Google chooses the ads, so a banned category can still get
   through until it is blocked.
5. **Create the ad units.** One responsive banner, one fixed 320 by 50 unit
   for phones and, if wanted, one vertical unit. Leave Google's Auto ads and
   anchor ads off: they add ads the site does not place, and anchor ads stick
   to the screen.
6. **Switch on.** Set the **build** variables on the website's Worker, then
   rebuild: `VITE_ADSENSE_CLIENT` (`ca-pub-…`), `VITE_ADSENSE_BANNER_SLOT`,
   `VITE_ADSENSE_PHONE_SLOT` and, for the side ads, `VITE_ADSENSE_SIDE_SLOT`.

To turn ads off, clear `VITE_ADSENSE_CLIENT` and rebuild.

## Seeing where ads would sit

Set the build variable `VITE_SHOW_AD_PLACEHOLDERS=true` on the test website and
rebuild. Dashed boxes appear at each ad's real size, on the same pages, and
Google is never contacted. Every tester sees them. **Never set it in
production.** Real ads replace the boxes if both are set. A phone or a narrower
window picks its layout when the page loads, so reload after resizing.

## Quick triage

| Symptom the user reports | Likely issue |
| --- | --- |
| "I don't see any ads" | Expected: off, no opt-in, an ad blocker, or a page without ads |
| An ad space is empty, or a console warning names `ADS-001` | [`ADS-001`](#ads-001--an-ad-space-stays-empty) |
| No ads for anyone who opted in | [`ADS-002`](#ads-002--adsense-script-did-not-load) |
| "I saw an inappropriate ad" | [`ADS-003`](#ads-003--an-ad-breaks-our-rules) |

---

## `ADS-001` — An ad space stays empty

```yaml
id: ADS-001
tier: 2
signals:
  - source: client
    match: "ADS-001: AdSense could not fill a space."
    where: "src/components/ads/SiteAds.tsx (AdUnit)"
auto_fix: none
reason_not_automatable: "the cause is Google's review or ad supply, seen only in the AdSense account"
```

**Cause.** Google has no ad to show, the site is not approved yet, or the slot
id is wrong. Check the site's status in AdSense, then compare the slot ids with
the build variables.

**Money impact.** Lost ad income only.

---

## `ADS-002` — AdSense script did not load

```yaml
id: ADS-002
tier: 2
signals:
  - source: client
    match: "ADS-002: the AdSense script did not load."
    where: "src/components/ads/SiteAds.tsx (loadScript)"
auto_fix: none
reason_not_automatable: "usually one person's ad blocker, which is theirs to keep"
```

**Cause.** Almost always an ad blocker or browser privacy setting, which is
expected. If nobody who opted in sees ads, check that the publisher id in
`VITE_ADSENSE_CLIENT` is right and that Google has not limited the account.

**Money impact.** Lost ad income only.

---

## `ADS-003` — An ad breaks our rules

```yaml
id: ADS-003
tier: 2
signals:
  - source: user
    match: "a report of an inappropriate ad"
    where: "support@madeforstream.com or safety@madeforstream.com"
auto_fix: none
reason_not_automatable: "someone has to find and block the ad in the AdSense account"
```

**Cause.** Google chose the ad. The site's own rules do not reach ad networks.

**Fix.** Ask for a screenshot and the page. Block the ad or its advertiser in
AdSense under Brand safety. If it is adult content, treat it as urgent: turn
ads off until it is blocked, because the site promises general audiences.

**Money impact.** None directly. It is a trust and policy risk.

---

## Known gaps

- **Most visitors will see no ads,** because ads wait for opt-in. Showing
  non-personalised ads without opt-in would need a change to the Cookie Policy
  and a legal view first.
- **Children may reach public pages.** The UK children's access draft says so.
  Ask the lawyer how that affects ads before they go on.
- **Google chooses the ads,** so AI art or competing marketplaces can appear
  until they are blocked.
- **The ad label is translated,** but the ads are in whatever language Google
  picks.
- **Paying to remove ads does not work with opt-in.** Anyone can already avoid
  ads for free by not opting in. See the checklist before building it.
