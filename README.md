# Tilewall

An animated wall of colors, gradients, or unique album covers. The current album set is a test snapshot from Apple Music's US chart; personal music import is the next major feature.

## Run it locally

The simplest option is to open `dist/index.html` in a browser. For the most reliable full-screen behavior, serve the folder locally:

```powershell
python -m http.server 8080 -d dist
```

Then open `http://localhost:8080`. The wallpaper-only view is at `http://localhost:8080/wallpaper.html`.

No build or install step is currently required.

## Personal music import design

Tilewall is designed around a one-time import rather than a permanent account connection:

1. The user connects Spotify or Apple Music and chooses a source such as top tracks, recent plays, or a playlist.
2. Tilewall deduplicates by album, downloads the selected cover files, and writes a local library file.
3. The connection can be discarded. The wallpaper keeps using that frozen local snapshot completely offline.
4. Nothing changes as listening habits change until the user deliberately presses **Refresh my music** and reconnects.

That makes the wallpaper predictable, private, and suitable for Wallpaper Engine. Account tokens should never be committed to GitHub or bundled into a shared wallpaper.

## Wallpaper Engine

Tilewall can be imported as a web wallpaper. In Wallpaper Engine, choose **Create Wallpaper** and drag in `dist/wallpaper.html`. The project should eventually bundle downloaded cover images locally before Workshop publishing so it does not depend on remote image servers.

## Planned exports

- Spotify import using Authorization Code with PKCE and the user's top tracks
- Apple Music import using MusicKit authorization
- Local cover cache with album-level deduplication
- iPhone model presets and exact-size PNG wallpaper download
- Wallpaper Engine user settings for tile count, frame, motion, and flip speed
