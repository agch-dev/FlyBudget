import { format, parseISO } from 'date-fns';
import { formatCurrency } from './currency';
import { t } from '../i18n';
import {
  HOME_CURRENCY,
  type Currency,
  type Rule,
  type RuleAction,
  type RuleCondition,
  type RuleConditionField,
  type RuleConditionOp,
  type RuleIdField,
  type RuleInput,
  type RuleSplitPart,
} from '../types';

const TEXT_OPS: RuleConditionOp[] = [
  'is',
  'is_not',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'one_of',
  'not_one_of',
  'regex',
  'is_empty',
  'is_not_empty',
];
const ID_OPS: RuleConditionOp[] = ['is', 'is_not', 'one_of', 'not_one_of'];

/** The condition fields in the order the editor lists them, each with the operators it offers */
export const CONDITION_FIELDS: Array<{ value: RuleConditionField; ops: RuleConditionOp[] }> = [
  { value: 'payee', ops: [...ID_OPS, 'is_empty', 'is_not_empty'] },
  { value: 'payee_name', ops: TEXT_OPS },
  { value: 'imported_payee', ops: TEXT_OPS },
  { value: 'notes', ops: TEXT_OPS },
  { value: 'amount', ops: ['is', 'is_not', 'gt', 'gte', 'lt', 'lte', 'between', 'approx'] },
  { value: 'direction', ops: ['is'] },
  { value: 'currency', ops: ['is'] },
  { value: 'category', ops: [...ID_OPS, 'is_empty', 'is_not_empty'] },
  { value: 'account', ops: ID_OPS },
  { value: 'date', ops: ['is', 'before', 'after', 'between'] },
];

/** A field's name, as the editor lists it */
export const fieldLabel = (field: RuleConditionField): string => t(`rules:field.${field}`);

/** What a field compares, for the fields that need explaining */
export function fieldHint(field: RuleConditionField): string | undefined {
  switch (field) {
    case 'payee_name':
    case 'imported_payee':
    case 'amount':
    case 'currency':
      return t(`rules:fieldHint.${field}`);
    default:
      return undefined;
  }
}

/**
 * The currency a rule is limited to, or null when it can match both. With "all" one currency
 * condition is enough (two different ones match nothing); with "any" every condition has to
 * name the same currency. Amounts in a limited rule are written with that currency's sign.
 */
export function ruleCurrency(
  rule: Pick<RuleInput, 'conditionsOp' | 'conditions'>,
): Currency | null {
  const named = new Set<Currency>();
  let others = 0;
  for (const c of rule.conditions) {
    if (c.field === 'currency') named.add(c.value);
    else others++;
  }
  if (named.size !== 1) return null;
  if (rule.conditionsOp === 'or' && others > 0) return null;
  return [...named][0];
}

// The catalog has one text per field and operator (`op` for the editor's list, `condition` for
// the whole sentence), checked against the types in en/rules.ts. A key is built from a field
// and an operator the condition types already pair up, which TypeScript can't follow.
type OpKey = 'rules:op.payee.is';
type ConditionKey = 'rules:condition.payee.is';

/** An operator as the editor lists it, after the field's name: "is one of", "es una de" */
export function opLabel(field: RuleConditionField, op: RuleConditionOp): string {
  return t(`rules:op.${field}.${op}` as OpKey);
}

export const ACTION_TYPES: Array<RuleAction['type']> = [
  'set_category',
  'set_payee',
  'set_notes',
  'prepend_notes',
  'append_notes',
  'split',
];

/** An action's name, as the editor lists it */
export const actionTypeLabel = (type: RuleAction['type']): string => t(`rules:actionType.${type}`);

const today = () => new Date().toISOString().slice(0, 10);
const isTextField = (f: RuleConditionField) =>
  f === 'payee_name' || f === 'imported_payee' || f === 'notes';

/** A condition with a sensible starting value, keeping the old value when it still fits */
export function makeCondition(
  field: RuleConditionField,
  op: RuleConditionOp,
  prev?: RuleCondition,
): RuleCondition {
  const compatible =
    prev && (prev.field === field || (isTextField(prev.field) && isTextField(field)));
  const old = compatible && 'value' in prev ? prev.value : undefined;
  const first = Array.isArray(old) ? old[0] : old;
  const num = typeof first === 'number' ? first : 0;
  const str = typeof first === 'string' ? first : '';

  if (op === 'is_empty' || op === 'is_not_empty') return { field, op } as RuleCondition;
  if (op === 'one_of' || op === 'not_one_of') {
    const list =
      Array.isArray(old) && typeof old[0] === 'string' ? (old as string[]) : str ? [str] : [];
    return { field, op, value: list } as RuleCondition;
  }
  switch (field) {
    case 'amount':
      return op === 'between'
        ? { field, op, value: Array.isArray(old) ? (old as [number, number]) : [num, num] }
        : ({ field, op, value: num } as RuleCondition);
    case 'direction':
      return { field, op: 'is', value: old === 'inflow' ? 'inflow' : 'outflow' };
    case 'currency':
      return { field, op: 'is', value: old === 'USD' ? 'USD' : HOME_CURRENCY };
    case 'date': {
      const d = str || today();
      return op === 'between'
        ? { field, op, value: Array.isArray(old) ? (old as [string, string]) : [d, d] }
        : ({ field, op, value: d } as RuleCondition);
    }
    default:
      return { field, op, value: str } as RuleCondition;
  }
}

export const newCondition = (): RuleCondition => ({
  field: 'payee_name',
  op: 'contains',
  value: '',
});
export const newAction = (): RuleAction => ({ type: 'set_category', value: '' });
export const newSplitPart = (kind: RuleSplitPart['kind'] = 'remainder'): RuleSplitPart => ({
  kind,
  value: kind === 'percent' ? 50 : 0,
  categoryId: null,
  notes: null,
});

export function makeAction(type: RuleAction['type'], prev?: RuleAction): RuleAction {
  if (type === 'split')
    return { type, parts: [newSplitPart('percent'), newSplitPart('remainder')] };
  const keepText =
    prev && prev.type !== 'split' && prev.type.endsWith('notes') && type.endsWith('notes');
  return { type, value: keepText ? (prev as { value: string }).value : '' } as RuleAction;
}

export function isConditionComplete(c: RuleCondition): boolean {
  if (!('value' in c)) return true;
  const v = c.value;
  if (Array.isArray(v))
    return v.length > 0 && v.every((x) => (typeof x === 'string' ? x.trim() !== '' : x >= 0));
  if (typeof v === 'number') return v >= 0;
  return v.trim() !== '';
}

function isActionComplete(a: RuleAction): boolean {
  if (a.type === 'split')
    return a.parts.length > 0 && a.parts.every((p) => p.kind !== 'percent' || p.value <= 100);
  if (a.type === 'set_notes') return true; // empty clears the notes
  return a.value.trim() !== '';
}

export function isRuleComplete(r: Pick<RuleInput, 'conditions' | 'actions'>): boolean {
  return (
    r.actions.length > 0 &&
    r.conditions.every(isConditionComplete) &&
    r.actions.every(isActionComplete)
  );
}

// ---------------------------------------------------------------------------
// Summaries

export type RuleLookups = {
  payee: (id: string) => string | undefined;
  account: (id: string) => string | undefined;
  category: (id: string) => string | undefined;
};

const quote = (s: string) => `"${s}"`;
const shortDate = (d: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(d) ? format(parseISO(d), t('datePattern.medium')) : d;

function nameOf(field: RuleIdField, id: string, l: RuleLookups): string {
  const name =
    field === 'payee' ? l.payee(id) : field === 'account' ? l.account(id) : l.category(id);
  return name ?? t(`rules:deleted.${field}`);
}

const isIdField = (field: RuleConditionField): field is RuleIdField =>
  field === 'payee' || field === 'account' || field === 'category';

/**
 * A condition in plain words. `currency` is the one the rule is limited to (`ruleCurrency`):
 * amounts are written with its sign, or with the home currency's when the rule isn't limited.
 * Each field and operator has its own sentence in the catalog, so word order, articles and
 * gender are the language's own.
 */
export function conditionText(
  c: RuleCondition,
  l: RuleLookups,
  currency: Currency | null = null,
): string {
  if (c.field === 'direction') return t(`rules:direction.${c.value}`);
  if (c.field === 'currency') return t(`rules:inCurrency.${c.value}`);
  const sentence = `rules:condition.${c.field}.${c.op}` as ConditionKey;
  if (!('value' in c)) return t(sentence);

  const field = c.field;
  const one = (v: string | number): string => {
    if (typeof v === 'number') return formatCurrency(v, currency ?? HOME_CURRENCY);
    if (field === 'date') return shortDate(v);
    return isIdField(field) ? nameOf(field, v, l) : quote(v);
  };
  if (c.op === 'between') return t(sentence, { from: one(c.value[0]), to: one(c.value[1]) });
  if (Array.isArray(c.value)) return t(sentence, { value: c.value.map(one).join(', ') });
  return t(sentence, { value: c.op === 'regex' ? `/${c.value}/` : one(c.value) });
}

function splitPartText(p: RuleSplitPart, l: RuleLookups, currency: Currency | null): string {
  const category = p.categoryId ? nameOf('category', p.categoryId, l) : null;
  if (p.kind === 'remainder') {
    return category === null
      ? t('rules:splitPart.restUncategorized')
      : t('rules:splitPart.rest', { category });
  }
  const amount =
    p.kind === 'fixed' ? formatCurrency(p.value, currency ?? HOME_CURRENCY) : `${p.value}%`;
  return category === null
    ? t('rules:splitPart.amountUncategorized', { amount })
    : t('rules:splitPart.amount', { amount, category });
}

export function actionText(
  a: RuleAction,
  l: RuleLookups,
  currency: Currency | null = null,
): string {
  switch (a.type) {
    case 'set_category':
      return t('rules:action.set_category', { value: nameOf('category', a.value, l) });
    case 'set_payee':
      return t('rules:action.set_payee', { value: nameOf('payee', a.value, l) });
    case 'set_notes':
      return a.value
        ? t('rules:action.set_notes', { value: quote(a.value) })
        : t('rules:action.clear_notes');
    case 'prepend_notes':
    case 'append_notes':
      return t(`rules:action.${a.type}`, { value: quote(a.value) });
    case 'split':
      return t('rules:action.split', {
        parts: a.parts.map((p) => splitPartText(p, l, currency)).join(', '),
      });
  }
}

/** Plain text of a whole rule, for search */
export function ruleSearchText(r: Rule, l: RuleLookups): string {
  const currency = ruleCurrency(r);
  return [
    ...r.conditions.map((c) => conditionText(c, l, currency)),
    ...r.actions.map((a) => actionText(a, l, currency)),
  ]
    .join(' ')
    .toLowerCase();
}
