import { CATEGORY_IDS } from './categories.ts';
import type { MatchOp, Rule } from './rules.ts';

/**
 * Built-in merchant rules for Sweden (docs/SPEC.md §7.3). Shipped in code, not stored, so
 * they can be improved in updates. User rules always take priority over these.
 *
 * Values match the cleaned, uppercased merchant key. Short or generic words use `equals` or
 * `startsWith` to avoid false hits (e.g. "MAX " must not match "MAXI ICA").
 */

type Seed = [MatchOp, string];

const SEEDS: Record<string, Seed[]> = {
  [CATEGORY_IDS.groceries]: [
    ['startsWith', 'ICA'], ['startsWith', 'MAXI ICA'], ['startsWith', 'COOP'], ['startsWith', 'WILLYS'],
    ['startsWith', 'HEMKÖP'], ['startsWith', 'HEMKOP'], ['startsWith', 'LIDL'], ['startsWith', 'CITY GROSS'],
    ['startsWith', 'MATHEM'], ['startsWith', 'TEMPO'],
  ],
  [CATEGORY_IDS.restaurants]: [
    ['startsWith', 'ESPRESSO HOUSE'], ['startsWith', 'PRESSBYRAN'], ['startsWith', 'PRESSBYRÅN'],
    ['equals', 'MAX'], ['startsWith', 'MAX '], ['startsWith', 'MCDONALDS'], ['startsWith', 'BURGER KING'],
    ['startsWith', 'UBER EATS'], ['startsWith', 'FOODORA'], ['startsWith', 'WOLT'],
    ['contains', 'PIZZERIA'], ['contains', 'SUSHI'], ['contains', 'KONDITOR'], ['contains', 'RESTAURANG'],
    ['contains', 'CAFE'], ['contains', 'KAFÉ'], ['contains', 'THAI'],
  ],
  [CATEGORY_IDS.transport]: [
    ['equals', 'SL'], ['startsWith', 'SL '], ['startsWith', 'AB STORSTOCKHOLMS L'], ['equals', 'SJ.SE'],
    ['startsWith', 'SJ '], ['startsWith', 'VÄSTTRAFIK'], ['startsWith', 'SKÅNETRAFIKEN'],
    ['startsWith', 'PARKSTER'], ['startsWith', 'EASYPARK'], ['startsWith', 'ST1'], ['startsWith', 'CIRCLE K'],
    ['startsWith', 'PREEM'], ['startsWith', 'OKQ8'], ['startsWith', 'UBER'], ['startsWith', 'BOLT'],
    ['equals', 'VOI'], ['startsWith', 'VOI '],
  ],
  [CATEGORY_IDS.subscriptions]: [
    ['startsWith', 'SPOTIFY'], ['startsWith', 'NETFLIX'], ['startsWith', 'DISNEY PLUS'], ['startsWith', 'DISNEY+'],
    ['startsWith', 'AMAZON PRIME'], ['startsWith', 'HBO'], ['startsWith', 'VIAPLAY'], ['startsWith', 'ANTHROPIC'],
    ['startsWith', 'OPENAI'], ['startsWith', 'YOUTUBE'], ['startsWith', 'APPLE.COM/BILL'],
  ],
  [CATEGORY_IDS.gaming]: [
    ['contains', 'STEAM'], ['startsWith', 'ROBLOX'], ['startsWith', 'TEBEX'], ['startsWith', 'PLAYSTATION'],
    ['startsWith', 'XBOX'], ['startsWith', 'NINTENDO'], ['startsWith', 'EPIC GAMES'],
  ],
  [CATEGORY_IDS.shopping]: [
    ['startsWith', 'ÅHLENS'], ['startsWith', 'AHLENS'], ['startsWith', 'LAGERHAUS'], ['startsWith', 'SØSTRENE GRENE'],
    ['startsWith', 'SOSTRENE GRENE'], ['startsWith', 'KJELLCO'], ['startsWith', 'KJELL & CO'],
    ['startsWith', 'CLAS OHLSON'], ['startsWith', 'H&M'], ['startsWith', 'IKEA'], ['equals', 'INET AB'],
    ['startsWith', 'INET '], ['startsWith', 'ELGIGANTEN'], ['startsWith', 'GLITTER'], ['startsWith', 'AMAZON'],
  ],
  [CATEGORY_IDS.health]: [
    ['contains', 'APOTEK'], ['startsWith', 'NORDICWELL'], ['startsWith', 'SATS'], ['startsWith', 'FRISKIS'],
  ],
  [CATEGORY_IDS.housing]: [
    ['startsWith', 'TELIA'], ['startsWith', 'TELE2'], ['startsWith', 'COMVIQ'], ['startsWith', 'HALLON'],
    ['startsWith', 'VATTENFALL'], ['startsWith', 'ELLEVIO'], ['startsWith', 'FORTUM'], ['startsWith', 'BAHNHOF'],
  ],
  [CATEGORY_IDS.travel]: [
    ['startsWith', 'SAS '], ['startsWith', 'NORWEGIAN'], ['startsWith', 'RYANAIR'], ['startsWith', 'BOOKING.COM'],
    ['startsWith', 'AIRBNB'],
  ],
  [CATEGORY_IDS.entertainment]: [
    ['startsWith', 'FILMSTADEN'], ['startsWith', 'SF BIO'], ['startsWith', 'TICKETMASTER'], ['startsWith', 'TICKSTER'],
  ],
  [CATEGORY_IDS.savings]: [['startsWith', 'LYSA']],
  [CATEGORY_IDS.income]: [['equals', 'STUDIESTÖD'], ['equals', 'STUDIESTOD'], ['startsWith', 'LÖN']],
};

const BUILTIN_CREATED_AT = '2026-01-01T00:00:00.000Z';

export const BUILTIN_RULES: readonly Rule[] = Object.entries(SEEDS).flatMap(([categoryId, seeds]) =>
  seeds.map(([op, value]): Rule => ({
    id: `builtin:${categoryId}:${op}:${value}`,
    source: 'builtin',
    op,
    value,
    categoryId,
    createdAt: BUILTIN_CREATED_AT,
  })),
);
