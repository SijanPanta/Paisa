# Paisa --- Dashboard UI/UX Redesign Prompt

Use this document as the implementation brief for redesigning the
**Paisa personal money-tracker app**.

## Objective

Refine the existing Paisa mobile app into a polished, lightweight
financial product. Preserve its current identity and dark visual
direction, but improve information hierarchy, reduce visual clutter, and
make the transaction timeline the primary focus after the balance
summary.

This is an implementation task, not just a visual mockup. First inspect
the existing project, identify its framework, component structure,
styling system, navigation, data models, and current functionality. Then
implement the redesign using the project's existing conventions and
dependencies. Do not replace working business logic with mock data.

## 1. Design direction

-   Keep the existing **dark theme** and Paisa brand identity.
-   Aim for a clean, modern, premium finance-app aesthetic.
-   Make the interface feel lightweight, fast, calm, and
    information-dense without looking crowded.
-   Use a consistent spacing scale, typography scale, icon style, border
    treatment, and corner radius.
-   Prefer clear hierarchy and subtle surfaces over many nested cards.
-   Use blue selectively for primary actions, active states, and
    important highlights.
-   Use green for income and positive financial values; use muted red
    for expenses and negative values.
-   Avoid unnecessary gradients, decorative graphics, excessive borders,
    and large empty areas.
-   Do not introduce a large color palette or make the interface more
    colorful than necessary.

## 2. Design tokens

Use these as the starting palette. If the project already has design
tokens, update or map them rather than creating a competing system.

  Token              Value       Usage
  ------------------ ----------- -----------------------------------------
  App background     `#111315`   Main screen background
  Surface            `#1C1E22`   Cards and grouped content
  Elevated surface   `#25282D`   Icon containers, elevated controls
  Primary blue       `#80AAFF`   Primary actions, selected states, links
  Income green       `#65C99A`   Income and positive values
  Expense red        `#EF8989`   Expenses and negative values
  Primary text       `#F4F4F5`   Main labels and values
  Secondary text     `#9297A1`   Supporting labels and metadata
  Border             `#303338`   Subtle separators and outlines

### Shape and typography

-   Use approximately 16--22px corner radii for major surfaces, adapting
    to the existing design system.
-   Use consistent 44--48px transaction icon containers.
-   Use a readable font already available in the project. Inter or
    Manrope are suitable if a font choice is needed.
-   Use tabular numerals for currency amounts where supported.
-   Keep secondary labels visibly quieter than transaction titles and
    amounts.
-   Respect mobile safe areas and system navigation/status bars.

## 3. Dashboard hierarchy

Reorganize the home/timeline screen into this order:

1.  App header
2.  Compact balance summary
3.  Transaction filters
4.  Optional contextual notice (only when relevant)
5.  Transaction timeline
6.  Floating add-transaction action
7.  Existing bottom navigation

The transaction timeline should receive more usable vertical space than
it does currently.

### App header

-   Keep the Paisa brand/logo and app name on the left.
-   Keep search and theme controls on the right if those features
    already exist.
-   Align controls consistently and use accessible touch targets.
-   Avoid making the header unnecessarily tall.

### Balance summary card

The current balance card contains too many equally prominent sections.
Simplify it and reduce its height by approximately 20--25% where
practical.

**Primary information:** - Net balance as the dominant value. - Total
income. - Total expenses/spent.

**Secondary information:** - Monthly budget progress. - Remaining budget
amount.

Requirements: - Give the net balance the strongest visual emphasis. -
Present income and expenses in a compact, balanced two-column layout. -
Use green for income and muted red for expenses. - Show budget usage
with a thin progress bar and concise labels. - Avoid excessive dividers
and nested containers. - Keep currency formatting consistent with the
rest of the app (Nepali rupees, `रु`). - Do not hardcode the example
amounts from the reference screenshot. Use live project data and
existing calculations. - Make the card responsive to long balances and
different screen sizes.

### Loans information

Loans should not compete with the primary balance summary.

-   Remove the loans balance-sheet content from inside the main balance
    card.
-   Keep loan information in a separate, compact contextual banner or
    section.
-   Show the pending-loan count and outstanding amount only when
    applicable.
-   Provide a clear action to open the existing loans balance sheet.
-   Do not imply that pending or unapproved loans are included in net
    balance.
-   Preserve the app's current approval and repayment workflows.

If a loans notice is not relevant (for example, there are no pending
loans), do not show an empty banner.

## 4. Transaction filters

-   Keep the existing filters such as **All**, **Expenses**, **Income**,
    **Cash**, and **eSewa**, provided those filters are supported by the
    current app.
-   Make filter controls more compact than the current large pills.
-   Use a horizontally scrollable row if all filters do not fit.
-   Make the selected filter obvious with the primary blue accent.
-   Keep unselected filters neutral and low emphasis.
-   Ensure the filter row does not consume excessive vertical space.
-   Preserve the existing filter behavior and data semantics.

## 5. Transaction timeline

The transaction list is the main content area. Make it easy to scan
quickly.

### Grouping and layout

-   Group transactions by date using subtle date headers such as
    **Today**, **Yesterday**, or a formatted date.
-   Keep date headers compact and visually secondary.
-   Prefer a cohesive list with subtle separators over placing every
    transaction inside a separate large card.
-   Use consistent horizontal alignment and vertical spacing.
-   Keep transaction titles and amounts on the same visual row whenever
    possible.
-   Right-align all amounts.
-   Ensure long transaction titles and account names truncate gracefully
    without pushing amounts off-screen.

### Transaction rows

Each transaction should show:

-   A category-appropriate icon in a consistent 44--48px container.
-   Transaction title.
-   A concise secondary line with account/source and category metadata.
-   Amount aligned to the right.
-   A clear visual distinction between income, expenses, and transfers.

Specific guidance: - Use category-specific icons when category
information is available. - Use a sensible generic fallback icon when it
is not. - Keep transaction icons visually consistent in size and
treatment. - Use green for income, muted red for expenses, and blue or
neutral styling for transfers. - Keep metadata smaller and less
prominent than the title. - Avoid repeating information that is already
obvious from the transaction title or icon.

### Transfer handling

Transfers between the user's own wallets/accounts must be visually
distinct from income and expenses.

-   Label transfers clearly, including source and destination when
    available.
-   Do not style an internal transfer as income or spending.
-   Do not count an internal transfer as new income or an expense in
    aggregate financial calculations.
-   Preserve the existing accounting logic; verify the behavior rather
    than assuming how the current data model works.

## 6. Floating add-transaction action

-   Keep a floating `+` action for creating a transaction if that is the
    current primary workflow.
-   Use the primary blue accent and a clear plus icon.
-   Keep it above the bottom navigation and within the device safe area.
-   Ensure it does not cover transaction amounts, row actions, or
    important content.
-   Preserve the existing add-transaction flow and supported transaction
    types.
-   Verify behavior with the keyboard open and on smaller screens.

## 7. Bottom navigation

Keep the existing five destinations if they are part of the current
product:

-   Timeline
-   Analytics
-   Wallets
-   Loans
-   Settings

Refine the navigation rather than replacing it:

-   Use consistent icon sizes and label typography.
-   Make the active destination clear using the primary blue accent.
-   Keep inactive items muted.
-   Keep the navigation compact without making touch targets too small.
-   Preserve badges and notification counts where they currently exist.
-   Respect bottom safe-area insets.
-   Ensure the floating add button does not obscure navigation items.

## 8. Analytics, Wallets, Loans, and Settings consistency

Apply the same visual language across the rest of the app without
unnecessarily redesigning or removing their existing features.

-   Reuse the same colors, typography, spacing, icon containers, and
    surface styles.
-   Keep analytics charts readable and restrained.
-   Make wallet balances and account identities easy to scan.
-   Give loans a clear distinction between pending approvals, approved
    loans, repayments, and outstanding balances according to the
    existing data model.
-   Keep settings straightforward and functional.
-   Avoid introducing new navigation destinations unless the existing
    architecture requires them.

## 9. Interaction, accessibility, and responsive behavior

-   Preserve all existing routes, navigation, state management, API
    calls, database behavior, and business rules.
-   Every visible button, filter, banner, and navigation item must
    remain functional.
-   Use accessible labels for icon-only buttons.
-   Maintain sufficient contrast for text and interactive states.
-   Provide visible pressed, selected, disabled, loading, and error
    states where appropriate.
-   Use touch targets suitable for mobile interaction.
-   Handle small screens, long transaction names, large currency values,
    and different font scales.
-   Avoid horizontal overflow except for intentionally scrollable filter
    rows.
-   Respect system status bar, gesture navigation, and safe-area insets.
-   Do not add animations that make common financial tasks feel slower.

## 10. Implementation constraints

Before making changes:

1.  Inspect the project structure and identify the actual app entry
    points and relevant screen/components.
2.  Identify the existing framework, styling approach, icon library,
    navigation system, and reusable components.
3.  Trace how balances, income, expenses, budgets, wallets, transfers,
    and loans are calculated and displayed.
4.  Identify existing tests, lint rules, and formatting conventions.

While implementing:

-   Prefer refactoring and reusing existing components over duplicating
    UI.
-   Use the project's existing dependencies and icon library. Do not add
    dependencies unless genuinely necessary.
-   Do not rewrite backend logic or alter database schemas for a visual
    redesign.
-   Do not replace real data with the sample figures or transactions in
    this brief.
-   Do not remove features simply to make the screen look cleaner.
-   Keep business logic separate from presentation.
-   Avoid broad unrelated refactors.
-   Follow the project's existing code style and naming conventions.

## 11. Acceptance checklist

The work is complete when:

-   [ ] The dashboard has a clear visual hierarchy.
-   [ ] The balance summary is more compact and easier to scan.
-   [ ] Income and expenses are clearly distinguished.
-   [ ] Budget progress is visible but secondary.
-   [ ] Loan information is separated from the main balance card and
    shown contextually.
-   [ ] Transaction filters are compact and usable on small screens.
-   [ ] Transactions are grouped by date with subtle headers.
-   [ ] Transaction rows are consistent, compact, and easy to scan.
-   [ ] Income, expenses, and transfers are visually distinct.
-   [ ] Internal transfers are not misrepresented as income or expenses.
-   [ ] The floating add button does not obscure content or navigation.
-   [ ] Bottom navigation remains functional and visually consistent.
-   [ ] Existing app features, data, and workflows continue to work.
-   [ ] No sample values from this brief have been hardcoded.
-   [ ] The app builds successfully and relevant checks/tests pass.

## 12. Expected output

Implement the redesign directly in the existing project.

When finished, provide:

1.  A concise summary of the UI changes.
2.  The main files/components changed.
3.  Any design tokens or reusable components introduced or updated.
4.  Build, lint, and test results (state clearly if any were not run).
5.  Any remaining issues or assumptions.

**Overall direction:** Preserve Paisa's existing dark identity and blue
accent. Reduce visual noise, simplify the balance card, separate loans
from the primary financial summary, and make the transaction timeline
the star of the experience. The result should feel like a carefully
designed modern finance app---not a dashboard made from too many cards.
