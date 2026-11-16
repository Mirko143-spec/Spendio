import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseNordeaCsv } from './csv/nordea.ts';
import { describeTransaction } from './describe.ts';
import { cleanMerchant, looksLikeBusiness } from './merchant.ts';

describe('cleanMerchant', () => {
  it.each([
    // trailing digits / store numbers
    ['ROBLOX.COM 188885825', 'ROBLOX.COM'],
    ['Espresso House 398', 'Espresso House'],
    ['Pressbyran 4208856', 'Pressbyran'],
    // reference codes
    ['Spotify P4938CFA38', 'Spotify'],
    ['Reklamfritt *BB4SS7W', 'Reklamfritt'],
    ['UBER *EATS', 'UBER EATS'], // letter-only star suffix is part of the name
    // processor prefixes
    ['NMB*Nybergs Konditor', 'Nybergs Konditor'],
    ['WL *STEAM PURCHASE', 'STEAM PURCHASE'],
    ['PAYPAL_*JONKOPING FR', 'JONKOPING FR'],
    ['PAYPAL *EXEMPELSHOP', 'EXEMPELSHOP'],
    ['SumUp  *Kafé Exempel', 'Kafé Exempel'],
    ['IZ *Food Truck 22', 'Food Truck'],
    // stray stars inside real names
    ['ANTHROPIC* CLAUDE SU', 'ANTHROPIC CLAUDE SU'],
    ['PONG NYBRO* LOCO @ P', 'PONG NYBRO LOCO @ P'],
    // things that must survive
    ['ST1 E4 SODER', 'ST1 E4 SODER'],
    ['KjellCo Skarholmen', 'KjellCo Skarholmen'],
    ['Netflix.com', 'Netflix.com'],
    ['SJ.SE', 'SJ.SE'],
    ['7-Eleven 1234', '7-Eleven'],
    ['1177', '1177'],
    ['  ICA   NARA  VARBY GARD ', 'ICA NARA VARBY GARD'],
  ])('%s → %s', (input, display) => {
    expect(cleanMerchant(input).display).toBe(display);
  });

  it('uppercases the key with Swedish letters intact', () => {
    expect(cleanMerchant('Hemköp Exempel 12')).toEqual({ key: 'HEMKÖP EXEMPEL', display: 'Hemköp Exempel' });
  });

  it('gives the same key to the same merchant with different store/reference numbers', () => {
    expect(cleanMerchant('ROBLOX.COM 188885825').key).toBe(cleanMerchant('roblox.com 202233').key);
  });

  it('strips several trailing noise tokens', () => {
    expect(cleanMerchant('Exempel Shop 12 9988776').display).toBe('Exempel Shop');
  });
});

describe('looksLikeBusiness', () => {
  it.each(['EXEMPELBUTIKEN AB', 'AB STORSTOCKHOLMS L', 'STIFTELSEN EXEMPELHUSET', 'Exempel Handelsbolag HB'])(
    '%s is a business',
    (name) => {
    expect(looksLikeBusiness(name)).toBe(true);
  });

  it.each(['ANNA TESTSSON', 'DOE,JOHN', 'Abbe Testsson', 'KBARNA EXEMPEL', 'Idrottsföreningen Exempel'])(
    '%s is not flagged (no whole-word marker)',
    (name) => {
      expect(looksLikeBusiness(name)).toBe(false);
    },
  );
});

describe('cleanMerchant on the fixture', () => {
  const fixture = readFileSync(join(import.meta.dirname, '../../fixtures/nordea-sample.csv'), 'utf8');
  const merchants = parseNordeaCsv(fixture).rows
    .map((r) => describeTransaction(r.description, r.bookingDate))
    .filter((d) => d.kind === 'card')
    .map((d) => cleanMerchant(d.counterparty).display);

  it('produces clean names for every card purchase', () => {
    expect([...new Set(merchants)].sort()).toEqual([
      'COOP EXEMPELSTAD',
      'Espresso House',
      'EXEMPELSHOP',
      'Exempel Konditori',
      'ICA NARA EXEMPEL',
      'ICA SUPERMARKET TESTBY',
      'Netflix.com',
      'PARKSTER SWE',
      'Pressbyran',
      'ROBLOX.COM',
      'SJ.SE',
      'SOSTRENE GRENE DROTT',
      'Spotify',
      'STEAM PURCHASE',
    ].sort());
  });
});
