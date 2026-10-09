# Cornerstone

An animated wall of colors or unique album covers. The app includes a chart test set and a no-login album picker powered by MusicBrainz and Cover Art Archive.

## Run it locally

The simplest option is to open `dist/index.html` in a browser. For the most reliable full-screen behavior, serve the folder locally:

```powershell
python -m http.server 8080 -d dist
```

Then open `http://localhost:8080`. The wallpaper-only view is at `http://localhost:8080/wallpaper.html`.

No build or install step is currently required.

## Wallpaper export

Choose albums or colors, adjust the detail and frame, then use **Save phone wallpaper** or **Save desktop wallpaper**. Cornerstone creates a completely filled PNG sized for either screen.

## Spotify import

Cornerstone uses Spotify's Authorization Code with PKCE flow, so no Client Secret is placed in the site. The public Client ID is configured in the page; visitors only click **Connect Spotify** and approve access. The import requests `user-top-read`, loads up to 50 top tracks for the selected period, and deduplicates them by album.

Spotify Development Mode currently requires the app owner to have Premium and supports up to five allowlisted users. Add each tester in the Spotify Developer Dashboard. Temporary authorization values are removed after import.

## Choosing albums

Open **Albums**, choose **Choose your albums**, search for the artist, select the correct artist record, and then choose between 4 and 60 official album or EP covers. The first four choices become the permanent cornerstones. A manual artwork upload is available when the catalog is incomplete. The selected catalog entries are saved only in that browser on that device. Resetting to the chart test clears the saved selection.

## Personal music connection design

Cornerstone is designed around a one-time import rather than a permanent account connection:

1. The user connects Spotify or Apple Music and chooses a source such as top tracks, recent plays, or a playlist.
2. Cornerstone deduplicates by album and saves the chosen snapshot.
3. Nothing changes as listening habits change until the user deliberately presses **Refresh my music**.

Account tokens should never be committed to GitHub or bundled into a shared wallpaper. A permanent offline artwork cache must use artwork the user supplies locally or a source whose terms permit that storage.

## Wallpaper Engine

Cornerstone can be imported as a web wallpaper. In Wallpaper Engine, choose **Create Wallpaper** and drag in `dist/wallpaper.html`. The project should eventually bundle downloaded cover images locally before Workshop publishing so it does not depend on remote image servers.

## Planned exports

- Spotify import using Authorization Code with PKCE and the user's top tracks
- Apple Music import using MusicKit authorization
- Local user-supplied cover cache with album-level deduplication
- iPhone model presets and exact-size PNG wallpaper download
- Wallpaper Engine user settings for tile count, frame, motion, and flip speed
