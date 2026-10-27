// Deployment replaces only this small file. A query flag previews the shared beta locally.
window.CornerstoneConfig = Object.freeze({
  release: ['localhost', '127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).has('beta-preview') ? 'friend-beta' : 'development'
});
if (window.CornerstoneConfig.release === 'friend-beta') document.documentElement.classList.add('friend-beta');
