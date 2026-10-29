# Trip Splitter

Split a group trip's costs: record who paid, divide each cost equally, by exact amounts or by percentages, and see who owes whom. React, Redux Toolkit, React Router, strict TypeScript. No backend; data persists in `localStorage`.

## Run it

```
npm install
npm run dev        # http://localhost:5173
npm run typecheck
npm run lint
npm test
npm run build
```

## What it does

- **Expenses page:** totals, a balance card per member, settle-up suggestions, charts and the expense table with a category filter.
- **Add / Edit expense:** description, amount, date, payer, category and a split (equal, exact, percent) with a live breakdown and a "left to assign" counter.
- **Settle up:** the fewest payments that clear every balance, grouped by payer.
- **Members:** add one from the **Paid by** list. Remove one only while they are in no expense.
- **Deleting** an expense asks for confirmation.
- Responsive down to 360 px: the table becomes cards and links move to a bottom tab bar.

**Not done:** renaming members. The 360 px layout was checked by CSS reasoning and tests, not on a real device.

## Rules I chose

- **Money is integer paise.** Input is parsed from the string, never `parseFloat`, so `0.29` is exactly 29 paise. Percentages are integer basis points.
- **Extra paise:** ₹100 / 3 = 33.34 + 33.33 + 33.33. Leftover paise go one each to consecutive members, starting from a position derived from a hash of the expense's **id**. The id is created once and never changes, so the spread looks random across expenses but is stable for each one. Re-rolling would break balances and the preview. Editing description, date or payer never moves the extra paisa. Percent splits use largest-remainder. See `src/logic/split.ts`.
- **Limits:** amount up to ₹10,00,000.00, description 60 characters, member name 30, shown as hints.
- **Settle-up** is greedy: the biggest debtor pays the biggest creditor, which is not always the theoretical minimum.
- **Removing a member** is refused while any expense involves them.

## Three decisions

1. **Logic outside React.** Parsing, splitting, balances, settle-up and validation are plain functions in `src/logic/`, tested without React.
2. **Form state stays in the component.** Raw strings live in `useState` and errors are derived each render. Redux holds only shared data: members, expenses, the confirmation message and the half-filled Add form.
3. **`localStorage` is a store subscriber**, not in reducers or components. Saved data loads through type-guard parsers (no casts); unreadable data falls back to sample data.

## Tests

`npm test` runs 116 tests covering the logic, the form and the pages.

## With another day

Rename members, use the native `<dialog>`, and add a Playwright test for the 360 px layout.

## AI tools

I used Claude Code to write most of this project, then reviewed and ran it. Canva AI designed the logo.
