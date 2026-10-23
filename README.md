# Cornerstone

An animated wall of colors or unique album covers. Album search uses MusicBrainz metadata and Cover Art Archive artwork. Spotify import is a private beta.

## Run it locally

The simplest option is to open `dist/index.html` in a browser. For the most reliable full-screen behavior, serve the folder locally:

```powershell
python -m http.server 8080 -d dist
```

Then open `http://localhost:8080`. The wallpaper-only view is at `http://localhost:8080/wallpaper.html`.

No build or install step is currently required.

## Wallpaper export

Choose albums or colors, adjust the detail and wallpaper frame, then use **Save phone wallpaper** (1290 × 2796) or **Save desktop wallpaper** (3840 × 2160). The outer website frame and editing controls are not included. An external cover that cannot be loaded for canvas export may prevent a download; you can replace that album or supply your own cover.

## Spotify import

Cornerstone uses Spotify's Authorization Code with PKCE flow, so no Client Secret is placed in the site. The public Client ID is configured in the page; approved testers click **Connect Spotify** and authorize `user-top-read`. The importer checks up to three 50-track pages in each enabled listening period, deduplicates by album, and offers optional suggestions from familiar artists when fewer than 60 unique albums are available. Suggestions are not represented as listening history.

Spotify Development Mode requires the app owner to have Premium and supports up to five allowlisted users. Add each tester in the Spotify Developer Dashboard. The redirect URI must exactly match the deployed URL, including the case of `/Cornerstone/` if that is the published path. Temporary authorization values are removed after import or cancellation; access tokens are not saved for automatic background updates. Reconnect to refresh the imported snapshot.

For the approved-account test steps, provider caveats, and artwork provenance, see [BETA-VALIDATION.md](BETA-VALIDATION.md).

## Choosing albums

From **Start creating**, choose **Select my albums**, search for the artist, select the correct artist record, and choose at least four albums. The first four choices become the cornerstones; smaller and 60-album walls are supported. A manual artwork upload is available when the catalog is incomplete. Projects are saved in this browser on this device, with an optional project-file backup. They do **not** sync to other browsers or devices.

## Music connections and artwork rights

Spotify import is one-time and limited to approved beta testers. Apple Music personal-account import and cloud synchronization are not implemented. Account tokens must never be committed to GitHub or bundled into a wallpaper.

Catalog artwork (Cover Art Archive), default chart artwork (Apple-hosted URLs), Spotify-imported artwork, example screenshots, and user uploads remain subject to the rights and terms of their providers and rights holders. API availability is not permission to redistribute album covers in downloadable wallpapers. Before a public release, review the intended artwork use (including crops, blur, animation, caching, and PNG downloads) with the relevant providers/rights holders. Users should upload only artwork they have permission to use. Cover Art Archive specifically cautions that use of its images is at the user's risk.

## Wallpaper Engine

Cornerstone can be imported as a web wallpaper. In Wallpaper Engine, choose **Create Wallpaper** and drag in `dist/wallpaper.html`. The project should eventually bundle downloaded cover images locally before Workshop publishing so it does not depend on remote image servers.

## Local checks

```powershell
node --check dist/core.js
node --check dist/studio.js
node --test tests/core.test.cjs
```

Open `/__qa/browser.html?auto=1` on the local preview server to run the browser regression suite. Live Spotify authorization still requires an approved tester account and cannot be simulated by these tests.
