import { describe, expect, expectTypeOf, it } from 'vitest';
import fc from 'fast-check';
import {
  MAX_REMEMBERED_COLUMNS,
  MAX_REMEMBERED_HEADER_LENGTH,
  nextImportMemory,
  rememberedImport,
  type ImportChoices,
} from './importMemory';
import type { ColumnRole, ImportMemory } from './csv';
// What the server accepts and stores for an account
import {
  IMPORT_COLUMN_ROLES,
  MAX_IMPORT_COLUMNS,
  MAX_IMPORT_HEADER_LENGTH,
  importSettingsSchema,
} from '../../../server/src/utils/importSettings';

const role = fc.constantFrom(...IMPORT_COLUMN_ROLES);
const accountId = fc.constantFrom('a1', 'a2', 'a3', 'gone');
const accountIds = new Set(['a1', 'a2', 'a3']);

const memory: fc.Arbitrary<ImportMemory> = fc.integer({ min: 0, max: 8 }).chain((n) =>
  fc.record(
    {
      dateOrder: fc.constantFrom('day-first' as const, 'month-first' as const),
      decimal: fc.constantFrom('comma' as const, 'point' as const),
      columns: fc.record({
        headers: fc.array(fc.string({ maxLength: 30 }), { minLength: n, maxLength: n }),
        roles: fc.array(role, { minLength: n, maxLength: n }),
      }),
      chargesPositive: fc.boolean(),
      otherAccountId: fc.option(accountId),
    },
    { requiredKeys: ['dateOrder', 'decimal'] },
  ),
);

const choices: fc.Arbitrary<ImportChoices> = fc.integer({ min: 0, max: 8 }).chain((n) =>
  fc.record({
    conventions: fc.record({
      dateOrder: fc.constantFrom('day-first' as const, 'month-first' as const),
      decimal: fc.constantFrom('comma' as const, 'point' as const),
    }),
    headers: fc.array(fc.string({ maxLength: 30 }), { minLength: n, maxLength: n }),
    roles: fc.array(role, { minLength: n, maxLength: n }),
    chargesPositive: fc.option(fc.boolean(), { nil: undefined }),
    otherAccountId: fc.option(fc.option(accountId), { nil: undefined }),
  }),
);

describe('the server and the dialog agree', () => {
  it('on the column roles and the limits', () => {
    expectTypeOf<(typeof IMPORT_COLUMN_ROLES)[number]>().toEqualTypeOf<ColumnRole>();
    expect(MAX_REMEMBERED_COLUMNS).toBe(MAX_IMPORT_COLUMNS);
    expect(MAX_REMEMBERED_HEADER_LENGTH).toBe(MAX_IMPORT_HEADER_LENGTH);
  });

  it('the server accepts everything the dialog saves (property-based)', () => {
    fc.assert(
      fc.property(fc.option(memory, { nil: undefined }), choices, (previous, used) => {
        const saved = nextImportMemory(previous, used);
        expect(importSettingsSchema.parse(saved)).toEqual(saved);
      }),
    );
  });
});

describe('rememberedImport', () => {
  it("uses the server's settings over this device's (property-based)", () => {
    fc.assert(
      fc.property(memory, fc.option(memory, { nil: undefined }), (saved, onDevice) => {
        const used = rememberedImport(saved, onDevice, accountIds);
        expect(used?.dateOrder).toBe(saved.dateOrder);
        expect(used?.columns).toEqual(saved.columns);
      }),
    );
  });

  it("falls back to this device's when the server has none or can't be asked", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(null, undefined),
        fc.option(memory, { nil: undefined }),
        (saved, onDevice) => {
          const used = rememberedImport(saved, onDevice, accountIds);
          if (!onDevice) expect(used).toBeUndefined();
          else expect(used?.decimal).toBe(onDevice.decimal);
        },
      ),
    );
  });

  it('forgets an account for the other currency that no longer exists, and nothing else', () => {
    fc.assert(
      fc.property(memory, (m) => {
        const used = rememberedImport(m, undefined, accountIds)!;
        if (m.otherAccountId === 'gone') {
          expect(used).not.toHaveProperty('otherAccountId');
          const { otherAccountId: _, ...rest } = m;
          expect(used).toEqual(rest);
        } else {
          expect(used).toEqual(m);
        }
      }),
    );
  });
});

describe('nextImportMemory', () => {
  it('remembers the choices the import used', () => {
    fc.assert(
      fc.property(fc.option(memory, { nil: undefined }), choices, (previous, used) => {
        const next = nextImportMemory(previous, used);
        expect({ dateOrder: next.dateOrder, decimal: next.decimal }).toEqual(used.conventions);
        expect(next.columns).toEqual({ headers: used.headers, roles: used.roles });
        expect(next.chargesPositive).toBe(used.chargesPositive ?? previous?.chargesPositive);
        // null ("not imported") is a choice too, and is kept
        expect(next.otherAccountId).toBe(
          used.otherAccountId !== undefined ? used.otherAccountId : previous?.otherAccountId,
        );
      }),
    );
  });

  it("carries this device's old settings over to the server on the next import", () => {
    const onDevice: ImportMemory = {
      dateOrder: 'day-first',
      decimal: 'comma',
      chargesPositive: true,
      otherAccountId: 'a2',
    };
    const opened = rememberedImport(null, onDevice, accountIds);
    // A file with no signed amounts and no dollars: the card choices stay as they were
    const next = nextImportMemory(opened, {
      conventions: { dateOrder: 'day-first', decimal: 'comma' },
      headers: ['Fecha', 'Débito', 'Crédito'],
      roles: ['date', 'outflow', 'inflow'],
    });
    expect(next).toEqual({
      ...onDevice,
      columns: { headers: ['Fecha', 'Débito', 'Crédito'], roles: ['date', 'outflow', 'inflow'] },
    });
  });

  it('leaves out a header line too long for the server, but keeps the rest', () => {
    const wide = Array.from({ length: MAX_REMEMBERED_COLUMNS + 1 }, (_, i) => `c${i}`);
    const long = ['x'.repeat(MAX_REMEMBERED_HEADER_LENGTH + 1)];
    for (const headers of [wide, long]) {
      const next = nextImportMemory(undefined, {
        conventions: { dateOrder: 'month-first', decimal: 'point' },
        headers,
        roles: headers.map((): ColumnRole => 'skip'),
        chargesPositive: false,
      });
      expect(next).toEqual({ dateOrder: 'month-first', decimal: 'point', chargesPositive: false });
    }
  });
});
