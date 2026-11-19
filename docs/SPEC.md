# Spendio — v1 Specification

> Upload your bank statement, see where your money goes, and check it against your budget.
> Status: agreed design, pre-implementation (2026-11-16).

## 1. Product summary

Spendio is a budgeting web app. You upload a bank statement CSV; Spendio automatically categorizes each transaction, shows what you spend money on, compares spending against per-category monthly limits, and shows how much you saved.

- **First user:** the author (Nordea, Sweden, SEK). **Later:** a public website.
- **Core promise:** *your bank data never leaves your device.* Everything is parsed, categorized and stored in the browser.

## 2. Principles

1. **Local-first.** No backend, no accounts, no analytics, no third-party scripts in v1. The server only serves static files.
2. **Privacy by default.** Personnummer are dropped on import and never stored, displayed, logged, exported or committed.
3. **Correct numbers over clever features.** Transfers are never spending; refunds offset spending; past budget months are never rewritten.
4. **Pure core.** All domain logic lives in a framework-free TypeScript module with exhaustive unit tests.
5. **Designed for later.** Sync, AI categorization, encryption and more banks must be addable without migrations that break existing data.
6. **Generic by design.** Spendio is not tied to one bank or country. Each bank's export is a pluggable **bank format** (Nordea is the first), and everything country-specific (currency, banking days, payday, merchant rules, national ID scrubbing) sits behind a **country** definition (Sweden is the only one in v1). Bank-neutral code never names a specific bank or country.

## 3. Scope

### v1
- CSV import from any bank: built-in bank-format presets (Nordea first; more Swedish banks can be added as presets) + generic CSV column mapper for everything else (saved per file layout)
- One country, Sweden (SEK, Swedish banking days and merchant rules), behind a country definition so others can be added later
- Duplicate-safe re-imports, import summary, undo an import batch
- Rules-based categorization (built-in Swedish rules + rules learned from user corrections)
- Post-upload review, grouped by merchant
- Editable flat categories + system types (Income, Transfer)
- Payday-based periods (25th, adjusted to the previous Swedish banking day)
- Budgets: per-category and overall monthly limits
- Dashboard, Transactions, History, Savings, Categories & Rules, Settings
- JSON backup export/import, wipe all data
- Responsive (phone width), light/dark mode following system

### Next (passcode encryption)
- Optional passcode: encrypts all stored data (Web Crypto, PBKDF2 → AES-GCM), unlock screen, auto-lock, change passcode
- Encrypted backups using the same passcode

### Later (not designed in detail; keep the door open)
- Optional AI categorization for leftover transactions (bring-your-own-key, or hosted; undecided). Only cleaned merchant names would be sent, never amounts or account data, and only with explicit opt-in.
- Optional accounts + sync across devices (backend)
- Multiple accounts (e.g. savings, credit card), multi-currency
- More bank presets, PDF statements
- More countries (a new `country/` definition: currency, banking days, payday, merchant rules, ID scrubbing)
- Split transactions, budget rollover, per-month limit overrides
- Swedish UI language
- Backup *merge* (v1 backup import replaces everything)

### Explicitly out of scope for v1
Server-side storage, user accounts, AI, PDF parsing, multiple accounts per bank, countries other than Sweden, multiple currencies, split transactions, rollover.

## 4. Data input

Each bank's export is a **bank format** (`core/formats/`): an id, a display name, its country, and functions to `detect` the file (header only), `parse` it into rows, and `describe` its description text (§5). The import pipeline tries the registered formats in order and uses the first that matches; a file no format recognizes goes to the generic mapper (§4.2). Adding a bank means adding one format and registering it.

### 4.1 Nordea (first bank format; observed in a real export, 2026-11-16)

```
Bokföringsdag;Belopp;Avsändare;Mottagare;Namn;Rubrik;Saldo;Valuta;
2026/11/15;-129,00;<personnummer>;;;Kortköp 261114 Spotify P4938CFA38;1863,89;SEK;
```

| Property | Value |
|---|---|
| Encoding | UTF-8 **with BOM** |
| Delimiter | `;`, with a **trailing `;`** on every line (→ empty last column, ignore) |
| Date (`Bokföringsdag`) | `YYYY/MM/DD`, booking date |
| Amount (`Belopp`) | Signed, decimal comma (`-129,00`, `13592,00`). Negative = money out |
| `Avsändare` / `Mottagare` | Contain the account owner's **personnummer** → **dropped at parse time, never read into the model** |
| `Namn` | Empty in observed data; ignore unless non-empty (then treat like `Rubrik` suffix) |
| `Rubrik` | Description, the only useful text field |
| `Saldo` | Running balance after the transaction, used for dedup |
| `Valuta` | `SEK` |
| Order | Newest first |
| Filename | Contains the personnummer → never stored; batches are labelled `<bank name> · <import date>` (here `Nordea · 2026-11-16`) |

Detection: header row (after stripping the BOM) matches the Nordea column set.

Nordea has changed its export format before. If an export doesn't match, fall back to the generic mapper and add a new preset.

### 4.2 Generic CSV mapper
For non-preset files: the user maps columns → `date`, `amount` (or `debit` + `credit`), `description`, optional `balance`, and picks the date format, decimal separator and delimiter (auto-detected where possible). The mapping is saved, keyed by the header row, so the next import of the same layout is one click.

- **When:** an import no format recognizes opens the mapper if the file reads as a table (≥ 2 columns, ≥ 1 data row); anything else gets an error.
- **Detection** (`core/csv/sniff.ts`): the delimiter that splits the first lines most consistently; the date column and format from values (day-first preferred when ambiguous, as in Sweden; month-first only when a day is over 12); decimals from how numbers end; money columns from values, with header hints for debit/credit/amount/balance; the description from header hints in priority order (text, rubrik, beskrivning, description, then meddelande/specifikation), else the longest text column. **A column whose values are mostly national ID numbers is never suggested.**
- **Mapping** (`core/csv/mapping.ts`): `{ id, headerSignature, name, delimiter, dateFormat, decimal, columns: { date, amount | debit + credit, description[], balance? }, createdAt }`. Date formats: `YYYY-MM-DD`, `YYYY/MM/DD`, `YYYYMMDD`, `DD/MM/YYYY`, `DD.MM.YYYY`, `DD-MM-YYYY`, `MM/DD/YYYY`. One mapping per header layout; validated on backup restore.
- **Parsing** (`core/csv/generic.ts`): same contract as presets — scrubbed text, signed öre (debits are money out whether written positive or negative), bad lines reported with line numbers.
- **As a bank format** (`core/formats/generic.ts`): id `csv:<mapping id>`, named after the bank the person gave, country Sweden (v1). Descriptions are read bank-neutrally: leading date/reference tokens are stripped so merchant rules match, and a leading YYMMDD / YYYY-MM-DD that is a plausible purchase date (0–30 days before booking) becomes the effective date. Kind is `other` (bank-specific wording like Swish is only understood by presets).
- Imports try the presets first, then saved mappings. Forgetting a mapping keeps already imported transactions.

### 4.3 Personnummer scrubbing
- Nordea parser drops `Avsändare` and `Mottagare` entirely.
- Defense in depth: every text field is scrubbed for personnummer patterns (`YYMMDD-XXXX`, `YYMMDD+XXXX`, `YYYYMMDD-XXXX`, and 10/12-digit runs that form a valid date + Luhn check) before it enters the model. Matches are replaced with `[redacted]`.
- Applies to the generic mapper too.

### 4.4 Amounts
Stored as **integer öre** (`-129,00` → `-12900`) to avoid floating-point errors. Displayed in Swedish format: `1 234,56 kr`.

### 4.5 PDF statements
A text PDF has no rows or columns, only text placed on pages, so a PDF is first turned into a table and then goes through the **same pipeline as a CSV** (presets, the mapper, dedup, categorization). No bank-specific PDF code beyond a layout preset.
- **Reading** (`ui/pdf.ts`): pdf.js in a web worker served from the site, downloaded only when a PDF is picked (lazy chunks). No eval, no font loading, no fetching, so the CSP is unchanged. A file is a PDF by its first bytes (`%PDF-`), not its name. At most 100 pages.
- **Table** (`core/pdf/table.ts`, pure): group text into lines by position; the **header** is the first line with ≥3 cells, no digits and dated lines right below it; every later line (all pages) is sorted into the header's columns by horizontal overlap (else nearest), and only lines with a date in the date column are kept. This drops everything around the table: account details (name, account number), month headings, pending rows, totals, page footers. The result is `;`-separated text with the PDF's own header.
- **Layouts**: a PDF table whose header a preset knows imports directly; any other bank's PDF goes to the column mapper once, like a CSV. **Nordea PDF** ("Kontohändelser", observed 2026-11-19): `Datum | Namn | Belopp | Saldo`, ISO dates, decimal comma, space thousands separator; "Namn" holds the CSV's "Rubrik" text, so Nordea's description reader applies. It shares the CSV preset's `id`, so CSV and PDF are one account and overlapping files dedupe.
- **Pending rows** ("Reserverat") are skipped: they aren't booked and would return as duplicates. Nordea's totals box (opening balance, money in/out) *includes* pending rows, so it isn't used as a check; the running balance is.
- **Errors**: password-protected, invalid, image-only (scanned), no transaction table, too long, each with its own message. Other failures (e.g. the reader not starting) are reported as is, never blamed on the file.
- **Hosting**: the worker is an `.mjs` file; nginx's stock types lack `.mjs`, so `docker/nginx.conf` adds `text/javascript` for it (with `nosniff`, a wrong type stops the worker).
- **Tests** use `fixtures/nordea-pdf-sample.pdf`, an invented statement made by `fixtures/make-nordea-pdf.mjs`. PDFs are git-ignored outside `fixtures/`, and fixture PDFs are checked for personnummer like CSVs.

## 5. Description parsing and merchant cleanup

`Rubrik` is parsed into `kind`, optional `purchaseDate`, and a cleaned `merchant`.

| Rubrik pattern | `kind` | Notes |
|---|---|---|
| `Kortköp YYMMDD <merchant>` | `card` | `YYMMDD` = purchase date |
| `Swish betalning <name>` | `swish_out` | |
| `Swish inbetalning <name>` | `swish_in` | |
| `Swish återbetalning <name>` | `swish_refund` | |
| `Autogiro <name>` | `autogiro` | Direct debit |
| `Insättningsautomat`, `Insättning …` | `deposit` | |
| anything else (e.g. `LYSA`, `Studiestöd`) | `other` | Whole text is the merchant |

**Purchase date:** from `Kortköp YYMMDD` (`261031` → 2026-10-31). Sanity check: if it's after the booking date or more than 30 days before it, ignore it and use the booking date.
**Effective date** = purchase date if present, else booking date. Periods use the effective date.

**Merchant cleanup**, in order:
1. Remove the kind prefix (and the date for `card`).
2. Strip known payment-processor prefixes (explicit allowlist, extendable): `NMB*`, `WL *`, `PAYPAL_*`, `PAYPAL *`, `SQ *`, `SUMUP *`, `IZ *`, `ZETTLE_*`, `KLARNA*`.
3. Strip trailing noise tokens: pure digit runs (`ROBLOX.COM 188885825`, `Espresso House 398`, `Pressbyran 4208856`) and mixed reference codes (`Spotify P4938CFA38`, `Reklamfritt *BB4SS7W`).
4. Collapse whitespace; trim stray `*`.
5. `merchantKey` = uppercase, diacritics kept (`HEMKÖP`), used for matching. `merchantDisplay` = the cleaned original casing.

Merchant names are often truncated by the bank at ~20 characters (`STIFTELSEN TEKNISKA`, `SUSHIARENAN`). Rules therefore support `startsWith`/`contains`.

**Swish person vs business:** a Swish counterparty is treated as a **business** if it matches a rule, or contains a company marker (`AB`, `HB`, `KB`, `STIFTELSEN`, `FÖRENING`, `AKTIEBOLAG`) as a whole word; otherwise it's a **person**.

## 6. Categories

Flat, user-editable (rename, add, delete, color). Deleting a category requires choosing where its transactions and rules move. Categories are listed alphabetically (Swedish collation) everywhere.

When a default category is deleted, the built-in rules and default suggestions that point at it stop applying: matching transactions go to Needs review instead of to a category that no longer exists. (A merchant a built-in rule knows still counts as a business for Swish.)

Each category has a `type`:
- `spending`: counts toward spending totals and budgets
- `income`: system category **Income**, cannot be deleted
- `transfer`: system category **Transfer**, with `transferKind`: `savings` or `internal`; cannot be deleted. Never counts as spending or income.

**Default spending categories:** Groceries · Restaurants & Cafés · Transport · Shopping · Subscriptions · Gaming · Entertainment · Health & Fitness · Housing & Bills · Travel · Swish to people · Swish from people · Other

**System:** Income · Transfer: Savings · Transfer: Internal

**Swish from people** is the mirror of "Swish to people": money back from people (split bills, someone paying you back). It is a spending category whose total is usually negative, so it **lowers total spending instead of inflating income**: pay 900 kr for dinner, get 450 kr back → Spent 450 kr. The dinner still shows in full under its own category, with the repayment as a separate "money back" line. Gifts from people belong in Income. Added to existing databases by the schema v2 upgrade. (Later: link a repayment to the purchase it pays back, so it offsets that exact category.)

**Needs review** is not a category: it's `categoryId = null`.

### Money back (refunds, repayments)
- Every transaction has exactly **one** category.
- **Spending category totals are net**: `spent = −Σ amount` over the category's transactions in the period. Incoming money assigned to a spending category (a friend paying back a dinner, a merchant refund) reduces that category's total. A negative total is shown as a net refund.
- No split transactions in v1.

## 7. Categorization

### 7.1 Rule model
A rule matches on `merchantKey` (optionally restricted by `kind`) with operator `equals` | `startsWith` | `contains`, case-insensitive. **No regex in the UI.**

### 7.2 Priority
1. **User rules** (learned from corrections)
2. **Built-in merchant rules** (Swedish merchants)
3. **Built-in kind rules** (e.g. `Studiestöd` → Income)
4. Otherwise → Needs review

Within a tier, the most specific match wins: `equals` > `startsWith` > `contains`, then a rule restricted to the transaction's kind over an unrestricted one, then the longest pattern, then the newest rule (then rule id, so the result never depends on rule order).

A user's manual category on a single transaction (`categorySource = 'manual'`) is never overwritten by rules, re-imports or rule changes.

### 7.3 Built-in rules (initial seed, extend over time)

| Match | Category |
|---|---|
| ICA, COOP, WILLYS, HEMKÖP, LIDL, CITY GROSS, MATHEM | Groceries |
| ESPRESSO HOUSE, PRESSBYRAN, MAX, MCDONALDS, SUSHI, PIZZERIA, KONDITOR | Restaurants & Cafés |
| SL, AB STORSTOCKHOLMS L, SJ.SE, VÄSTTRAFIK, SKÅNETRAFIKEN, PARKSTER, EASYPARK, ST1, CIRCLE K, PREEM, OKQ8, UBER, BOLT | Transport |
| SPOTIFY, NETFLIX, DISNEY PLUS, AMAZON PRIME, HBO, VIAPLAY, ANTHROPIC, YOUTUBE | Subscriptions |
| STEAM, ROBLOX, TEBEX, PLAYSTATION, XBOX, NINTENDO, EPIC GAMES | Gaming |
| ÅHLENS/AHLENS, LAGERHAUS, SØSTRENE GRENE/SOSTRENE GRENE, KJELLCO, CLAS OHLSON, H&M, IKEA, INET | Shopping |
| APOTEK, NORDICWELL, SATS, FRISKIS | Health & Fitness |
| LYSA, LYSA SPAR | Transfer: Savings |
| STUDIESTÖD, LÖN | Income |

### 7.4 Kind-based defaults (when no merchant rule matches)
| Kind | Default |
|---|---|
| `deposit` | Income |
| `swish_out` to a person | **Swish to people**, flagged as a suggestion in review |
| `swish_in` from a person | **Swish from people**, flagged as a suggestion in review |
| `swish_refund` | Category of the counterparty's rule, else Needs review |
| everything else unmatched | Needs review |

### 7.5 Learning from corrections
- In review: category per merchant group + **"Remember for future imports"** (checked by default; **unchecked by default for Swish to or from people**). Remember = create a user `equals` rule on `merchantKey` (+ `kind` for Swish).
- A category chosen in review is stored as the user's own (`categorySource = 'manual'`). Keeping a pre-filled suggestion confirms it; clearing one sends the group back to Needs review; groups left untouched (including unconfirmed suggestions) stay in review. All decisions from one review are saved in a single storage transaction.
- Editing a single transaction later offers **"Only this one"** or **"This and future ones from <merchant>"**, plus an option to apply to past uncategorized/rule-assigned transactions from that merchant. Manual assignments are never touched.
  - "Only this one" stores the choice as `manual`. "All from <merchant>" saves a user `equals` rule (limited to the Swish direction for Swish), sets this transaction to `user_rule`, and — with "also change earlier ones", ticked by default — re-categorizes every other non-manual transaction from that merchant, all in one storage transaction.
  - Setting a transaction back to Needs review only ever affects that one transaction.

## 8. Import pipeline

1. Read file → detect its **bank format** (§4); if none matches, open the generic mapper.
2. Parse rows with that format → scrub national ID numbers → parse amounts (öre), dates, descriptions.
3. **Dedup** (below).
4. Describe (format) and categorize new rows with the rules of the format's **country**.
5. Save as one **ImportBatch**, in one storage transaction. The bank's **account** is created on its first import (a fresh install has none).
6. Show **import summary**: `56 rows · 41 new · 15 already imported`.
7. Go to **review** (skippable).

### Dedup
- `fingerprint = accountId · bookingDate · amount · description · balance · #occurrence`. These are the fields joined into a readable key, **not a hash**: a hash collision would silently drop a real transaction as a duplicate. The description's whitespace is normalized; line numbers are not included. `balance` is empty when the source has none.
- `#occurrence` numbers identical rows within one file (`#0`, `#1`, …). This makes dedup **multiset-aware**: if a file has *n* copies of a row and *m* are already stored, `max(0, n − m)` are imported. (Identical rows, e.g. two `ROBLOX.COM` purchases on the same day, are both real; the balance usually tells them apart anyway, and the occurrence index covers sources without a balance column.)
- Re-imports never change existing transactions or their categories.
- **Undo import:** deletes all transactions of a batch (asks first).

## 9. Periods (payday months)

- Setting: **period start day** `D` (1–28), default **25**, plus "adjust to the previous banking day" (default on).
- `payday(year, month)` = the last Swedish banking day on or before day `D` of that month (or exactly day `D` when the adjustment is off). With `D = 1` it is always the 1st, so periods are plain calendar months.
- A period runs from one `payday` to the day before the next, and is **labelled by the month it mostly falls in**, using a cutoff fixed per start day:
  - `D` 16–28: the label is the month **after** the start. Example: payday Nov 25 → period **"December"** = Nov 25 – Dec 22 (December payday is the 23rd).
  - `D` 1–15: the label is the month the period **starts in**. Example: `D = 1` → **"November"** = Nov 1 – Nov 30.
  - The cutoff can't vary per month (that would give some periods two labels or none). For mid-month start days the split is roughly even, so the label there is a convention.
- Periods are **always derived, never stored**, so changing `D` just recomputes everything.

**Swedish banking holidays** (computed locally, no API): Nyårsdagen (1 Jan), Trettondedag jul (6 Jan), Långfredagen, Påskdagen, Annandag påsk, Första maj, Kristi himmelsfärdsdag (Easter + 39), Nationaldagen (6 Jun), Midsommarafton (Fri 19–25 Jun), Midsommardagen, Alla helgons dag, Julafton (24 Dec), Juldagen, Annandag jul, Nyårsafton (31 Dec). Plus all Saturdays and Sundays. Easter via the anonymous Gregorian algorithm.

## 10. Budgets

- Optional **standing monthly limit** per spending category, plus one optional **overall limit** (vs total net spending).
- Each limit is stored with `effectiveFrom` (a period label, e.g. `2026-12`). The limit for period P is the one with the latest `effectiveFrom ≤ P`. **Changing a limit applies from the current period onward; past periods keep their limits.** Removing a limit = a new record with `amount = null`.
- No rollover in v1.
- **Status** (`ratio = netSpent / limit`):
  - **On track**: `ratio < 0.8`
  - **Close**: `0.8 ≤ ratio ≤ 1.0`
  - **Over**: `ratio > 1.0`, show the overage (`+340 kr`)

## 11. Savings

- **Left over** = `income − netSpending` for the period (the headline number).
- **Savings rate** = `leftOver / income` (hidden when income is 0).
- **Moved to savings** = `−Σ amount` of `Transfer: Savings` transactions (money out to Lysa positive, money back from Lysa negative).
- `Transfer: Internal` counts in neither.
- **Needs review** transactions (no category, or a category that no longer exists) are left out of every total above and reported separately as a count plus money out and money in, so the UI can show how much is still uncategorized (e.g. "3 transactions, 105 kr out, not counted yet").

## 12. Screens

### Landing page (`#/welcome`)
What Spendio is, for someone who has never seen it. First-time visitors (no transactions, no route in the URL) land here instead of an empty overview; everyone else reaches it from **About Spendio** in the footer. The app menu is hidden on it.
1. Headline "See where your money goes.", one paragraph on what Spendio does and that nothing is uploaded, then **Try it with sample data** and **Add your own statement**. With data already there, a single **Open your overview** instead.
2. A before/after of five sample-statement lines (raw description → merchant, amount, category), computed by the real importer from the bundled sample so it can only show what the app does.
3. **How it works**: export a CSV → Spendio sorts it → follow your payday month.
4. **What you get**: Overview, Budgets, History, Savings, Transactions.
5. **Your data stays with you**: no account or server, the CSP blocks sending data, personnummer removed on import; data lives in this browser, so keep a backup.
6. **Made for Sweden, for now**: kronor, Swedish paydays and holidays; any bank's CSV works.
7. Closing call to action repeating the buttons.

### Dashboard (selected period)
1. Period switcher `‹ Oct   November 2026   Dec ›` with the period's real dates (e.g. "23 Oct – 24 Nov"), limited to the first period with data and today's period. Opens on today's period if it has transactions, otherwise on the latest period that does.
2. **Needs review** notice (only when > 0), near the top because it explains incomplete totals; links to the review screen.
3. Headline numbers: **Spent** (with % change vs the previous period) · **Budget left** (overall limit − net spending; "Over budget by …" in the warning color) · **Left over** (with savings rate).
4. **Budgets**: "All spending" (the overall limit) first, then only categories *with* a limit, sorted Over → Close → On track (then by ratio), with a meter bar, `spent of limit` and the status spelled out in text ("Over by 29 kr", "84 % used, 131 kr left"). Limits are set, changed or removed inline; a picker offers every spending category without a limit. A change applies from the shown period on. Spending without a limit isn't repeated here — it's in the chart.
5. **Spending by category**: ranked horizontal bars, largest first, one hue, value at the tip, share of spending on hover/focus. Money back (e.g. Swish from people) is noted under the chart, not drawn as a bar.

Clicking a category anywhere (chart bars, budget rows) → Transactions filtered by that category and period; "All spending" → all transactions in the period.

### Other pages
- **Upload** (file picker + drag and drop; preset banks listed from the format registry; clear errors for files that aren't a table, empty or oversized files) → **Set up this file's layout** only for a table no format recognizes (bank name first, the file's first rows, column pickers labelled with example values, one amount column or money out / money in, date/decimal/separator formats, a live preview of the first 5 rows as they will import and of lines that can't be read; "Save and import" enabled once named, complete and at least one row reads) → **Import summary** (new / already imported / lines that couldn't be read, with line numbers) → **Review** (one group per merchant *and* kind, so "Swish to Anna" and "Swish from Anna" are separate decisions; sorted by absolute total; category dropdown pre-filled with any suggestion + "Remember" checkbox; "Skip for now"). The flow then continues to the overview.
- **Sample data:** while there is no data at all, the landing page ("Try it with sample data") and "Add statement" ("Try Spendio with sample data") offer it: a synthetic sample statement (the `fixtures/nordea-sample.csv` test fixture: fake names, no personnummer) bundled into the app and imported with the label "Sample data". The overview then shows "You’re exploring sample data" with **Remove sample data** (removes only sample imports and returns to Add statement); Settings lists it as "Sample data". It lets someone explore every screen without a bank export, e.g. on the public site.
- Person names (Swish counterparties) are tidied for display only: `DOE,JOHN` → "John Doe", all-caps names re-cased. Rules keep matching the original text.
- **Transactions**: one row of filters — period (periods with data, newest first, or all), category (or Needs review), type, and search (merchant, tidied person name, bank text; all words must match) — kept in the URL (`#/transactions?period=…&category=…&kind=…&q=…`) so filtered views survive reloads and can be linked to. Newest first, 100 rows at a time ("Show more"). Each row: readable title, date and type, amount, and an inline category picker that asks "Only this one" or "All from <merchant>" (§7.5).
- **History** (`#/history`): answers "do I keep going over?" as a table (rows: "All spending", then categories with limits — most often over first — then the rest by total; columns: 6 periods, oldest first). Each cell shows the net spent and, where a limit applied that month, "of 1 000 kr" or "over by 645 kr" (with a light warning tint as a second cue only). Each row with limits summarizes "Over in 1 of 3 months" / "Within the limit every month". Limits are looked up per period, so raising a limit never changes how earlier months are judged. Cells link to the matching transactions. "‹ Earlier / Later ›" move the window by 6 periods, never past the last period with data; the window is kept in the URL (`?end=YYYY-MM`). Categories with only money back are left out. On phones the category column stays put while months scroll sideways (with a hint).
- **Savings** (`#/savings`): the same six-period window as History (shared navigation, `?end=` in the URL). Totals for the window: **Left over** (of total income), **Savings rate** (total left over ÷ total income), **Moved to savings** (net, after money taken out). Two column charts around a zero line — "Left over each period" (below zero when more was spent than earned) and "Moved to savings each period" (below zero when more was taken out than put in; replaced by a sentence when nothing moved) — and an "In numbers" table per period (income, spent, left over, rate, moved), which is also the charts' exact, accessible view.
- **Categories & Rules** (`#/categories`):
  - *Categories*: spending and "not spending" (income, transfers) listed separately, each with its color (native color picker), name, transaction count and "built in" for system categories. Inline rename (duplicate names rejected with a message), a monthly limit from the current period on (spending categories only), and delete for non-system categories. Delete opens an inline confirmation (no browser dialog) that says what moves where ("Move its 3 transactions and 1 rule to [Other]") and that limits are removed. A form adds a new spending category.
  - *Rules*: your rules, newest first, in plain language ("Merchant is exactly TEBEX.ORG, Swish received only"), each with a category picker (updates the rule; affects future imports) and Delete. Built-in rules for the country are read-only, grouped by category behind a disclosure, each merchant name shown once; rules for deleted categories are hidden.
- **Settings** (`#/settings`), in this order:
  - *Budget month*: start day 1–28 ("1 (calendar months)") and "move to the previous banking day", with a live preview ("This month would be December 2026: 25 Nov – 22 Dec").
  - *Backup*: "Download backup" saves `spendio-backup-YYYY-MM-DD.json` locally, with a note that it contains unencrypted bank data. "Restore from a backup file" validates the whole file first (invalid files are rejected with the reason, without asking), then shows what it contains and replaces everything only after "Replace my data".
  - *Imports*: past imports by bank and date with what they added; "Undo" (inline confirmation) removes the import's transactions, including categories chosen for them, while rules stay.
  - *File layouts*: layouts set up with the mapper (bank name, date set up) with "Forget" behind an inline confirmation; imported transactions stay, and the next file with that layout opens the mapper again.
  - *Delete all data*: two-step inline confirmation stating it can't be undone and pointing to the backup; afterwards the app starts over on "Add statement".
  - (Next) passcode.
  - No browser dialogs anywhere; hidden file inputs show their keyboard focus on their visible label.

### Visual design
- **Idea:** a bank export is a cramped wall of semicolons; Spendio is calm, airy and precise. The memorable element is the **amounts**: large tabular figures in Swedish format, currency lighter, right-aligned like a ledger. Everything else stays quiet.
- **Palette (from Swedish nature):** snow `#f7f9fa` background, granite `#22292f` text, pine `#1e5b4b` accent, lingon `#b3263e` only for warnings, lichen `#5b6a63` secondary text, frost `#dde3e1` dividers; a night-forest dark mode. Money in is pine with `+`; money out stays neutral (spending isn't an error). Every text/background pair meets WCAG AA.
- **Type:** Hanken Grotesk only, self-hosted (the CSP blocks font CDNs); its default figures are tabular.
- **Layout:** one left-aligned column (max 44rem), dividers only where they separate items, no card stacks, no all-caps labels. Responsive to 390 px, visible keyboard focus, reduced motion respected.
- **Charts:** follow the dataviz method — form first (comparing parts → ranked bars, one hue), plain HTML so labels are real text, direct value labels, hover *and* focus tooltips, no legend for a single series. Data marks use `--chart-mark` (`#008362` light / `#339e7c` dark): the pine accent itself is too dark and gray for a mark, so this is the pine hue re-stepped to pass the palette validator (OKLCH lightness band, chroma ≥ 0.10, ≥ 3:1 vs surface) in both modes. Meter tracks are the same hue at 15 %. Values below zero use `--chart-negative` (`#f28881` light / `#b54a46` dark): plain pine vs lingon **failed** the colorblind (CVD) check, so the red is re-stepped in lightness away from the pine until the pair passes in both modes; position below the baseline and the "−" label carry the meaning too. Column charts keep 20 px of room for value labels on each side of zero, share one scale above and below, and leave empty periods unlabelled.

## 13. Data model (TypeScript, core)

```ts
type Ore = number;           // integer minor units (öre for SEK)
type PeriodLabel = string;   // 'YYYY-MM'

interface Account      { id: string; bank: string; name: string }  // bank = format id, e.g. "nordea"; created on first import; no account numbers
interface ImportBatch  { id: string; accountId: string; label: string; importedAt: string;
                         rowCount: number; newCount: number; duplicateCount: number; errorCount: number }
interface Transaction  {
  id: string; accountId: string; importBatchId: string; fingerprint: string;
  bookingDate: string; purchaseDate?: string; effectiveDate: string;   // ISO dates
  amount: Ore; balance?: Ore; currency: 'SEK';
  description: string;                 // scrubbed Rubrik
  kind: 'card' | 'swish_out' | 'swish_in' | 'swish_refund' | 'autogiro' | 'deposit' | 'other';
  merchantKey: string; merchantDisplay: string; counterpartyIsPerson?: boolean;
  categoryId: string | null;           // null = Needs review
  categorySource: 'manual' | 'user_rule' | 'builtin_rule' | 'kind_default' | 'none';
  suggested: boolean;                  // shown in review even though categorized
}
interface Category     { id: string; name: string; color: string;
                         type: 'spending' | 'income' | 'transfer';
                         transferKind?: 'savings' | 'internal'; system: boolean }
interface Rule         { id: string; source: 'user' | 'builtin';
                         op: 'equals' | 'startsWith' | 'contains'; value: string;
                         kind?: Transaction['kind']; categoryId: string; createdAt: string }
interface Budget       { id: string; categoryId: string | null;   // null = overall
                         amount: Ore | null; effectiveFrom: PeriodLabel }
interface CsvMapping   { id: string; headerSignature: string; /* column + format choices */ }
interface Settings     { periodStartDay: number; adjustToBankingDay: boolean; schemaVersion: number }
```

Built-in rules ship in code (versioned), not in the database, so they can be improved in updates. User rules are stored.

## 14. Architecture

```
src/
  core/              pure TS, no React, no browser APIs, fully unit-tested (enforced by ESLint)
    formats/           bank formats; bank-neutral code reaches them only via index.ts
      types.ts           BankFormat interface, TransactionKind, Described
      index.ts           registry (BANK_FORMATS) + detectFormat
      nordea/            parse.ts (CSV), describe.ts (Rubrik → kind, dates), index.ts (NORDEA)
      generic.ts         a saved CsvMapping as a BankFormat (bank-neutral description reading)
    country/           country specifics; bank-neutral code reaches them only via index.ts
      types.ts           Country interface
      index.ts           registry (COUNTRIES), DEFAULT_COUNTRY, countryFor
      se/                Sweden: holidays.ts, personnummer.ts, builtin-rules.ts, business.ts, index.ts (SWEDEN)
    csv/               types.ts (ParsedRow, ParseResult), mapping.ts (CsvMapping), date-formats.ts, sniff.ts (detect + guess), generic.ts (parse with a mapping)
    money.ts           amount parsing (minor units) + formatting in the country's currency
    dates.ts           UTC calendar-date helpers
    merchant.ts        merchant name cleanup
    periods.ts         payday periods and labels (banking days from the country)
    dedup.ts           import fingerprints
    categories.ts      default + system categories
    rules.ts           rule matching + priority
    categorize.ts      user rules → country rules → kind defaults → Needs review
    budgets.ts         limits with effectiveFrom, status
    summary.ts         period aggregates (spent, income, left over, savings, needs review)
    import.ts          pure import pipeline, Transaction + ImportBatch types
    review.ts          groupForReview + ReviewDecision
    dashboard.ts       buildDashboard: budget rows, overall limit, change vs previous period
    period-nav.ts      which periods to offer and which to open on
    transaction-filter.ts  period / category / type / search filtering, newest first
    category-usage.ts  what depends on each category (for delete)
    history.ts         month-by-month spending vs each month's limit
    savings.ts         left over, savings rate and money moved per period, with window totals
    names.ts           tidy person names for display
    account.ts, settings.ts, backup.ts
  storage/           the ONLY module that touches IndexedDB (Dexie); passcode encryption (next) is added here
    db.ts              schema (v2: adds Swish from people to older databases) + first-run defaults
    store.ts           SpendioStore: the API the UI uses (atomic import, edits, rules, budgets, backup)
  ui/                React components (Amount, PeriodSwitcher, Headlines, BudgetList, SpendingChart, TransactionFilters, TransactionList, HistoryTable, ColumnChart, PeriodWindow (+ period-window.ts), CategoryEditor, CategoryLimit, DeleteCategory, RulesList, LimitForm, PeriodSettingsForm, BackupSection, ImportsSection, FileLayoutsSection, DeleteAllData, CsvMapper, download.ts, UploadScreen, ImportSummary, ReviewScreen, format.ts)
    App.tsx            shell + navigation; hash routes #/, #/transactions, #/history, #/savings, #/categories, #/add, #/settings, #/review with query params for page state (router.ts, no router library)
    pages/             OverviewPage, TransactionsPage, HistoryPage, SavingsPage, CategoriesPage, AddStatementPage, SettingsPage, ReviewPage
    StoreContext.tsx, useStore.ts   opens the store once and shares it
    dev/               dev-only previews (dropped from production builds)
.claude/skills/      project skills: frontend-design, webapp-testing (Anthropic, Apache-2.0)
fixtures/            synthetic CSVs only (fake names, no personnummer)
docker/              nginx.conf, security-headers.conf
Dockerfile, compose.yaml
```

### Stack
Vite + React + TypeScript · Tailwind CSS · Dexie (IndexedDB) · Papa Parse · Recharts · Hanken Grotesk via Fontsource (self-hosted) · Vitest, with fake-indexeddb for storage tests and Testing Library + jsdom for component tests (`*.test.tsx`, opted in per file). Keep dependencies minimal; add new ones only with a reason.

### Backup format
```json
{ "app": "spendio", "schemaVersion": 1, "exportedAt": "…", "data": { "accounts": [], "importBatches": [], "transactions": [], "categories": [], "rules": [], "budgets": [], "csvMappings": [], "settings": {} } }
```
v1: unencrypted, with an on-screen warning that it contains bank data. Import validates the schema and **replaces** all data after confirmation.

## 15. Security

- **No third-party scripts, fonts, analytics or CDNs.** Everything is self-hosted in the bundle.
- **CSP** (set by nginx in the image):
  `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`
  (`connect-src` gets widened only if/when the AI feature ships.)
- Other headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `Cross-Origin-Opener-Policy: same-origin`.
- All CSV content is untrusted: rendered only as text (React escaping, no `dangerouslySetInnerHTML`).
- Personnummer scrubbing (§4.3). Real statements are never committed: `.gitignore` blocks `*.csv` outside `fixtures/`.
- HTTPS is required in production (Web Crypto needs a secure context for the upcoming passcode encryption). It's handled by the hosting proxy, not the container.

## 16. Deployment

- **CI (GitHub Actions):** on every pull request and push to `main`, a **Checks** workflow (typecheck, lint, test — parallel jobs) and a **Build** workflow (`npm run build` and a `docker build` that is never pushed, so a broken Dockerfile or nginx config is caught before deploy). Node version from `.nvmrc`. Deploying stays with Woodpecker (below).
- **Releases:** every version gets an annotated git tag and a GitHub release, using semantic versioning (`vMAJOR.MINOR.PATCH`: features bump the minor, fixes the patch). The tag goes on `main` after the version's PR is merged, and `package.json` carries the same version. v1.0.0 was the first complete version.
- **Local:** `docker compose up` → `http://localhost:8080`.
- **Image:** multi-stage. `node:22-alpine` builds `dist/` → `nginx:alpine` serves it on **port 80**, with `docker/nginx.conf` providing the security headers and SPA fallback (`try_files $uri /index.html`). Same pattern as the MiranDinc project.
- **Production:** the author's brother's server (Woodpecker CI → registry → Helm on Kubernetes, Traefik TLS, Cloudflare tunnel). The **Woodpecker/deploy config will be written by the author together with their brother** and is not part of this spec.
- Note for the server owner: disable Cloudflare features that inject scripts (Web Analytics, Rocket Loader, Email Obfuscation) for this host; the CSP would block them anyway.

## 17. Build order

1. Scaffold: Vite/React/TS/Tailwind/Vitest, ESLint, Dockerfile + nginx.conf + compose.yaml, `.gitignore`, synthetic Nordea fixture
2. Core, test-first: money → Nordea parser + scrub → describe/merchant cleanup → holidays + periods → dedup → rules engine → budgets → summaries
3. Storage module (Dexie, schema v1)
4. Upload → import summary → review flow
5. Dashboard → Transactions → Categories & Rules → History → Savings → Settings (backup/wipe)
6. Generic CSV mapper

### Test fixture requirements (`fixtures/nordea-sample.csv`)
Synthetic data in exact Nordea format: BOM, trailing `;`, decimal commas, `YYYY/MM/DD`, fake names, **no personnummer** (use obviously fake placeholders in `Avsändare`/`Mottagare` to test that they're dropped). Must include: two identical card rows on the same day (distinguished by balance), a purchase booked in the next period, Lysa out and back in, Studiestöd, Swish out/in/refund to people and businesses, processor-prefixed and truncated merchant names, and a December row near the 23rd.

## 18. Open items
- Verify against more Nordea exports (older/different header variants).
- Deploy pipeline (author + brother).
- Final built-in rule list: grow it from real usage.
- AI categorization model (BYOK vs hosted): decide before the "Later" phase.
