(() => {
  'use strict';
  if (window.CornerstoneConfig?.release !== 'friend-beta') return;
  document.body.classList.add('friend-beta');
  const dock=document.createElement('div');
  dock.className='beta-dock';
  dock.innerHTML='<button type="button" id="aboutBeta">Cornerstone <span>BETA</span></button><button type="button" id="feedbackBeta">Send feedback</button>';
  const dialog=document.createElement('dialog');
  dialog.className='beta-dialog';
  dialog.setAttribute('aria-labelledby','betaDialogTitle');
  dialog.innerHTML='<div class="beta-dialog-head"><h2 id="betaDialogTitle">About this beta</h2><button type="button" id="closeBeta" aria-label="Close">×</button></div><div id="betaDialogBody"></div>';
  document.body.append(dock,dialog);
  const body=dialog.querySelector('#betaDialogBody');
  const title=dialog.querySelector('#betaDialogTitle');
  dialog.querySelector('#closeBeta').onclick=()=>dialog.close();
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  dock.querySelector('#aboutBeta').onclick=()=>{
    title.textContent='Cornerstone BETA';
    body.innerHTML='<p>This is an early test version. Your project saves in this browser only; it does not sync to another device. Use “Save project file” for a backup.</p><p>Approved Spotify testers can try a one-time listening-history import. One account has confirmed matching album names; broader sign-in testing is still underway. The site does not keep an access token or update albums in the background. Imported albums now show Spotify cover previews where available. Older saved imports need a fresh Spotify connection to recover cover URLs. Manual search uses MusicBrainz and Cover Art Archive; a missing preview falls back to an original design.</p><p>Album-cover downloads are paused while artwork rights are reviewed. Color wallpapers remain downloadable. Spotify cover previews are static and link back to their albums.</p><p>Want to help improve it? Use Send feedback and share the copied note with Tre through a channel you already use. Nothing is sent automatically.</p><p><a href="https://github.com/ltgriff/cornerstone/blob/main/BETA-TESTER-GUIDE.md" target="_blank" rel="noopener noreferrer">Read the tester guide ↗</a></p>';
    dialog.showModal();
  };
  dock.querySelector('#feedbackBeta').onclick=()=>{
    title.textContent='Send feedback';
    body.innerHTML='<p>Tell Tre what happened. This form only creates a note you can copy; it does not send anything.</p><label>Category<select id="betaFeedbackCategory"><option>Something broke</option><option>Something was confusing</option><option>Design or appearance</option><option>Feature suggestion</option><option>Other</option></select></label><label>What would you like to share? <span>(optional)</span><textarea id="betaFeedbackText" rows="5" maxlength="2000" placeholder="What happened, and what were you trying to do?"></textarea></label><button type="button" id="makeFeedback">Create copyable note</button><div id="betaFeedbackResult" hidden><label>Your note<textarea id="betaFeedbackNote" rows="7" readonly></textarea></label><button type="button" id="copyFeedback">Copy note</button><p id="betaFeedbackStatus" role="status">Copy this note and send it to Tre yourself.</p></div><p class="beta-privacy">Please don’t include passwords, Spotify codes, private listening history, or personal information.</p>';
    body.querySelector('#makeFeedback').onclick=()=>{
      const category=body.querySelector('#betaFeedbackCategory').value;
      const description=body.querySelector('#betaFeedbackText').value.trim();
      const note=`Cornerstone BETA feedback\nCategory: ${category}\nDetails: ${description||'(no details added)'}`;
      body.querySelector('#betaFeedbackNote').value=note;
      body.querySelector('#betaFeedbackResult').hidden=false;
    };
    body.querySelector('#copyFeedback').onclick=async()=>{
      const note=body.querySelector('#betaFeedbackNote');
      try{await navigator.clipboard.writeText(note.value);body.querySelector('#betaFeedbackStatus').textContent='Copied. Send it to Tre through a channel you already use.';}
      catch(_){note.focus();note.select();body.querySelector('#betaFeedbackStatus').textContent='Select and copy the note, then send it to Tre.';}
    };
    dialog.showModal();
  };
})();
