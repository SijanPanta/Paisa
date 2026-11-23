// ── GENERIC UNDO HISTORY ────────────────────────────────────────
let undoStack = [];
let pendingUndoAction = null;
const UNDO_LIMIT = 25;

function undoSnapshot(list) {
  return (list || []).map(item => ({ ...item }));
}

function recordUndo(label) {
  undoStack.push({
    label,
    transactions: undoSnapshot(state.transactions),
    loans: undoSnapshot(state.loans),
    splits: undoSnapshot(state.splits),
    friends: undoSnapshot(state.friends),
    bankAccounts: undoSnapshot(state.bankAccounts)
  });
  if (undoStack.length > UNDO_LIMIT) undoStack.shift();
  updateUndoButton();
}

function clearUndoHistory() {
  undoStack = [];
  updateUndoButton();
}

function requestUndo(label, action) {
  if (typeof action !== 'function') return;
  pendingUndoAction = action;
  document.getElementById('undoConfirmDesc').textContent =
    `Undo "${label || 'last change'}"? Your previous transactions, loans, splits, friends and bank accounts will be restored.`;
  document.getElementById('undoConfirmDialog').classList.add('show');
}

function requestGlobalUndo() {
  const last = undoStack[undoStack.length - 1];
  requestUndo(last ? last.label : 'last change', undoLastAction);
}

function closeUndoConfirmDialog() {
  pendingUndoAction = null;
  document.getElementById('undoConfirmDialog').classList.remove('show');
}

function confirmUndo() {
  const action = pendingUndoAction;
  closeUndoConfirmDialog();
  if (action) action();
}

function updateUndoButton() {
  const button = document.getElementById('undoBtn');
  if (!button) return;
  const last = undoStack[undoStack.length - 1];
  button.style.display = last ? 'flex' : 'none';
  button.title = last ? `Undo: ${last.label}` : 'Nothing to undo';
}

function undoLastAction() {
  const entry = undoStack.pop();
  if (!entry) {
    nativeToast('Nothing to undo');
    updateUndoButton();
    return false;
  }

  state.transactions = entry.transactions;
  state.loans = entry.loans;
  state.splits = entry.splits || [];
  state.friends = entry.friends || [];
  state.bankAccounts = entry.bankAccounts;
  state.editingTxId = null;
  state.viewingTxId = null;
  state.viewingSplitId = null;
  closeModal();
  closeLoanModal();
  closeLoanDetail();
  closeSplitModal();
  closeSplitDetailModal();
  closeDetailModal();
  saveState();
  updateUndoButton();
  render();
  nativeVibrate(30);
  nativeToast(`Undone: ${entry.label}`);
  return true;
}
