// ── DATA STATE & DEFAULT CATEGORIES ───────────────────────────
const DEFAULT_EXPENSE_CATEGORIES = [
  { id: 'food', name: 'Food & Dining', icon: 'restaurant' },
  { id: 'groceries', name: 'Groceries', icon: 'shopping_cart' },
  { id: 'commute', name: 'Commute & Fuel', icon: 'directions_car' },
  { id: 'bills', name: 'Bills & Utilities', icon: 'bolt' },
  { id: 'shopping', name: 'Shopping & Daraz', icon: 'shopping_bag' },
  { id: 'rent', name: 'Rent & Housing', icon: 'home' },
  { id: 'entertainment', name: 'Entertainment', icon: 'movie' },
  { id: 'health', name: 'Health & Pharmacy', icon: 'local_pharmacy' },
  { id: 'education', name: 'Education', icon: 'school' },
  { id: 'personal', name: 'Personal Care', icon: 'content_cut' },
  { id: 'travel', name: 'Travel & Trips', icon: 'flight' },
  { id: 'free_transfer', name: 'Free Transfer', icon: 'swap_horiz' },
  { id: 'other_exp', name: 'Other', icon: 'auto_awesome' }
];

const DEFAULT_INCOME_CATEGORIES = [
  { id: 'salary', name: 'Salary', icon: 'work' },
  { id: 'freelance', name: 'Freelance & Tech', icon: 'computer' },
  { id: 'business', name: 'Business', icon: 'storefront' },
  { id: 'investment', name: 'Investment', icon: 'trending_up' },
  { id: 'gift', name: 'Gift / Allowance', icon: 'card_giftcard' },
  { id: 'other_inc', name: 'Other', icon: 'paid' }
];

const DEFAULT_WALLETS = [
  { id: 'Cash', name: 'Cash', icon: 'payments' },
  { id: 'eSewa', name: 'eSewa', icon: 'smartphone' },
  { id: 'Khalti', name: 'Khalti', icon: 'wallet' },
  { id: 'Bank', name: 'Bank Account', icon: 'account_balance' },
  { id: 'ConnectIPS', name: 'ConnectIPS', icon: 'bolt' },
  { id: 'Savings', name: 'Savings', icon: 'savings' }
];

function getAllWallets() {
  const custom = (state.bankAccounts || []).map(b => ({
    id: b.id || b.name,
    name: b.name,
    icon: 'account_balance',
    isBank: true
  }));
  return [...DEFAULT_WALLETS, ...custom];
}

function categoryIconFor(tx) {
  if (!tx) return 'category';
  if (tx.type === 'transfer') return 'swap_horiz';
  const list = tx.type === 'income' ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES;
  const category = list.find(c => c.id === tx.categoryId || c.name === tx.categoryName);
  if (category) return category.icon;
  return tx.type === 'income' ? 'paid' : 'payments';
}

function isNonSpendExpense(tx) {
  return !!(tx && tx.type === 'expense' && (tx.categoryId === 'free_transfer' || tx.categoryName === 'Free Transfer'));
}

let state = {
  transactions: [],
  bankAccounts: [],
  loans: [],
  settings: {
    currency: 'Rs.',
    budget: 35000,
    haptics: true,
    biometricLock: true,
    theme: 'light'
  },
  isLocked: false,
  activeFilter: 'all',
  searchQuery: '',
  editingTxId: null,
  selectedType: 'expense',
  selectedCat: 'food'
};

function saveState() {
  const copy = { ...state };
  delete copy.isLocked;
  const serialized = JSON.stringify(copy);
  localStorage.setItem('paisa_state', serialized);
  if (window.AndroidBridge && window.AndroidBridge.saveData) {
    window.AndroidBridge.saveData('paisa_backup', serialized);
  }
}

function loadState() {
  let data = localStorage.getItem('paisa_state');
  if (!data && window.AndroidBridge && window.AndroidBridge.getData) {
    data = window.AndroidBridge.getData('paisa_backup', '');
  }
  if (data) {
    try {
      const parsed = JSON.parse(data);
      state.transactions = parsed.transactions || [];
      state.bankAccounts = parsed.bankAccounts || [];
      state.loans = parsed.loans || [];
      state.settings = Object.assign({
        currency: 'Rs.',
        budget: 35000,
        haptics: true,
        biometricLock: true,
        theme: 'light'
      }, parsed.settings || {});
    } catch (e) {
      console.error('Failed to parse saved state:', e);
    }
  }
}
