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

## 3. Scope

### v1
- Nordea CSV import (preset) + generic CSV column mapper (saved per file layout)
- Duplicate-safe re-imports, import summary, undo an import batch
- Rules-based categorization (built-in Swedish rules + rules learned from user corrections)
- Post-upload review, grouped by merchant
- Editable flat categories + system types (Income, Transfer)
- Payday-based periods (25th, adjusted to the previous Swedish banking day)
- Budgets: per-category and overall monthly limits
- Dashboard, Transactions, History, Savings, Categories & Rules, Settings
- JSON backup export/import, wipe all data
- Responsive (phone width), light/dark mode following system

### v1.1
- Optional passcode: encrypts all stored data (Web Crypto, PBKDF2 → AES-GCM), unlock screen, auto-lock, change passcode
- Encrypted backups using the same passcode

### Later (not designed in detail; keep the door open)
- Optional AI categorization for leftover transactions (bring-your-own-key, or hosted; undecided). Only cleaned merchant names would be sent, never amounts or account data, and only with explicit opt-in.
- Optional accounts + sync across devices (backend)
- Multiple accounts (e.g. savings, credit card), multi-currency
- More bank presets, PDF statements
- Split transactions, budget rollover, per-month limit overrides
- Swedish UI language
- Backup *merge* (v1 backup import replaces everything)

### Explicitly out of scope for v1
Server-side storage, user accounts, AI, PDF parsing, multiple accounts, multiple currencies, split transactions, rollover.

## 4. Data input

### 4.1 Nordea CSV format (observed in a real export, 2026-11-16)

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
| Filename | Contains the personnummer → never stored; batches are labelled `Nordea · <import date>` |

Detection: header row (after stripping the BOM) matches the Nordea column set.

Nordea has changed its export format before. If an export doesn't match, fall back to the generic mapper and add a new preset.

### 4.2 Generic CSV mapper
For non-preset files: the user maps columns → `date`, `amount` (or `debit` + `credit`), `description`, optional `balance`, and picks the date format, decimal separator and delimiter (auto-detected where possible). The mapping is saved, keyed by the header row, so the next import of the same layout is one click.

### 4.3 Personnummer scrubbing
- Nordea parser drops `Avsändare` and `Mottagare` entirely.
- Defense in depth: every text field is scrubbed for personnummer patterns (`YYMMDD-XXXX`, `YYMMDD+XXXX`, `YYYYMMDD-XXXX`, and 10/12-digit runs that form a valid date + Luhn check) before it enters the model. Matches are replaced with `[redacted]`.
- Applies to the generic mapper too.

### 4.4 Amounts
Stored as **integer öre** (`-129,00` → `-12900`) to avoid floating-point errors. Displayed in Swedish format: `1 234,56 kr`.

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

Flat, user-editable (rename, add, delete, color). Deleting a category requires choosing where its transactions and rules move.

Each category has a `type`:
- `spending`: counts toward spending totals and budgets
- `income`: system category **Income**, cannot be deleted
- `transfer`: system category **Transfer**, with `transferKind`: `savings` or `internal`; cannot be deleted. Never counts as spending or income.

**Default spending categories:** Groceries · Restaurants & Cafés · Transport · Shopping · Subscriptions · Gaming · Entertainment · Health & Fitness · Housing & Bills · Travel · Swish to people · Other

**System:** Income · Transfer: Savings · Transfer: Internal

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

Within a tier, the most specific match wins: `equals` > `startsWith` > `contains`, then the longest pattern, then the newest rule.

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
| `swish_in` from a person | **Needs review** |
| `swish_refund` | Category of the counterparty's rule, else Needs review |
| everything else unmatched | Needs review |

### 7.5 Learning from corrections
- In review: category per merchant group + **"Remember for future imports"** (checked by default; **unchecked by default for Swish to or from people**). Remember = create a user `equals` rule on `merchantKey` (+ `kind` for Swish).
- Editing a single transaction later offers **"Only this one"** or **"This and future ones from <merchant>"**, plus an option to apply to past uncategorized/rule-assigned transactions from that merchant. Manual assignments are never touched.

## 8. Import pipeline

1. Read file → detect preset (Nordea) or open the generic mapper.
2. Parse rows → scrub personnummer → parse amounts (öre), dates, `Rubrik`.
3. **Dedup** (below).
4. Categorize new rows.
5. Save as one **ImportBatch**.
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

## 12. Screens

### Dashboard (selected period)
1. Period switcher `‹ November | December | January ›` with date range
2. Headline numbers: **Spent** (with % change vs previous period) · **Budget left** (overall limit − spent; red if over) · **Left over**
3. **Budget list**: budgeted categories sorted Over → Close → On track (then by ratio), progress bar, `spent / limit`, status; unbudgeted categories below without bars
4. **Spending by category**: horizontal bar chart
5. **Needs review** badge (only when > 0)

Clicking a category anywhere → Transactions filtered by that category and period.

### Other pages
- **Upload** → import summary → **Review** (grouped by merchant, sorted by absolute total, category dropdown + "Remember" checkbox, "Skip, I'll do it later")
- **Transactions**: search, filter (period, category, kind, needs review), inline category edit
- **History**: per budgeted category, month-by-month spending vs that month's limit
- **Savings**: Left over, savings rate, Moved to savings, month-by-month chart
- **Categories & Rules**: edit categories, colors and limits; list/delete user rules; view built-in rules
- **Settings**: period start day, export/import backup, wipe all data, (v1.1) passcode

## 13. Data model (TypeScript, core)

```ts
type Ore = number;           // integer öre
type PeriodLabel = string;   // 'YYYY-MM'

interface Account      { id: string; bank: 'nordea' | 'generic'; name: string }  // no account numbers
interface ImportBatch  { id: string; accountId: string; label: string; importedAt: string;
                         rowCount: number; newCount: number; duplicateCount: number }
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
  core/        pure TS, no React, no browser APIs, fully unit-tested
    csv/         nordea.ts, generic.ts, detect.ts
    scrub.ts     personnummer detection/redaction
    describe.ts  Rubrik → kind, purchaseDate, merchant
    money.ts     öre parsing/formatting
    holidays.ts  Swedish banking days
    periods.ts   payday periods
    dedup.ts
    rules.ts     builtin rules + matching engine
    budgets.ts   limits, status
    summary.ts   period aggregates (spent, income, left over, savings)
  storage/     the ONLY module that touches IndexedDB (Dexie); encryption is added here in v1.1
  ui/          React pages + components
fixtures/      synthetic CSVs only (fake names, no personnummer)
docker/        nginx.conf
Dockerfile, compose.yaml
```

### Stack
Vite + React + TypeScript · Tailwind CSS · Dexie (IndexedDB) · Papa Parse · Recharts · Vitest. Keep dependencies minimal; add new ones only with a reason.

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
- HTTPS is required in production (Web Crypto needs a secure context for v1.1). It's handled by the hosting proxy, not the container.

## 16. Deployment

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
