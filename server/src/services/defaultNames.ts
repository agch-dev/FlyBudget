// The names the app supplies, in English and Spanish (ADR 0002, "Default Category" in
// GLOSSARY.md). A category, category group or dashboard is a default exactly when its name is
// on its list: the database stores the English spelling, and every response names it in the
// language of the request. Nothing else records it, so a new default name only needs a line
// here, in both languages.
//
// Pure: no database, no request. Matching is exact (after trimming what was typed),
// case-sensitive, and separate per list. No Spanish name may equal a different entry's English
// name within a list, or the list would be ambiguous (defaultNames.test.ts holds this).
import type { Language } from '../utils/language.js';

export const NAME_KINDS = ['group', 'category', 'dashboard'] as const;
export type NameKind = (typeof NAME_KINDS)[number];

export interface SuppliedName {
  en: string;
  es: string;
}

const names = (pairs: [en: string, es: string][]): SuppliedName[] =>
  pairs.map(([en, es]) => ({ en, es }));

const GROUPS = names([
  ['Income', 'Ingresos'],
  ['Gifts & Donations', 'Regalos y donaciones'],
  ['Transportation', 'Transporte'],
  ['Housing', 'Vivienda'],
  ['Bills & Utilities', 'Facturas y servicios'],
  ['Food & Dining', 'Comida y restaurantes'],
  ['Travel & Lifestyle', 'Viajes y ocio'],
  ['Shopping', 'Compras'],
  ['Family', 'Familia'],
  ['Education', 'Educación'],
  ['Health & Wellness', 'Salud y bienestar'],
  ['Financial', 'Finanzas'],
  ['Business', 'Negocio'],
  ['Other', 'Otros'],
  // The demo's own
  ['Lifestyle', 'Estilo de vida'],
  ['Gifts & Giving', 'Regalos y solidaridad'],
  ['Savings Goals', 'Metas de ahorro'],
]);

const CATEGORIES = names([
  ['Paychecks', 'Sueldos'],
  ['Interest', 'Intereses'],
  ['Business Income', 'Ingresos del negocio'],
  ['Other Income', 'Otros ingresos'],
  ['Charity', 'Caridad'],
  ['Gifts', 'Regalos'],
  ['Donations', 'Donaciones'],
  ['Gas / Fuel', 'Combustible'],
  ['Car Payment', 'Cuota del auto'],
  ['Car Insurance', 'Seguro del auto'],
  ['Parking', 'Estacionamiento'],
  ['Public Transit', 'Transporte público'],
  ['Ride Share', 'Taxi / Uber'],
  ['Car Maintenance', 'Mantenimiento del auto'],
  ['Rent / Mortgage', 'Alquiler / Hipoteca'],
  ['Home Insurance', 'Seguro del hogar'],
  ['Property Tax', 'Impuestos de la vivienda'],
  ['HOA Fees', 'Gastos comunes'],
  ['Home Maintenance', 'Mantenimiento del hogar'],
  ['Home Improvement', 'Mejoras del hogar'],
  ['Electric', 'Electricidad'],
  ['Water', 'Agua'],
  // Not plain "Gas": that is the English name of the demo's fuel category
  ['Gas (Natural)', 'Gas (hogar)'],
  ['Internet', 'Internet'],
  ['Phone', 'Teléfono'],
  ['Trash / Recycling', 'Residuos / Reciclaje'],
  ['Streaming Services', 'Servicios de streaming'],
  ['Groceries', 'Supermercado'],
  ['Restaurants', 'Restaurantes'],
  ['Coffee Shops', 'Cafeterías'],
  ['Fast Food', 'Comida rápida'],
  ['Alcohol / Bars', 'Alcohol / Bares'],
  ['Flights', 'Vuelos'],
  ['Hotels', 'Hoteles'],
  ['Vacation', 'Vacaciones'],
  ['Entertainment', 'Entretenimiento'],
  ['Hobbies', 'Hobbies'],
  ['Clothing', 'Ropa'],
  ['Electronics', 'Electrónica'],
  ['Home Goods', 'Artículos para el hogar'],
  ['Personal Care', 'Cuidado personal'],
  ['Childcare / Daycare', 'Cuidado de niños / Jardín'],
  ['Kids Activities', 'Actividades de los niños'],
  ['School Supplies', 'Útiles escolares'],
  ['Baby Supplies', 'Artículos de bebé'],
  ['Allowance', 'Mesada'],
  ['Tuition', 'Cuota de estudios'],
  ['Books & Supplies', 'Libros y materiales'],
  ['Student Loans', 'Préstamos estudiantiles'],
  ['Online Courses', 'Cursos en línea'],
  ['Doctor / Medical', 'Médico'],
  ['Dentist', 'Dentista'],
  ['Pharmacy', 'Farmacia'],
  ['Gym / Fitness', 'Gimnasio / Deporte'],
  ['Mental Health', 'Salud mental'],
  ['Vision / Eye Care', 'Óptica / Oculista'],
  ['Savings', 'Ahorros'],
  ['Investments', 'Inversiones'],
  ['Loan Payment', 'Cuota de préstamo'],
  ['Bank Fees', 'Comisiones bancarias'],
  ['Office Supplies', 'Artículos de oficina'],
  ['Software / Tools', 'Software / Herramientas'],
  ['Marketing', 'Marketing'],
  ['Professional Services', 'Servicios profesionales'],
  ['Business Travel', 'Viajes de trabajo'],
  ['Miscellaneous', 'Varios'],
  ['Cash / ATM', 'Efectivo / Cajero'],
  // No longer given to new budgets; the ones that have it keep it. Never "Sin categoría",
  // which is the label of a transaction with no category
  ['Uncategorized', 'Sin clasificar'],
  // The demo's own
  ['Rent', 'Alquiler'],
  ['Renters Insurance', 'Seguro de inquilino'],
  ['Streaming', 'Streaming'],
  ['Gas', 'Nafta'],
  ['Gym', 'Gimnasio'],
  ['Doctor & Dentist', 'Médico y dentista'],
  ['Emergency Fund', 'Fondo de emergencia'],
  ['Biscuit (dog)', 'Biscuit (perro)'],
]);

const DASHBOARDS = names([['Overview', 'Vista general']]);

const LISTS: Record<NameKind, SuppliedName[]> = {
  group: GROUPS,
  category: CATEGORIES,
  dashboard: DASHBOARDS,
};

const byEnglish = (list: SuppliedName[]) => new Map(list.map((entry) => [entry.en, entry]));
/** Either spelling → its entry */
const byEither = (list: SuppliedName[]) =>
  new Map(list.flatMap((entry) => [[entry.es, entry] as const, [entry.en, entry] as const]));

const STORED: Record<NameKind, Map<string, SuppliedName>> = {
  group: byEnglish(GROUPS),
  category: byEnglish(CATEGORIES),
  dashboard: byEnglish(DASHBOARDS),
};
const TYPED: Record<NameKind, Map<string, SuppliedName>> = {
  group: byEither(GROUPS),
  category: byEither(CATEGORIES),
  dashboard: byEither(DASHBOARDS),
};

/** Every supplied name of one kind, in both languages. */
export function suppliedNames(kind: NameKind): readonly SuppliedName[] {
  return LISTS[kind];
}

/**
 * The name to show for a stored name: a supplied name in `language`, any other name as it is.
 */
export function shownName(kind: NameKind, stored: string, language: Language): string {
  return STORED[kind].get(stored)?.[language] ?? stored;
}

/** `shownName` for a name that may be missing (a left join, a deleted category). */
export function shownNameOrNull(
  kind: NameKind,
  stored: string | null | undefined,
  language: Language,
): string | null {
  return stored == null ? null : shownName(kind, stored, language);
}

/**
 * The name to store for a typed name: the English spelling of a supplied name typed in either
 * language, any other name as typed (trimmed).
 */
export function storedName(kind: NameKind, typed: string): string {
  const name = typed.trim();
  return TYPED[kind].get(name)?.en ?? name;
}
