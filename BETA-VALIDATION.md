# Cornerstone controlled-beta validation

This is a manual test plan, not evidence that a live Spotify sign-in has passed. Never put authorization codes, tokens, Spotify emails, or private listening data in screenshots, issue reports, or console logs.

## Spotify account test — NOT VERIFIED

Prerequisites: the app owner has Spotify Premium; the testing account is one of the development app's five approved users; the Spotify dashboard has the exact redirect URI for the environment being tested. For local testing, register `http://127.0.0.1:4173/` and run `node scripts/serve.cjs` from this repository. For GitHub Pages, register the exact deployed address, including the case and trailing slash of `/Cornerstone/`. Do not use `localhost`, a different port/path, or an unregistered redirect. Check these settings in the Spotify dashboard; this repository cannot prove what is registered there.

1. Open the local address in a fresh browser profile and choose **Start creating → Connect my music → Connect Spotify**.
2. Sign in as the approved test user and grant the requested `user-top-read` scope. Confirm the browser returns to the same Cornerstone address, without an OAuth error or an authorization code left in the address bar.
3. Confirm the import shows real unique albums and a count no greater than 60. Check that the selected short-, medium-, or long-term period was used and whether optional additional periods were included. Spotify top items are affinity rankings, not exact play counts.
4. When fewer than 60 albums are imported, verify that suggested albums are labeled as suggestions, not listening history. Accept one, replace one, dismiss one, and accept the remainder or keep a smaller wall. Verify no duplicate album is added.
5. Complete the wall, save it, reload, and choose **Resume my project**. Check the four cornerstones and selected albums. Export both wallpaper sizes if the artwork provider permits the intended use.
6. In a second fresh profile, start authorization and choose **Cancel** on Spotify's consent screen. Confirm Cornerstone returns to the music choices and can attempt a new connection.
7. Reconnect and import again to refresh the snapshot. Cornerstone does not retain the access/refresh token or maintain a live account connection, so there is no persistent connection to disconnect; closing the flow or leaving the project does not revoke Spotify's prior consent. Revocation, if desired, must be done in Spotify account settings.
8. If possible, repeat with an unapproved account (expect a beta access error) and after an expired authorization (expect a reconnect message). Do not share the account identifier or token in the test report.

Do not interpret mocked automated tests as completion of this live test. Record only pass/fail, unique album count, and a sanitized error category.

## Provider architecture and artwork provenance

The current static site uses the browser directly. `dist/core.js` queries MusicBrainz for artist and release-group metadata, respecting a per-tab interval of at least 1.1 seconds. Cover Art Archive supplies album-cover URLs and the official-release artwork fallback. These cover images can enter the animated grid, color analysis, browser-local project data, and PNG exports. Spotify's top-items API supplies album titles, identities, artist data, and Spotify-hosted cover URLs; its imported covers enter the same grid, color analysis, local project, and export paths. `dist/top-songs.js` supplies default Apple-hosted chart artwork. `dist/assets/tres-*.jpg` are example screenshots containing multiple covers. User-uploaded images enter the same display and export paths as data URLs. MusicBrainz metadata is not itself the artwork license.

MusicBrainz asks applications to identify themselves with a meaningful `User-Agent`. The current cross-origin browser requests use the browser's own User-Agent; they do not reliably identify Cornerstone. Simply setting `User-Agent` in `fetch` is not cross-browser reliable, and the static GitHub Pages site cannot rewrite outgoing headers. The live catalog search works in the tested Edge browser, but that does not establish provider identification or reliability across browsers and users.

If MusicBrainz requires an application-specific User-Agent for this usage, a small server-side catalog proxy is the likely architecture. It would accept narrowly scoped artist/release queries, validate inputs and allowed upstream URLs, apply a shared rate limit and cache, send a contactable application User-Agent, and return only needed metadata. It should **not** receive Spotify tokens or private listening history. Hosting a worker/function and a domain or route adds an operational service, possible usage charges after any free allowance, monitoring, and outage responsibility; shared traffic must stay within MusicBrainz limits. User search terms and IP/network metadata would reach the proxy, so logging and retention should be minimized and disclosed. GitHub Pages could remain the static frontend but would need a configured proxy endpoint and CORS policy. No proxy is implemented in this phase.

Artwork permission remains unresolved. Technical access to Spotify, Cover Art Archive, Apple-hosted images, or a user's upload does not establish permission for animation, modification, caching, or downloadable wallpaper redistribution. Do not treat controlled-beta test results as a legal or platform-policy clearance for a public release.
