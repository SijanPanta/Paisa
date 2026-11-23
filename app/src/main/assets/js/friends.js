let pendingDeleteFriendId = null;

function findFriend(friendId) {
  return (state.friends || []).find(friend => friend.id === friendId);
}

function findFriendByName(name) {
  const key = (name || '').trim().toLowerCase();
  if (!key) return null;
  return (state.friends || []).find(friend => (friend.name || '').toLowerCase() === key) || null;
}

function renderLoanFriendChips(selectedFriendId = null) {
  const host = document.getElementById('loanFriendChips');
  if (!host) return;
  const friends = state.friends || [];
  if (!friends.length) {
    host.innerHTML = '<span class="loan-friend-empty">No saved friends</span>';
    return;
  }

  host.innerHTML = friends.map(friend => {
    const active = friend.id === selectedFriendId ? 'active' : '';
    return `<button type="button" class="preset-chip loan-friend-chip ${active}" data-friend-id="${escapeHtml(friend.id)}" data-name="${escapeHtml(friend.name)}">${escapeHtml(friend.name)}</button>`;
  }).join('');

  host.querySelectorAll('.loan-friend-chip').forEach(chip => {
    chip.addEventListener('click', () => selectLoanFriend(chip.dataset.friendId));
  });
}

function selectLoanFriend(friendId) {
  const friend = findFriend(friendId);
  if (!friend) return;
  document.getElementById('loanPersonInput').value = friend.name;
  const host = document.getElementById('loanFriendChips');
  if (host) {
    host.querySelectorAll('.loan-friend-chip').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.friendId === friend.id);
    });
  }
}

function openFriendLoan(friendId) {
  const friend = findFriend(friendId);
  if (!friend) return;
  nativeVibrate(20);
  closeFriendsSheet();
  openLoanModal('receive');
  selectLoanFriend(friend.id);
}

function handleFriendCardClick(event, friendId) {
  if (event && event.target && event.target.tagName === 'BUTTON') return;
  openFriendLoan(friendId);
}

function renderFriends() {
  const container = document.getElementById('friendList');
  const count = document.getElementById('friendCount');
  const friends = state.friends || [];
  if (count) count.textContent = `${friends.length} saved`;
  if (!container) return;
  if (!friends.length) {
    container.innerHTML = '<div class="loan-empty">No friends yet</div>';
    return;
  }
  container.innerHTML = friends.map(friend => `
    <div class="friend-card friend-clickable" data-friend="${escapeHtml(friend.id)}" onclick="handleFriendCardClick(event, this.dataset.friend)" role="button" tabindex="0">
      <span class="friend-avatar">${escapeHtml((friend.name || '?').trim().charAt(0).toUpperCase())}</span>
      <span class="friend-name">${escapeHtml(friend.name)}</span>
      <button type="button" class="friend-remove" data-friend="${escapeHtml(friend.id)}" onclick="promptDeleteFriend(this.dataset.friend)" aria-label="Remove ${escapeHtml(friend.name)}">Remove</button>
    </div>
  `).join('');
}

function renderFriendChips(selectedIds) {
  const container = document.getElementById('splitFriendChips');
  if (!container) return;
  const friends = state.friends || [];
  const selected = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
  const meChip = `<button type="button" class="preset-chip split-me-chip${splitIncludeMe ? ' active' : ''}" data-me="true" aria-pressed="${splitIncludeMe}" onclick="toggleSplitMe()">Me</button>`;
  if (!friends.length) {
    container.innerHTML = meChip + '<div class="loan-empty">No friends yet</div>';
    return;
  }
  container.innerHTML = meChip + friends.map(friend => `
    <button type="button" class="preset-chip split-friend-chip${selected.has(friend.id) ? ' active' : ''}" data-friend="${escapeHtml(friend.id)}" aria-pressed="${selected.has(friend.id)}" onclick="toggleSplitFriend(this.dataset.friend)">${escapeHtml(friend.name)}</button>
  `).join('');
}

function openFriendsSheet() {
  nativeVibrate(20);
  renderFriends();
  document.getElementById('friendsSheet').classList.add('show');
}

function closeFriendsSheet() {
  document.getElementById('friendsSheet').classList.remove('show');
}

function openAddFriendDialog() {
  nativeVibrate(20);
  const input = document.getElementById('friendNameInput');
  if (input) input.value = '';
  document.getElementById('addFriendDialog').classList.add('show');
  setTimeout(() => { if (input) input.focus(); }, 60);
}

function closeAddFriendDialog() {
  document.getElementById('addFriendDialog').classList.remove('show');
}

function saveFriend() {
  const input = document.getElementById('friendNameInput');
  const name = input ? input.value.trim() : '';
  if (!name) {
    nativeToast('Enter a friend\'s name');
    return;
  }
  if (findFriendByName(name)) {
    nativeToast('That friend is already saved');
    return;
  }
  if (!state.friends) state.friends = [];
  recordUndo('Add friend');
  const now = Date.now();
  state.friends.push({
    id: 'friend_' + now + '_' + Math.random().toString(36).substr(2, 5),
    name,
    createdAt: now
  });
  saveState();
  closeAddFriendDialog();
  render();
  nativeVibrate(30);
  nativeToast(`Added ${name}`);
}

function promptDeleteFriend(friendId) {
  const friend = findFriend(friendId);
  if (!friend) return;
  nativeVibrate(20);
  pendingDeleteFriendId = friend.id;
  document.getElementById('deleteFriendDesc').textContent =
    `Remove ${friend.name} from your friends list? Existing loans keep their recorded names.`;
  document.getElementById('deleteFriendDialog').classList.add('show');
}

function closeDeleteFriendDialog() {
  pendingDeleteFriendId = null;
  document.getElementById('deleteFriendDialog').classList.remove('show');
}

function confirmDeleteFriend() {
  const friend = findFriend(pendingDeleteFriendId);
  if (!friend) {
    closeDeleteFriendDialog();
    return;
  }
  recordUndo('Delete friend');
  state.friends = (state.friends || []).filter(item => item.id !== friend.id);
  splitSelectedFriends.delete(friend.id);
  saveState();
  closeDeleteFriendDialog();
  render();
  renderSplitPreview();
  nativeVibrate(30);
  nativeToast(`Removed ${friend.name}`);
}
