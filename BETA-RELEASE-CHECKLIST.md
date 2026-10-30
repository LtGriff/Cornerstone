# Cornerstone controlled-beta release checklist

## Blockers for the full album-art / Spotify experience

- Real Spotify authorization and import remain **NOT VERIFIED**. The owner reports Premium is restored, but the Dashboard configuration and approved-account flow have not been checked here. The shared beta now offers Spotify sign-in to approved testers with an explicit unverified warning; do not claim it works until consent, import, recommendations, cancellation, and reconnection pass.
- Third-party artwork display, animation, bundled examples, uploads, and PNG redistribution need rights/platform review. The shared beta instead uses original generated visuals and does not package Tre's Picks screenshots or Apple chart artwork. The local development build retains the prior experience for work and review.
- A project-saving, credential, or privacy defect found during beta testing is a stop-ship issue. No tokens, project contents, images, or private listening data should enter feedback reports.

## Important

- Test actual Chrome, Firefox, Edge, iPhone Safari, and Android Chrome before claiming cross-browser support. A desktop browser's phone-size viewport is not a physical-device test.
- MusicBrainz requests currently come directly from the browser. Its application-specific User-Agent expectation cannot be reliably met by cross-origin browser fetch; provider reliability needs review or a narrowly scoped proxy.
- Cover Art Archive currently returns server errors for some known albums. The picker attempts real cover previews and falls back immediately to named original visuals; provider recovery is outside Cornerstone's control.
- Check catalog quality, 390px mobile usability, picker scrolling, keyboard/touch swapping, color inputs, resume, and both export sizes with real testers.
- Confirm exact GitHub Pages casing `/Cornerstone/` and no missing assets or development-only controls after each deployment.

## Minor

- Refine the original-visual examples based on feedback.
- Improve feedback handoff when a deliberate submission channel is selected. The current beta only creates a copyable note and sends nothing automatically.

## Spotify owner setup for later (not live-tested)

Confirm the app owner meets Spotify's current Premium requirement and the app is in Development Mode. Add only approved test accounts in the Spotify Developer Dashboard (currently limited to five authenticated users). Register the exact redirect URL used for the test: `http://127.0.0.1:4173/` locally or `https://ltgriff.github.io/Cornerstone/` on GitHub Pages. Use the existing PKCE flow; never share passwords, client secrets, authorization codes, verifiers, or tokens. Follow `BETA-VALIDATION.md` and record sanitized pass/fail only. Distinguish a development quota rejection from transient rate limiting.
