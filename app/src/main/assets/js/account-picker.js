let accountPickerTarget = null;

function accountPickerWallets() {
  const wallets = getAllWallets();
  // Keep historical accounts selectable when editing records from a removed bank.
  ['txAccountSelect', 'txToAccountSelect', 'loanAccountSelect', 'splitAccountSelect'].forEach(id => {
    const select = document.getElementById(id);
    const value = select && select.value;
    if (value && !wallets.some(w => w.id === value)) {
      wallets.push({ id: value, name: value, icon: 'account_balance', isBank: true });
    }
  });
  return wallets;
}

function updateAccountPickerLabels() {
  const wallets = accountPickerWallets();
  const targets = [
    ['txAccountSelect', 'txAccountPickerBtn'],
    ['txToAccountSelect', 'txToAccountPickerBtn'],
    ['loanAccountSelect', 'loanAccountPickerBtn'],
    ['splitAccountSelect', 'splitAccountPickerBtn']
  ];
  targets.forEach(([selectId, buttonId]) => {
    const select = document.getElementById(selectId);
    const button = document.getElementById(buttonId);
    if (!select || !button) return;
    const wallet = wallets.find(w => w.id === select.value);
    button.innerHTML = `<span class="account-picker-value">${mi(wallet ? wallet.icon : 'account_balance')}<span>${escapeHtml(wallet ? wallet.name : select.value)}</span></span><span class="account-picker-chevron" aria-hidden="true">⌄</span>`;
  });
}

function openAccountPicker(selectId) {
  if (selectId !== 'txAccountSelect' && selectId !== 'txToAccountSelect' &&
      selectId !== 'loanAccountSelect' && selectId !== 'splitAccountSelect') return;
  nativeVibrate(15);
  accountPickerTarget = selectId;
  const selected = document.getElementById(selectId).value;
  document.getElementById('accountPickerTitle').textContent = selectId === 'txToAccountSelect'
    ? 'To Account' : selectId === 'loanAccountSelect'
      ? 'Loan Account / Wallet' : selectId === 'splitAccountSelect'
        ? 'Split Account / Wallet' : state.selectedType === 'transfer' ? 'From Account' : 'Account / Wallet';
  const wallets = accountPickerWallets();
  const option = wallet => `<button type="button" class="account-option${wallet.id === selected ? ' selected' : ''}" data-wallet="${escapeHtml(wallet.id)}" aria-pressed="${wallet.id === selected}" onclick="selectWalletAccount(this.dataset.wallet)"><span class="wallet-icon">${mi(wallet.icon)}</span><span class="account-option-name">${escapeHtml(wallet.name)}</span>${wallet.id === selected ? '<span class="account-option-selected">Selected</span>' : ''}</button>`;
  const regular = wallets.filter(w => !w.isBank);
  const banks = wallets.filter(w => w.isBank);
  document.getElementById('accountPickerOptions').innerHTML =
    `<div class="account-picker-group">Wallets</div>${regular.map(option).join('')}` +
    (banks.length ? `<div class="account-picker-group">Bank accounts</div>${banks.map(option).join('')}` : '');
  document.getElementById('accountPickerDialog').classList.add('show');
  const selectedOption = document.querySelector('#accountPickerOptions .account-option.selected');
  if (selectedOption) selectedOption.focus();
}

function closeAccountPicker() {
  document.getElementById('accountPickerDialog').classList.remove('show');
  const buttonId = accountPickerTarget === 'txToAccountSelect'
    ? 'txToAccountPickerBtn' : accountPickerTarget === 'loanAccountSelect'
      ? 'loanAccountPickerBtn' : accountPickerTarget === 'splitAccountSelect'
        ? 'splitAccountPickerBtn' : 'txAccountPickerBtn';
  accountPickerTarget = null;
  document.getElementById(buttonId).focus();
}

function selectWalletAccount(walletId) {
  if (!accountPickerTarget || !document.getElementById('accountPickerDialog').classList.contains('show')) return;
  const select = document.getElementById(accountPickerTarget);
  if (!Array.from(select.querySelectorAll('option')).some(option => option.value === walletId)) return;
  select.value = walletId;
  nativeVibrate(15);
  updateAccountPickerLabels();
  closeAccountPicker();
}
