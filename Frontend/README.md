# Trip Splitter

Split a group trip's costs: record who paid, divide each cost equally, by exact amounts or by percentages, and see who owes whom. React, Redux Toolkit, React Router, strict TypeScript. No backend; members and expenses persist in `localStorage`.

## Run it

```
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # tsc, strict, zero errors
npm run lint       # eslint + typescript-eslint (strict, type-checked)
npm test           # vitest + React Testing Library
npm run build      # typecheck, then a production build in dist/
```

## What it does

- **Expenses page:** trip summary (total, number of expenses, members), a balance card per member, settle-up suggestions, charts (by category, by month, paid vs. share per person), and the expense table with a category filter.
- **Add / Edit expense:** description, amount, date, who paid, category, and a split (equally, exact amounts or percentages) with a live breakdown. Edit opens the same form prefilled from the saved expense.
- **Settle up:** the fewest payments that clear every balance, grouped by who pays, for example "Rohan pays ₹11,100.00: to Kabir ₹3,841.58, to Aarav ₹7,258.42".
- **Members:** add one from the **Paid by** list on the expense form. Remove one from its Balances card, but only while they are in no expense; otherwise the card says "In 3 expenses" instead.
- **Deleting** an expense asks for confirmation first, and balances recalculate.
- Responsive down to 360 px: the table becomes cards and the page links move to a bottom tab bar on phones.

**Not done:** renaming a member. The 360 px layout was checked by CSS reasoning and tests, not on a real device.

## Rules I chose

- **Extra paise:** ₹100 / 3 = 33.34 + 33.33 + 33.33, so one person pays an extra paisa. Who it is is *not* always the first member: the leftover paise go one each to consecutive members (in member-list order, wrapping around) starting from a position worked out from the expense's **id**. The id is random and made once, when the expense is created, then never changes. That gives a random-looking spread across expenses, but the same answer every time for the same expense. Re-rolling on every render would be wrong, because balances are recomputed from the saved expenses each time and the form preview has to match what gets saved. For that reason the Add page picks the id when it opens, and the preview and the saved expense use the same one. Editing the description, date or payer never moves the extra paisa; changing the amount or who is in the split can, because the leftover itself changes. Percentage splits use the largest-remainder method with ties broken from the same starting position. All of it lives in `src/logic/split.ts` and is shared by the preview, saving and balances.
- **Money is integer paise** everywhere. Input is parsed from the string (`parseDecimal`), never through `parseFloat`, so `0.29` is exactly 29 paise. Percentages are handled as integer basis points.
- **Limits:** an amount can be at most ₹10,00,000.00 with 2 decimals, a description 60 characters, a member name 30 characters. Each limit is shown as a hint under its input, so nobody finds out by hitting it.
- Blank exact/percent inputs count as 0; members with 0 are left out of the saved split.
- **When errors appear:** a field's error shows as soon as you leave it (blur), and Save shows all of them at once. After that they follow the input live. Exact amounts and percentages also show a live "₹ left to assign" / "% remaining" counter from the first keystroke.
- **Settle-up** is greedy: the person who owes most pays the person owed most, until everyone is at zero. That needs at most one payment fewer than there are people, though not always the theoretical minimum.
- **Removing a member** is refused while any expense has them as payer or in its split, because removing them would break that expense and the balances. The trip always keeps at least one member.

## Three decisions

1. **Logic outside React.** Parsing, splitting, balances, settle-up and validation are plain functions in `src/logic/` (tested without React). `validateExpenseForm` returns either the finished `NewExpense` or an error object, so the form never parses anything itself.
2. **Form state stays in the component; Redux holds only shared data.** The form keeps raw strings in `useState`. Errors are *derived* on each render from `validateExpenseForm` and filtered by which fields were left or saved (`visibleErrors`), so there is no error state to keep in sync. Redux holds members, expenses, the one-line confirmation message, and the half-filled Add form so it survives switching pages.
3. **`localStorage` is a store subscriber, not in reducers or components.** `makeStore` loads saved members and expenses through type-guard parsers (`src/store/parse.ts`, no casts) and saves when `state.trip.members` or `state.trip.expenses` changes. Reducers stay pure. Unreadable or inconsistent saved data (bad JSON, unknown member, shares that do not add up) falls back to the sample data.

## Project layout

```
src/
  logic/        money, split, balances, settle-up, validation, edit helpers (+ tests)
  store/        Redux slices, typed hooks, localStorage persistence and parsing
  components/   ExpenseForm, ExpenseTable, BalanceList, SettleUp, charts, dialog
  pages/        Expenses, Add expense, Edit expense, Not found
  data/         sample trip used until you save your own
```

## Tests

`npm test` runs 116 tests: the split and balance logic (including ₹100 split equally between 3), settle-up, validation, edit round-tripping, the expense form (errors for invalid input, saving valid input, errors on blur) and the pages (adding, editing, deleting, adding and removing members, settle-up).

## With another day

- Rename members.
- Replace the hand-rolled delete dialog with the native `<dialog>` and add a test for focus trapping.
- Add a browser-level test (Playwright) for the 360 px card layout.

## AI tools

I used Claude Code to scaffold and write most of this project, then reviewed and ran it, canva ai to design the logo and gemini to optimize the prompts.
