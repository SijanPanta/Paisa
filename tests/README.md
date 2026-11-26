# Frontend regression tests

Run from the repository root with Node.js 20+ (validated with Node.js 22):

```sh
node --test tests/*.test.js
```

No installation, Android SDK, browser, network or third-party packages are needed.

## Scope

The tests execute the real `app/src/main/assets/index.html` scripts in a shared
`node:vm` context, in HTML order, as classic scripts. They do not import modules
or concatenate scripts into a synthetic wrapper. Each test gets fresh state,
DOM, localStorage and optional AndroidBridge doubles.

Coverage includes:

- Local persistence, default migration, native backup fallback and native/browser helpers.
- Default wallets, nested bank management, combined balances, internal transfers, legacy account aliases,
  cascading bank/history deletion, themed source/destination selection, cancellation and bank/picker back navigation.
- Expense/income/transfer creation, detail display, editing/type changes, deletion confirmation,
  invalid amounts, same-wallet transfer rejection, wallet balances and analytics totals.
- Friend loans: To Pay/To Receive entry on the loans page with a redirect from the main timeline, pending loans held out of Net Balance,
  approval creating linked income/expense transactions, separate loans balance sheet,
  loan/wallet balance effects, deletion reversal, backup/restore/reset and back navigation.
- Individual loan details: per-loan timeline of recorded amounts, approvals, repayments and edits,
  add/reduce money from the detail sheet or edit sheet, validation, undo, persistence and loan-card click handling.
- Generic undo history for transaction add/edit/delete/transfer, loan approval/settlement reversal,
  loan/bank deletion and clear-all, plus header/detail/modal undo controls with a confirmation dialog and cancel path.
- Timeline history pagination in pages of 20, loan transactions hidden behind a redirect to the loans balance sheet,
  red expense amounts, and a free-transfer expense category that reduces wallets without counting as spending.
- CSV export, JSON backup/restore, legacy restore and malformed/cancelled file selections.
- Biometric supported/unsupported/current-session startup, authentication callbacks,
  settings changes, native lock/resume hooks and touch session refresh.
- Theme, navigation, hardware back priority, search, settings/presets, modal/backdrop bindings,
  monthly budget display and exactly one listener/render/vibration per filter click.
- Daily spend reminder toggle persistence ordering, restore resync, blocked/next-delivery status
  display and notification settings fallback.
- Custom reminder validation, save/toggle/edit/delete persistence and native sync ordering,
  tap-to-edit rows with the on/off switch and delete action inside the editor, backup/restore
  round-trip, startup resync, repeat labels and month-end clamping, and Android back dismissal for
  reminder dialogs.
- Ordered local scripts, local script/style/image and CSS `url()` existence, retained globals,
  and compilation/global function resolution for static and representative rendered handlers.

`baseline-globals.json` records the function/callback names that the frontend contract keeps available as globals. The two retired no-op lifecycle callbacks are intentionally omitted. The removed `WALLETS` constant must remain absent; `initApp` must be available.

`frontend-fixture.js` deliberately implements only the DOM surface this app uses:
HTML elements, descendant/id/class/equality-attribute selectors, classList,
text/HTML/value properties, event listener registration/dispatch, focus and scrolling.
It loads actual HTML IDs rather than inventing missing elements. Render functions run
normally, so a missing DOM ID or cross-script global fails a behavioral test.

## Limitations

- This is not a browser or Android emulator: no layout, CSS rendering, animation,
  WebView lifecycle, real fingerprint prompts, native file pickers or permission checks.
- Events are explicitly dispatched, without browser bubbling/default actions or automatic
  inline-handler execution. Inline handlers are separately compiled and their global calls
  checked for representative normal names, not exhaustively executed.
- FileReader completes synchronously from supplied text. Timers run only when flushed;
  their real delays, races and OS scheduling are not simulated.
- The HTML parser and selector implementation are intentionally limited, not standards-complete.
  Real-device/browser smoke tests are still needed, particularly for hostile restored data.
- Remote resources are not fetched. Asset checks cover local references in HTML and linked CSS,
  not URLs assembled dynamically in JavaScript.

## Baseline issues observed (application code intentionally untouched)

1. `escapeHtml` does not quote JavaScript string literals. Adding `O'Bank` produces
   `onclick="openAddModalForWallet('O'Bank')"`, which fails to compile. Other generated
   wallet action handlers use the same pattern. Normal-name handler contract tests are
   not a security audit; several transaction/category fields also enter HTML unescaped.
2. `openBudgetDialog` uses `state.settings.budget || 35000`, so saving zero hides the
   budget display correctly but reopening the dialog shows `35000` instead of zero.
3. CSV export doubles quotes in notes only. Custom bank names/currencies/categories
   containing quotes are not escaped consistently. Import hardening and CSV formula
   injection defenses are outside the behavior-preserving extraction tests.

The frontend contract enforces the extracted structure: ordered local scripts, no inline startup script, one filter listener per live chip, and required global callbacks/functions still resolvable from static/rendered handlers.
