import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  ACTION_TYPES,
  CONDITION_FIELDS,
  actionText,
  conditionText,
  isConditionComplete,
  makeAction,
  makeCondition,
  ruleCurrency,
  ruleSearchText,
  type RuleLookups,
} from './ruleFormat';
import type { RuleAction, RuleCondition } from '../types';
import { setLanguage } from '../i18n';

const lookups: RuleLookups = {
  payee: (id) => (id === 'p1' ? 'Starbucks' : undefined),
  account: (id) => (id === 'a1' ? 'Checking' : undefined),
  category: (id) => (id === 'c1' ? 'Coffee' : undefined),
};

const arbFieldOp = fc
  .constantFrom(...CONDITION_FIELDS)
  .chain((f) => fc.constantFrom(...f.ops).map((op) => ({ field: f.value, op })));

/** A sequence of field/operator changes, like a user clicking through the editor */
const arbEdits = fc.array(arbFieldOp, { minLength: 1, maxLength: 6 });

/** The value shape the server's schema expects for a condition */
function hasValidShape(c: RuleCondition): boolean {
  if (c.op === 'is_empty' || c.op === 'is_not_empty') return !('value' in c);
  if (!('value' in c)) return false;
  const v = c.value;
  if (c.op === 'one_of' || c.op === 'not_one_of')
    return Array.isArray(v) && v.every((x) => typeof x === 'string');
  if (c.field === 'amount') {
    return c.op === 'between'
      ? Array.isArray(v) && v.length === 2 && v.every((x) => typeof x === 'number')
      : typeof v === 'number';
  }
  if (c.field === 'date') {
    const isDate = (x: unknown) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x);
    return c.op === 'between' ? Array.isArray(v) && v.length === 2 && v.every(isDate) : isDate(v);
  }
  if (c.field === 'direction') return v === 'inflow' || v === 'outflow';
  if (c.field === 'currency') return v === 'UYU' || v === 'USD';
  return typeof v === 'string';
}

describe('rule editor helpers (property-based)', () => {
  it('always build a condition the server accepts the shape of, whatever the user switches between', () => {
    fc.assert(
      fc.property(arbEdits, (edits) => {
        let c: RuleCondition | undefined;
        for (const { field, op } of edits) {
          c = makeCondition(field, op, c);
          expect(c.field).toBe(field);
          expect(c.op).toBe(op);
          expect(hasValidShape(c), JSON.stringify(c)).toBe(true);
        }
      }),
    );
  });

  it('keeps typed text when switching between text operators and text fields', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 10 }).filter((s) => s.trim() !== ''),
        fc.constantFrom('payee_name', 'imported_payee', 'notes'),
        fc.constantFrom('is', 'contains', 'starts_with', 'ends_with', 'regex'),
        (text, field, op) => {
          const from: RuleCondition = { field: 'payee_name', op: 'contains', value: text };
          const to = makeCondition(field, op, from);
          expect('value' in to && to.value).toBe(text);
          expect(makeCondition(field, 'one_of', from)).toMatchObject({ value: [text] });
        },
      ),
    );
  });

  it('starts text, payee, account and category values empty (incomplete), and amounts, dates and inflow/outflow filled in', () => {
    fc.assert(
      fc.property(arbFieldOp, ({ field, op }) => {
        const c = makeCondition(field, op);
        const prefilled =
          field === 'amount' ||
          field === 'date' ||
          field === 'direction' ||
          field === 'currency' ||
          !('value' in c);
        expect(isConditionComplete(c)).toBe(prefilled);
      }),
    );
  });

  it('describes every condition and action without throwing, including deleted payees and categories', () => {
    fc.assert(
      fc.property(arbEdits, fc.constantFrom('p1', 'gone', 'c1', 'a1'), (edits, id) => {
        let c: RuleCondition | undefined;
        for (const { field, op } of edits) {
          c = makeCondition(field, op, c);
          if (
            'value' in c &&
            typeof c.value === 'string' &&
            c.field !== 'date' &&
            c.field !== 'direction' &&
            c.field !== 'currency'
          ) {
            c = { ...c, value: id } as RuleCondition;
          }
          expect(conditionText(c, lookups).length).toBeGreaterThan(0);
        }
      }),
    );
    for (const value of ACTION_TYPES) {
      const a = makeAction(value);
      const withTarget = (
        a.type === 'set_category' || a.type === 'set_payee' ? { ...a, value: 'gone' } : a
      ) as RuleAction;
      expect(actionText(withTarget, lookups)).toMatch(/\S/);
    }
  });
});

describe('rules and currencies', () => {
  const pesos: RuleCondition = { field: 'currency', op: 'is', value: 'UYU' };
  const dollars: RuleCondition = { field: 'currency', op: 'is', value: 'USD' };
  const over100: RuleCondition = { field: 'amount', op: 'gt', value: 100_00 };
  const starbucks: RuleCondition = { field: 'payee_name', op: 'contains', value: 'starbucks' };
  const arbOther: fc.Arbitrary<RuleCondition> = fc.constantFrom<RuleCondition>(
    over100,
    starbucks,
    { field: 'direction', op: 'is', value: 'outflow' },
    { field: 'amount', op: 'between', value: [1_00, 5_00] },
  );

  it('describes the currency condition in plain words', () => {
    expect(conditionText(pesos, lookups)).toBe('Is in pesos');
    expect(conditionText(dollars, lookups)).toBe('Is in dollars');
  });

  it('a rule needing every condition is limited to the currency it names, wherever the condition sits', () => {
    fc.assert(
      fc.property(
        fc.array(arbOther, { maxLength: 3 }),
        fc.array(arbOther, { maxLength: 3 }),
        fc.constantFrom(pesos, dollars),
        (before, after, currency) => {
          const conditions = [...before, currency, ...after];
          expect(ruleCurrency({ conditionsOp: 'and', conditions })).toBe(
            'value' in currency ? currency.value : null,
          );
        },
      ),
    );
  });

  it('a rule with no currency condition is not limited to one', () => {
    fc.assert(
      fc.property(
        fc.array(arbOther, { maxLength: 4 }),
        fc.constantFrom('and', 'or'),
        (conditions, conditionsOp) => {
          expect(ruleCurrency({ conditionsOp, conditions })).toBeNull();
        },
      ),
    );
  });

  it('a rule needing any condition is not limited by a currency condition next to another one', () => {
    fc.assert(
      fc.property(
        fc.array(arbOther, { minLength: 1, maxLength: 3 }),
        fc.constantFrom(pesos, dollars),
        (others, currency) => {
          expect(
            ruleCurrency({ conditionsOp: 'or', conditions: [currency, ...others] }),
          ).toBeNull();
        },
      ),
    );
    // On its own it is the whole rule
    expect(ruleCurrency({ conditionsOp: 'or', conditions: [dollars] })).toBe('USD');
    expect(ruleCurrency({ conditionsOp: 'or', conditions: [pesos, dollars] })).toBeNull();
  });

  it('a rule asking for both currencies at once is limited to neither', () => {
    expect(ruleCurrency({ conditionsOp: 'and', conditions: [pesos, dollars] })).toBeNull();
  });

  it("writes amounts with the sign of the rule's currency", () => {
    expect(conditionText(over100, lookups, 'USD')).toBe('Amount is more than US$100');
    expect(conditionText(over100, lookups, 'UYU')).toBe('Amount is more than $100');
    expect(conditionText(over100, lookups)).toBe('Amount is more than $100');
    expect(
      conditionText({ field: 'amount', op: 'between', value: [1_50, 20_00] }, lookups, 'USD'),
    ).toBe('Amount is between US$1.50 and US$20');

    const split: RuleAction = {
      type: 'split',
      parts: [
        { kind: 'fixed', value: 25_00, categoryId: 'c1', notes: null },
        { kind: 'remainder', value: 0, categoryId: null, notes: null },
      ],
    };
    expect(actionText(split, lookups, 'USD')).toBe(
      'Split: US$25 to Coffee, the rest to uncategorized',
    );
    expect(actionText(split, lookups)).toBe('Split: $25 to Coffee, the rest to uncategorized');
  });

  it('finds a rule by its currency and by the amount as it is written', () => {
    const rule = {
      id: 'r1',
      conditionsOp: 'and' as const,
      conditions: [over100, dollars],
      actions: [{ type: 'set_category' as const, value: 'c1' }],
      enabled: true,
      sortOrder: 0,
      createdAt: '',
    };
    const text = ruleSearchText(rule, lookups);
    expect(text).toContain('us$100');
    expect(text).toContain('in dollars');
  });
});

describe('rule summaries in English', () => {
  it('reads as a sentence for each kind of field', () => {
    const cases: Array<[RuleCondition, string]> = [
      [{ field: 'payee', op: 'is', value: 'p1' }, 'Payee is Starbucks'],
      [{ field: 'payee', op: 'is_empty' }, 'Payee is empty'],
      [
        { field: 'payee', op: 'one_of', value: ['p1', 'gone'] },
        'Payee is one of Starbucks, (deleted)',
      ],
      [{ field: 'payee_name', op: 'not_contains', value: 'x' }, 'Payee name doesn\'t contain "x"'],
      [
        { field: 'imported_payee', op: 'regex', value: '^amzn' },
        'Imported description matches regex /^amzn/',
      ],
      [{ field: 'notes', op: 'is_not_empty' }, 'Notes is not empty'],
      [{ field: 'category', op: 'is_empty' }, 'Category is uncategorized'],
      [{ field: 'category', op: 'is_not_empty' }, 'Category is categorized'],
      [{ field: 'account', op: 'is_not', value: 'a1' }, 'Account is not Checking'],
      [{ field: 'amount', op: 'approx', value: 12_00 }, 'Amount is about $12'],
      [{ field: 'direction', op: 'is', value: 'inflow' }, 'Is an inflow'],
      [{ field: 'date', op: 'is', value: '2026-10-05' }, 'Date is on Oct 5, 2026'],
      [
        { field: 'date', op: 'between', value: ['2026-01-01', '2026-03-31'] },
        'Date is between Jan 1, 2026 and Mar 31, 2026',
      ],
    ];
    for (const [condition, sentence] of cases) {
      expect(conditionText(condition, lookups)).toBe(sentence);
    }
  });

  it('describes each action', () => {
    expect(actionText({ type: 'set_category', value: 'c1' }, lookups)).toBe(
      'Set category to Coffee',
    );
    expect(actionText({ type: 'set_payee', value: 'gone' }, lookups)).toBe(
      'Rename payee to (deleted)',
    );
    expect(actionText({ type: 'set_notes', value: '' }, lookups)).toBe('Clear notes');
    expect(actionText({ type: 'set_notes', value: 'work' }, lookups)).toBe('Set notes to "work"');
    expect(actionText({ type: 'prepend_notes', value: '#biz ' }, lookups)).toBe(
      'Add "#biz " before notes',
    );
    expect(actionText({ type: 'append_notes', value: ' ok' }, lookups)).toBe(
      'Add " ok" after notes',
    );
  });
});

describe('rule summaries in Spanish', () => {
  it('reads as a Spanish sentence, with the article and gender each field needs', () => {
    setLanguage('es');
    const cases: Array<[RuleCondition, string]> = [
      [{ field: 'payee', op: 'is', value: 'p1' }, 'El beneficiario es Starbucks'],
      [{ field: 'payee', op: 'is_empty' }, 'No tiene beneficiario'],
      [
        { field: 'payee', op: 'not_one_of', value: ['p1', 'gone'] },
        'El beneficiario no es ninguno de: Starbucks, (eliminado)',
      ],
      [
        { field: 'payee_name', op: 'contains', value: 'netflix' },
        'El nombre del beneficiario contiene "netflix"',
      ],
      [{ field: 'imported_payee', op: 'is_empty' }, 'La descripción importada está vacía'],
      [
        { field: 'imported_payee', op: 'regex', value: '^amzn' },
        'La descripción importada coincide con la expresión regular /^amzn/',
      ],
      [{ field: 'notes', op: 'starts_with', value: 'a' }, 'Las notas empiezan con "a"'],
      [{ field: 'notes', op: 'is_empty' }, 'Las notas están vacías'],
      [{ field: 'category', op: 'is', value: 'gone' }, 'La categoría es (eliminada)'],
      [{ field: 'category', op: 'one_of', value: ['c1'] }, 'La categoría es una de: Coffee'],
      [{ field: 'category', op: 'is_empty' }, 'No tiene categoría'],
      [{ field: 'account', op: 'is_not', value: 'a1' }, 'La cuenta no es Checking'],
      [{ field: 'amount', op: 'gte', value: 50_00 }, 'El monto es de al menos $50'],
      [{ field: 'amount', op: 'approx', value: 12_00 }, 'El monto es de aproximadamente $12'],
      [{ field: 'direction', op: 'is', value: 'outflow' }, 'Es una salida'],
      [{ field: 'currency', op: 'is', value: 'USD' }, 'Está en dólares'],
      [{ field: 'date', op: 'is', value: '2026-10-05' }, 'La fecha es el 5 oct 2026'],
      [{ field: 'date', op: 'before', value: '2026-10-05' }, 'La fecha es anterior al 5 oct 2026'],
      [
        { field: 'date', op: 'between', value: ['2026-01-01', '2026-03-31'] },
        'La fecha está entre el 1 ene 2026 y el 31 mar 2026',
      ],
    ];
    for (const [condition, sentence] of cases) {
      expect(conditionText(condition, lookups)).toBe(sentence);
    }
  });

  it("writes a dollars-only rule's amounts with US$", () => {
    setLanguage('es');
    expect(conditionText({ field: 'amount', op: 'gt', value: 100_00 }, lookups, 'USD')).toBe(
      'El monto es mayor que US$100',
    );
    expect(
      conditionText({ field: 'amount', op: 'between', value: [1_50, 20_00] }, lookups, 'USD'),
    ).toBe('El monto está entre US$1.50 y US$20');
  });

  it('describes each action, splits included', () => {
    setLanguage('es');
    expect(actionText({ type: 'set_category', value: 'c1' }, lookups)).toBe(
      'Asignar la categoría Coffee',
    );
    expect(actionText({ type: 'set_category', value: 'gone' }, lookups)).toBe(
      'Asignar la categoría (eliminada)',
    );
    expect(actionText({ type: 'set_payee', value: 'p1' }, lookups)).toBe(
      'Renombrar el beneficiario a Starbucks',
    );
    expect(actionText({ type: 'set_notes', value: '' }, lookups)).toBe('Borrar las notas');
    expect(actionText({ type: 'set_notes', value: 'trabajo' }, lookups)).toBe(
      'Reemplazar las notas por "trabajo"',
    );
    expect(actionText({ type: 'prepend_notes', value: '#neg ' }, lookups)).toBe(
      'Agregar "#neg " antes de las notas',
    );
    expect(
      actionText(
        {
          type: 'split',
          parts: [
            { kind: 'fixed', value: 25_00, categoryId: 'c1', notes: null },
            { kind: 'percent', value: 30, categoryId: null, notes: null },
            { kind: 'remainder', value: 0, categoryId: 'gone', notes: null },
          ],
        },
        lookups,
        'USD',
      ),
    ).toBe('Dividir: US$25 a Coffee, 30% sin categoría, el resto a (eliminada)');
  });

  it('has its own sentence for every field and operator', () => {
    const english = CONDITION_FIELDS.flatMap((f) =>
      f.ops.map((op) => conditionText(makeCondition(f.value, op), lookups)),
    );
    setLanguage('es');
    const spanish = CONDITION_FIELDS.flatMap((f) =>
      f.ops.map((op) => conditionText(makeCondition(f.value, op), lookups)),
    );
    spanish.forEach((sentence, i) => {
      expect(sentence).not.toBe(english[i]);
      expect(sentence).not.toMatch(/condition\.|\{\{/);
    });
  });
});
