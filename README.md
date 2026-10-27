# Trip Splitter

Two-page app (Expenses, Add expense) for splitting a group trip's costs. React, Redux Toolkit, React Router, strict TypeScript. No backend; members and expenses persist in `localStorage`.

## Run it

```
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # tsc, strict, zero errors
npm run lint       # eslint + typescript-eslint (strict, type-checked)
npm test           # vitest + React Testing Library
npm run build
```

**Not finished / not done:** nothing from the brief is missing. Gaps: no editing of an existing expense, no renaming members (add one from the Paid by list, remove one from its Balances card once it is in no expense), and I checked the 360 px layout by CSS reasoning and tests, not on a real device.

## Rules I chose

- **Extra paise:** leftover paise go one each to the first members in trip-member order (the order in the member list, not click order). ₹100 / 3 = 33.34 + 33.33 + 33.33. Percentage splits use the largest-remainder method with ties broken by the same order. Both live in `src/logic/split.ts` and are used for balances, so the rule is identical everywhere.
- **Money is integer paise** everywhere. Input is parsed from the string (`parseDecimal`), never through `parseFloat`, so `0.29` is exactly 29 paise. Percentages are handled as integer basis points.
- Blank exact/percent inputs count as 0; members with 0 are left out of the saved split.

## Three decisions

1. **Logic outside React.** Parsing, splitting, balances and validation are plain functions in `src/logic/` (tested without React). `validateExpenseForm` returns either the finished `NewExpense` or an error object, so the form never parses anything itself.
2. **Form state stays in the component; Redux holds only shared data.** The form keeps raw strings in `useState`. Errors are *derived* on each render from `validateExpenseForm` (shown after the first Save, then live), so there is no error state to keep in sync. Redux holds members, expenses and the one-line confirmation message, which the Add page dispatches and the Expenses page shows.
3. **`localStorage` is a store subscriber, not in reducers or components.** `makeStore` loads saved members and expenses through type-guard parsers (`src/store/parse.ts`, no casts) and saves when `state.trip.members` or `state.trip.expenses` changes. Reducers stay pure. Unreadable or inconsistent saved data (bad JSON, unknown member, shares that do not add up) falls back to the sample data.

## With another day

- Edit expense; settle-up suggestions ("Diya pays Aarav ₹X").
- Replace the hand-rolled delete dialog with the native `<dialog>` and add a test for focus trapping.
- Per-field validation on blur, and a live "₹ left to assign" counter while typing.
- Add a browser-level test (Playwright) for the 360 px card layout.

## AI tools

I used Claude Code to scaffold and write most of this project, then reviewed and ran it, canva ai to design the logo and gemini to optimize the prompts.
