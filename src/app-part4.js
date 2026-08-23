
/* =========================================================
   LINK CLUSTER: search existing songs, add to a cluster
   ========================================================= */
let clusterSelectedIds = [];
function closeClusterModal(){
  document.getElementById('clusterOverlay').classList.remove('open');
}
function renderClusterSearchResults(query){
  const wrap = document.getElementById('clusterSearchResults');
  const q = query.trim().toLowerCase();
  if(!q){ wrap.style.display = 'none'; wrap.innerHTML = ''; return; }
  const matches = songs.filter(s=>{
    if(clusterSelectedIds.includes(s.id)) return false;
    const title = (s.title||'').toLowerCase();
    const artists = (s.artists||[]).join(' ').toLowerCase();
    return title.includes(q) || artists.includes(q);
  }).slice(0, 8);
  wrap.style.display = 'block';
  if(matches.length === 0){
    wrap.innerHTML = '<p class="profile-empty-note">No matching songs.</p>';
    return;
  }
  wrap.innerHTML = matches.map(s=>`
    <button type="button" class="discover-row" data-song-id="${s.id}">
      ${s.coverArt ? `<img src="${escapeAttr(s.coverArt)}" alt="Album cover">` : `<span class="drow-fallback">${escapeHtml((s.title||'?').charAt(0).toUpperCase())}</span>`}
      <span>
        <span class="drow-name">${escapeHtml(s.title||'Untitled')}</span><br>
        <span class="drow-bio">${escapeHtml((s.artists||[]).join(', ') || 'Unknown artist')}</span>
      </span>
    </button>
  `).join('');
}
function renderClusterSelectedList(){
  const wrap = document.getElementById('clusterSelectedList');
  const hint = document.getElementById('clusterEmptyHint');
  const items = clusterSelectedIds.map(id=>songs.find(s=>s.id===id)).filter(Boolean);
  hint.style.display = items.length ? 'none' : '';
  wrap.innerHTML = items.map(s=>`
    <div class="cluster-chip" data-song-id="${s.id}">
      <span>${escapeHtml(s.title||'Untitled')}${(s.artists&&s.artists.length) ? ' — '+escapeHtml(s.artists.join(', ')) : ''}</span>
      <button type="button" class="cluster-chip-x" data-remove="${s.id}" title="Remove">×</button>
    </div>
  `).join('');
}
function handleClusterSave(){
  trackEvent('save_stack');
  if(clusterSelectedIds.length < 2){
    alert('Add at least 2 songs to link them together.');
    return;
  }
  const clusterId = uid();
  const clusterName = document.getElementById('cluster-name').value.trim();
  clusterSelectedIds.forEach(id=>{
    const s = songs.find(x=>x.id===id);
    if(s){ s.clusterId = clusterId; s.clusterName = clusterName || null; s.clusterAddedBy = currentUserId; }
  });
  const collabToggle = document.getElementById('clusterCollabToggle');
  if(collabToggle && collabToggle.checked && collabSelectedFriendIds.length){
    const meta = getStackMeta();
    meta[clusterId] = { name: clusterName || null, collaborators: [currentUserId, ...collabSelectedFriendIds] };
    saveStackMeta(meta);
    collabSelectedFriendIds.forEach(fid=>{
      sendNotif(fid, 'stack_invite', `You were invited to collaborate on stack "${clusterName || 'Untitled'}"`);
    });
  }
  save();
  closeClusterModal();
  render();
}
document.getElementById('cluster-search').addEventListener('input', e=>renderClusterSearchResults(e.target.value));
document.getElementById('clusterSearchResults').addEventListener('click', e=>{
  const row = e.target.closest('[data-song-id]');
  if(!row) return;
  const id = row.dataset.songId;
  if(!clusterSelectedIds.includes(id)) clusterSelectedIds.push(id);
  document.getElementById('cluster-search').value = '';
  document.getElementById('clusterSearchResults').style.display = 'none';
  document.getElementById('clusterSearchResults').innerHTML = '';
  renderClusterSelectedList();
});
document.getElementById('clusterSelectedList').addEventListener('click', e=>{
  const btn = e.target.closest('[data-remove]');
  if(!btn) return;
  clusterSelectedIds = clusterSelectedIds.filter(id=>id!==btn.dataset.remove);
  renderClusterSelectedList();
});
document.getElementById('clusterCancelBtn').addEventListener('click', closeClusterModal);
document.getElementById('clusterSaveBtn').addEventListener('click', handleClusterSave);
document.getElementById('clusterOverlay').addEventListener('click', e=>{ if(e.target.id==='clusterOverlay') closeClusterModal(); });
document.getElementById('openCluster').addEventListener('click', ()=>{ trackEvent('create_stack'); openClusterModal(); });

/* ---- COLLAB STACKS ---- */
const STACK_META_KEY = 'bayoutonefm-stack-meta';
let collabSelectedFriendIds = [];
function getStackMeta(){
  try{ return JSON.parse(localStorage.getItem(STACK_META_KEY)||'{}'); }catch(e){ return {}; }
}
function saveStackMeta(meta){
  localStorage.setItem(STACK_META_KEY, JSON.stringify(meta));
}
document.getElementById('clusterCollabToggle').addEventListener('change', e=>{
  const show = e.target.checked;
  document.getElementById('collabHint').style.display = show ? '' : 'none';
  document.getElementById('collabFriendsWrap').style.display = show ? '' : 'none';
});
document.getElementById('collabFriendsSearch').addEventListener('input', e=>{
  const q = e.target.value.trim().toLowerCase();
  const wrap = document.getElementById('collabFriendsResults');
  if(!q){ wrap.style.display = 'none'; wrap.innerHTML = ''; return; }
  const friends = allProfilesCache.filter(p=> myFriendIds.has(p.user_id) && !collabSelectedFriendIds.includes(p.user_id) && (p.username||'').toLowerCase().includes(q)).slice(0,8);
  wrap.style.display = 'block';
  if(!friends.length){ wrap.innerHTML = '<p class="profile-empty-note">No matching friends.</p>'; return; }
  wrap.innerHTML = friends.map(p=>`
    <button type="button" class="discover-row" data-collab-id="${p.user_id}">
      ${p.photo ? `<img src="${escapeAttr(p.photo)}" alt="Profile photo">` : `<span class="drow-fallback is-pfp"></span>`}
      <span><span class="drow-name">@${escapeHtml(p.username||'')}</span></span>
    </button>
  `).join('');
});
document.getElementById('collabFriendsResults').addEventListener('click', e=>{
  const row = e.target.closest('[data-collab-id]');
  if(!row) return;
  collabSelectedFriendIds.push(row.dataset.collabId);
  document.getElementById('collabFriendsSearch').value = '';
  document.getElementById('collabFriendsResults').style.display = 'none';
  document.getElementById('collabFriendsResults').innerHTML = '';
  renderCollabSelected();
});
function renderCollabSelected(){
  const wrap = document.getElementById('collabSelectedList');
  wrap.innerHTML = collabSelectedFriendIds.map(fid=>{
    const p = allProfilesCache.find(x=>x.user_id===fid);
    const name = p ? p.username : 'friend';
    return `<div class="cluster-chip"><span>@${escapeHtml(name)}</span><button type="button" class="cluster-chip-x" data-remove-collab="${fid}" title="Remove">×</button></div>`;
  }).join('');
}
document.getElementById('collabSelectedList').addEventListener('click', e=>{
  const btn = e.target.closest('[data-remove-collab]');
  if(!btn) return;
  collabSelectedFriendIds = collabSelectedFriendIds.filter(id=>id!==btn.dataset.removeCollab);
  renderCollabSelected();
});
function openClusterModal(){
  clusterSelectedIds = [];
  collabSelectedFriendIds = [];
  document.getElementById('cluster-name').value = '';
  document.getElementById('cluster-search').value = '';
  document.getElementById('clusterSearchResults').style.display = 'none';
  document.getElementById('clusterSearchResults').innerHTML = '';
  document.getElementById('clusterCollabToggle').checked = false;
  document.getElementById('collabHint').style.display = 'none';
  document.getElementById('collabFriendsWrap').style.display = 'none';
  document.getElementById('collabFriendsSearch').value = '';
  document.getElementById('collabFriendsResults').style.display = 'none';
  document.getElementById('collabSelectedList').innerHTML = '';
  renderClusterSelectedList();
  document.getElementById('clusterOverlay').classList.add('open');
}

/* =========================================================
   VIEW CLUSTERS
   ========================================================= */
let clustersEditMode = false;
let clusterDetailId = null;
let clusterRenameId = null;
function getClusterGroups(){
  const groups = {};
  songs.forEach(s=>{ if(s.clusterId){ (groups[s.clusterId] = groups[s.clusterId] || []).push(s); } });
  return groups;
}
function renderClustersList(){
  const wrap = document.getElementById('clustersListWrap');
  const groups = getClusterGroups();
  const meta = getStackMeta();
  const clusterIds = Object.keys(groups).filter(id=>groups[id].length > 1);
  if(clusterIds.length === 0){
    wrap.innerHTML = '<p class="profile-empty-note">No linked stacks yet.</p>';
    return;
  }
  wrap.innerHTML = clusterIds.map(id=>{
    const list = groups[id];
    const name = (list.find(s=>s.clusterName)||{}).clusterName;
    const m = meta[id];
    const collabBadge = m && m.collaborators && m.collaborators.length > 1
      ? `<span class="cnr-collab">🤝 ${m.collaborators.length} people</span>` : '';
    return `
      <div class="cluster-name-row-wrap">
        <button type="button" class="cluster-name-row" data-cluster-id="${id}">
          <span class="cnr-name">${escapeHtml(name || 'Untitled stack')}</span>
          ${collabBadge}
          <span class="cnr-count">${list.length} songs</span>
        </button>
        ${clustersEditMode ? `<button type="button" class="cluster-delete-btn" data-delete-cluster="${id}" title="Delete this stack">Delete</button>` : ''}
      </div>
    `;
  }).join('');
}
async function renderClusterDetail(id){
  const wrap = document.getElementById('clustersListWrap');
  const groups = getClusterGroups();
  const list = groups[id] || [];
  if(list.length === 0){ renderClustersList(); return; }
  const meta = getStackMeta();
  const m = meta[id];
  if(m && m.collaborators){
    const missing = m.collaborators.filter(uid=> !allProfilesCache.some(p=>p.user_id===uid));
    if(missing.length){
      const { data } = await sb.from('profiles').select('user_id, username, photo').in('user_id', missing);
      if(data) allProfilesCache.push(...data);
    }
  }
  clusterDetailId = id;
  const name = (list.find(s=>s.clusterName)||{}).clusterName;
  const renaming = (clusterRenameId === id);
  const isCollab = m && m.collaborators && m.collaborators.length > 1;
  wrap.innerHTML = `
    <button type="button" class="cluster-back-btn" id="clusterBackBtn">← All stacks</button>
    <div class="cluster-group" data-cluster-id="${id}">
      ${renaming ? `
        <div class="cluster-group-head">
          <input type="text" id="clusterRenameInput" class="cluster-rename-input" value="${escapeAttr(name || '')}" placeholder="Stack name" maxlength="60">
          <span class="cluster-rename-actions">
            <button type="button" class="rename-save" id="clusterRenameSaveBtn">Save</button>
            <button type="button" id="clusterRenameCancelBtn">Cancel</button>
          </span>
        </div>` : `
        <div class="cluster-group-head">
          <p class="cluster-group-name">${escapeHtml(name || 'Untitled stack')}${isCollab ? ' <span class="collab-badge">🤝 Collaborative</span>' : ''}</p>
          <span class="cluster-rename-actions">
            <button type="button" id="clusterRenameBtn" title="Rename this stack">Rename</button>
          </span>
        </div>`}
      <p class="profile-songs-label">${list.length} linked songs</p>
      ${list.map(s=>{
        const addedBy = s.clusterAddedBy;
        let whoPfp = '';
        if(isCollab && addedBy){
          const adderProfile = addedBy === currentUserId ? myProfile : allProfilesCache.find(p=>p.user_id===addedBy);
          if(adderProfile && adderProfile.photo){
            whoPfp = `<img class="cluster-added-by-pfp" src="${escapeAttr(adderProfile.photo)}" title="Added by @${escapeHtml(adderProfile.username||'you')}" loading="lazy" alt="Profile photo">`;
          } else {
            const uname = addedBy === currentUserId ? (myProfile?.username||'?') : (allProfilesCache.find(p=>p.user_id===addedBy)?.username || '?');
            whoPfp = `<span class="cluster-added-by-pfp cluster-added-by-fallback" title="Added by @${escapeHtml(uname)}">${escapeHtml(uname.charAt(0).toUpperCase())}</span>`;
          }
        }
        return `
        <div class="profile-song-row">
          ${s.coverArt ? `<img src="${escapeAttr(s.coverArt)}" alt="Album cover">` : ''}
          <span class="psr-title">${escapeHtml(s.title||'Untitled')}</span>
          <span class="psr-artist">${escapeHtml((s.artists||[]).join(', '))}</span>
          ${whoPfp}
          <span class="profile-song-row-actions">
            <button type="button" class="psr-edit-btn" data-edit-song="${s.id}">Edit</button>
            <button type="button" class="psr-remove-btn" data-remove-from-cluster="${s.id}">Remove</button>
          </span>
        </div>`;
      }).join('')}
      <div class="cluster-group-actions">
        <button type="button" class="modal-action-btn" data-view-cluster="${id}">View in grid</button>
        <button type="button" class="cluster-delete-btn" data-delete-cluster="${id}">Delete entire stack</button>
      </div>
    </div>
  `;
}
function saveClusterName(id){
  const input = document.getElementById('clusterRenameInput');
  const newName = (input && input.value.trim()) || null;
  const list = getClusterGroups()[id] || [];
  list.forEach(s=>{ s.clusterName = newName; });
  clusterRenameId = null;
  save();
  render();
  renderClusterDetail(id);
}
function deleteCluster(id){
  const groups = getClusterGroups();
  const list = groups[id] || [];
  if(list.length === 0) return;
  const ok = confirm(`Delete this stack of ${list.length} songs? The songs themselves will stay in your cataloguex — this only removes the link between them.`);
  if(!ok) return;
  list.forEach(s=>{ s.clusterId = null; s.clusterName = null; });
  save();
  render();
  renderClustersList();
}
function removeSongFromCluster(songId){
  const song = songs.find(s=>s.id===songId);
  if(!song || !song.clusterId) return;
  const clusterId = song.clusterId;
  song.clusterId = null;
  song.clusterName = null;
  save();
  render();
  const groups = getClusterGroups();
  if((groups[clusterId] || []).length > 1){
    renderClusterDetail(clusterId);
  } else {
    renderClustersList();
  }
}
document.getElementById('viewClustersBtn').addEventListener('click', ()=>{
  trackEvent('view_stacks');
  clustersEditMode = false;
  document.getElementById('editClustersToggleBtn').classList.remove('active');
  document.getElementById('editClustersToggleBtn').textContent = 'Edit stacks';
  renderClustersList();
  document.getElementById('viewClustersOverlay').classList.add('open');
});
document.getElementById('viewClustersCloseBtn').addEventListener('click', ()=>{
  document.getElementById('viewClustersOverlay').classList.remove('open');
});
document.getElementById('editClustersToggleBtn').addEventListener('click', ()=>{
  trackEvent('edit_stacks_toggle');
  clustersEditMode = !clustersEditMode;
  const btn = document.getElementById('editClustersToggleBtn');
  btn.classList.toggle('active', clustersEditMode);
  btn.textContent = clustersEditMode ? 'Done editing' : 'Edit stacks';
  renderClustersList();
});
document.getElementById('viewClustersOverlay').addEventListener('click', e=>{
  if(e.target.id==='viewClustersOverlay'){ document.getElementById('viewClustersOverlay').classList.remove('open'); return; }
  const deleteBtn = e.target.closest('[data-delete-cluster]');
  if(deleteBtn){ deleteCluster(deleteBtn.dataset.deleteCluster); return; }
  const editSongBtn = e.target.closest('[data-edit-song]');
  if(editSongBtn){
    const song = songs.find(s=>s.id===editSongBtn.dataset.editSong);
    if(song){
      document.getElementById('viewClustersOverlay').classList.remove('open');
      openModal(song);
    }
    return;
  }
  const removeBtn = e.target.closest('[data-remove-from-cluster]');
  if(removeBtn){ removeSongFromCluster(removeBtn.dataset.removeFromCluster); return; }
  const backBtn = e.target.closest('#clusterBackBtn');
  if(backBtn){ renderClustersList(); return; }
  const saveNameBtn = e.target.closest('#clusterRenameSaveBtn');
  if(saveNameBtn){ saveClusterName(clusterDetailId); return; }
  const cancelNameBtn = e.target.closest('#clusterRenameCancelBtn');
  if(cancelNameBtn){ clusterRenameId = null; renderClusterDetail(clusterDetailId); return; }
  const renameBtn = e.target.closest('#clusterRenameBtn');
  if(renameBtn){
    clusterRenameId = clusterDetailId;
    renderClusterDetail(clusterDetailId);
    const input = document.getElementById('clusterRenameInput');
    if(input){ input.focus(); input.select(); }
    return;
  }
  const nameRow = e.target.closest('.cluster-name-row[data-cluster-id]');
  if(nameRow){ renderClusterDetail(nameRow.dataset.clusterId); return; }
  const viewBtn = e.target.closest('[data-view-cluster]');
  if(viewBtn){
    clusterFilterId = viewBtn.dataset.viewCluster;
    remindsFilterId = null;
    document.getElementById('viewClustersOverlay').classList.remove('open');
    render();
  }
});
document.addEventListener('keydown', e=>{
  const input = document.getElementById('clusterRenameInput');
  if(!input) return;
  if(e.key === 'Enter'){ e.preventDefault(); saveClusterName(clusterDetailId); }
  else if(e.key === 'Escape'){ clusterRenameId = null; renderClusterDetail(clusterDetailId); }
});


