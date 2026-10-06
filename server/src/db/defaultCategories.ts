import { count } from 'drizzle-orm';
import { db } from './index.js';
import { categoryGroups, categories, transactions } from './schema.js';

type BudgetType = 'fixed' | 'flexible' | 'non_monthly' | 'savings';

/**
 * What a new budget starts with. Names are the English spelling: what is stored, and what
 * services/defaultNames.ts names in the language of each request (every name here must be on
 * its list, in both languages). Ids come from the keys (`default-group-food`,
 * `default-category-groceries`), so every device that creates the defaults creates the same
 * rows: never change a key.
 */
export const defaultGroups: {
  key: string;
  name: string;
  isIncome: number;
  categories: { key: string; name: string; icon: string; budgetType?: BudgetType }[];
}[] = [
  {
    key: 'income',
    name: 'Income',
    isIncome: 1,
    categories: [
      { key: 'paychecks', name: 'Paychecks', icon: '💵' },
      { key: 'interest', name: 'Interest', icon: '💹' },
      { key: 'business-income', name: 'Business Income', icon: '💼' },
      { key: 'other-income', name: 'Other Income', icon: '💰' },
    ],
  },
  {
    key: 'gifts',
    name: 'Gifts & Donations',
    isIncome: 0,
    categories: [
      { key: 'charity', name: 'Charity', icon: '❤️', budgetType: 'flexible' },
      { key: 'gifts', name: 'Gifts', icon: '🎁', budgetType: 'flexible' },
      { key: 'donations', name: 'Donations', icon: '🤝', budgetType: 'flexible' },
    ],
  },
  {
    key: 'transportation',
    name: 'Transportation',
    isIncome: 0,
    categories: [
      { key: 'gas-fuel', name: 'Gas / Fuel', icon: '⛽', budgetType: 'flexible' },
      { key: 'car-payment', name: 'Car Payment', icon: '🚗', budgetType: 'fixed' },
      { key: 'car-insurance', name: 'Car Insurance', icon: '🛡️', budgetType: 'fixed' },
      { key: 'parking', name: 'Parking', icon: '🅿️', budgetType: 'flexible' },
      { key: 'public-transit', name: 'Public Transit', icon: '🚌', budgetType: 'flexible' },
      { key: 'ride-share', name: 'Ride Share', icon: '🚕', budgetType: 'flexible' },
      { key: 'car-maintenance', name: 'Car Maintenance', icon: '🔧', budgetType: 'non_monthly' },
    ],
  },
  {
    key: 'housing',
    name: 'Housing',
    isIncome: 0,
    categories: [
      { key: 'rent-mortgage', name: 'Rent / Mortgage', icon: '🏠', budgetType: 'fixed' },
      { key: 'home-insurance', name: 'Home Insurance', icon: '🛡️', budgetType: 'fixed' },
      { key: 'property-tax', name: 'Property Tax', icon: '🏛️', budgetType: 'fixed' },
      { key: 'hoa-fees', name: 'HOA Fees', icon: '🏢', budgetType: 'fixed' },
      { key: 'home-maintenance', name: 'Home Maintenance', icon: '🔨', budgetType: 'flexible' },
      { key: 'home-improvement', name: 'Home Improvement', icon: '🎨', budgetType: 'non_monthly' },
    ],
  },
  {
    key: 'bills',
    name: 'Bills & Utilities',
    isIncome: 0,
    categories: [
      { key: 'electric', name: 'Electric', icon: '⚡', budgetType: 'fixed' },
      { key: 'water', name: 'Water', icon: '💧', budgetType: 'fixed' },
      { key: 'gas-natural', name: 'Gas (Natural)', icon: '🔥', budgetType: 'fixed' },
      { key: 'internet', name: 'Internet', icon: '🌐', budgetType: 'fixed' },
      { key: 'phone', name: 'Phone', icon: '📱', budgetType: 'fixed' },
      { key: 'trash-recycling', name: 'Trash / Recycling', icon: '♻️', budgetType: 'fixed' },
      { key: 'streaming-services', name: 'Streaming Services', icon: '📺', budgetType: 'fixed' },
    ],
  },
  {
    key: 'food',
    name: 'Food & Dining',
    isIncome: 0,
    categories: [
      { key: 'groceries', name: 'Groceries', icon: '🛒', budgetType: 'flexible' },
      { key: 'restaurants', name: 'Restaurants', icon: '🍽️', budgetType: 'flexible' },
      { key: 'coffee-shops', name: 'Coffee Shops', icon: '☕', budgetType: 'flexible' },
      { key: 'fast-food', name: 'Fast Food', icon: '🍔', budgetType: 'flexible' },
      { key: 'alcohol-bars', name: 'Alcohol / Bars', icon: '🍷', budgetType: 'flexible' },
    ],
  },
  {
    key: 'travel',
    name: 'Travel & Lifestyle',
    isIncome: 0,
    categories: [
      { key: 'flights', name: 'Flights', icon: '✈️', budgetType: 'non_monthly' },
      { key: 'hotels', name: 'Hotels', icon: '🏨', budgetType: 'non_monthly' },
      { key: 'vacation', name: 'Vacation', icon: '🏖️', budgetType: 'non_monthly' },
      { key: 'entertainment', name: 'Entertainment', icon: '🎬', budgetType: 'non_monthly' },
      { key: 'hobbies', name: 'Hobbies', icon: '🎨', budgetType: 'non_monthly' },
    ],
  },
  {
    key: 'shopping',
    name: 'Shopping',
    isIncome: 0,
    categories: [
      { key: 'clothing', name: 'Clothing', icon: '👔', budgetType: 'flexible' },
      { key: 'electronics', name: 'Electronics', icon: '💻', budgetType: 'flexible' },
      { key: 'home-goods', name: 'Home Goods', icon: '🛋️', budgetType: 'flexible' },
      { key: 'personal-care', name: 'Personal Care', icon: '✨', budgetType: 'flexible' },
    ],
  },
  {
    key: 'family',
    name: 'Family',
    isIncome: 0,
    categories: [
      { key: 'childcare-daycare', name: 'Childcare / Daycare', icon: '👶', budgetType: 'fixed' },
      { key: 'kids-activities', name: 'Kids Activities', icon: '🎪', budgetType: 'flexible' },
      { key: 'school-supplies', name: 'School Supplies', icon: '🎒', budgetType: 'flexible' },
      { key: 'baby-supplies', name: 'Baby Supplies', icon: '🍼', budgetType: 'flexible' },
      { key: 'allowance', name: 'Allowance', icon: '🐷', budgetType: 'flexible' },
    ],
  },
  {
    key: 'education',
    name: 'Education',
    isIncome: 0,
    categories: [
      { key: 'tuition', name: 'Tuition', icon: '🎓', budgetType: 'fixed' },
      { key: 'books-supplies', name: 'Books & Supplies', icon: '📚', budgetType: 'non_monthly' },
      { key: 'student-loans', name: 'Student Loans', icon: '📜', budgetType: 'fixed' },
      { key: 'online-courses', name: 'Online Courses', icon: '💻', budgetType: 'non_monthly' },
    ],
  },
  {
    key: 'health',
    name: 'Health & Wellness',
    isIncome: 0,
    categories: [
      { key: 'doctor-medical', name: 'Doctor / Medical', icon: '🩺', budgetType: 'non_monthly' },
      { key: 'dentist', name: 'Dentist', icon: '🦷', budgetType: 'non_monthly' },
      { key: 'pharmacy', name: 'Pharmacy', icon: '💊', budgetType: 'flexible' },
      { key: 'gym-fitness', name: 'Gym / Fitness', icon: '🏋️', budgetType: 'flexible' },
      { key: 'mental-health', name: 'Mental Health', icon: '🧠', budgetType: 'non_monthly' },
      { key: 'vision-eye-care', name: 'Vision / Eye Care', icon: '👓', budgetType: 'non_monthly' },
    ],
  },
  {
    key: 'financial',
    name: 'Financial',
    isIncome: 0,
    categories: [
      { key: 'savings', name: 'Savings', icon: '🐷', budgetType: 'non_monthly' },
      { key: 'investments', name: 'Investments', icon: '📈', budgetType: 'non_monthly' },
      { key: 'loan-payment', name: 'Loan Payment', icon: '🏦', budgetType: 'fixed' },
      { key: 'bank-fees', name: 'Bank Fees', icon: '💸', budgetType: 'fixed' },
    ],
  },
  {
    key: 'business',
    name: 'Business',
    isIncome: 0,
    categories: [
      { key: 'office-supplies', name: 'Office Supplies', icon: '📎', budgetType: 'flexible' },
      { key: 'software-tools', name: 'Software / Tools', icon: '⚙️', budgetType: 'flexible' },
      { key: 'marketing', name: 'Marketing', icon: '📣', budgetType: 'flexible' },
      {
        key: 'professional-services',
        name: 'Professional Services',
        icon: '💼',
        budgetType: 'flexible',
      },
      { key: 'business-travel', name: 'Business Travel', icon: '🧳', budgetType: 'non_monthly' },
    ],
  },
  {
    key: 'other',
    name: 'Other',
    isIncome: 0,
    categories: [
      { key: 'miscellaneous', name: 'Miscellaneous', icon: '📁', budgetType: 'flexible' },
      { key: 'cash-atm', name: 'Cash / ATM', icon: '💵', budgetType: 'flexible' },
    ],
  },
];

/**
 * Adds the default category groups to a new budget. Skips any budget that already
 * has categories or transactions, so a user who deleted the defaults and started
 * tracking their own way doesn't get them back on the next launch.
 * Returns the number of categories created.
 */
export function seedDefaultCategories(): number {
  const [{ groups }] = db.select({ groups: count() }).from(categoryGroups).all();
  const [{ txns }] = db.select({ txns: count() }).from(transactions).all();
  if (groups > 0 || txns > 0) return 0;

  let created = 0;
  db.transaction((tx) => {
    const now = new Date().toISOString();
    defaultGroups.forEach((group, groupIdx) => {
      const groupId = `default-group-${group.key}`;
      tx.insert(categoryGroups)
        .values({
          id: groupId,
          name: group.name,
          isIncome: group.isIncome,
          sortOrder: groupIdx,
          createdAt: now,
        })
        .run();

      group.categories.forEach((cat, catIdx) => {
        tx.insert(categories)
          .values({
            id: `default-category-${cat.key}`,
            groupId,
            name: cat.name,
            icon: cat.icon,
            budgetType: cat.budgetType ?? null,
            sortOrder: catIdx,
            createdAt: now,
          })
          .run();
        created++;
      });
    });
  });
  return created;
}
