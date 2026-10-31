# Cornerstone controlled-beta release checklist

## Blockers for the full album-art / Spotify experience

- One approved account has reported a successful Spotify return with matching album names. The full authorization, recommendations, cancellation, and reconnection flow is **NOT VERIFIED**; Dashboard configuration has not been independently checked here.
- Third-party artwork display, animation, bundled examples, uploads, and PNG redistribution need rights/platform review. The shared beta now shows static provider cover previews on the wall when available, but blocks album-cover PNG downloads. Color exports remain available. The local development build retains the prior experience for work and review.
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
