import { db } from './index.js';
import { categoryGroups, categories } from './schema.js';
import { nanoid } from 'nanoid';

const defaultGroups = [
  {
    name: 'Income', isIncome: 1, categories: [
      { name: 'Paychecks', icon: '💵' },
      { name: 'Interest', icon: '💹' },
      { name: 'Business Income', icon: '💼' },
      { name: 'Other Income', icon: '💰' },
    ],
  },
  {
    name: 'Gifts & Donations', isIncome: 0, categories: [
      { name: 'Charity', icon: '❤️' },
      { name: 'Gifts', icon: '🎁' },
      { name: 'Donations', icon: '🤝' },
    ],
  },
  {
    name: 'Transportation', isIncome: 0, categories: [
      { name: 'Gas / Fuel', icon: '⛽' },
      { name: 'Car Payment', icon: '🚗' },
      { name: 'Car Insurance', icon: '🛡️' },
      { name: 'Parking', icon: '🅿️' },
      { name: 'Public Transit', icon: '🚌' },
      { name: 'Ride Share', icon: '🚕' },
      { name: 'Car Maintenance', icon: '🔧' },
    ],
  },
  {
    name: 'Housing', isIncome: 0, categories: [
      { name: 'Rent / Mortgage', icon: '🏠' },
      { name: 'Home Insurance', icon: '🛡️' },
      { name: 'Property Tax', icon: '🏛️' },
      { name: 'HOA Fees', icon: '🏢' },
      { name: 'Home Maintenance', icon: '🔨' },
      { name: 'Home Improvement', icon: '🎨' },
    ],
  },
  {
    name: 'Bills & Utilities', isIncome: 0, categories: [
      { name: 'Electric', icon: '⚡' },
      { name: 'Water', icon: '💧' },
      { name: 'Gas (Natural)', icon: '🔥' },
      { name: 'Internet', icon: '🌐' },
      { name: 'Phone', icon: '📱' },
      { name: 'Trash / Recycling', icon: '♻️' },
      { name: 'Streaming Services', icon: '📺' },
    ],
  },
  {
    name: 'Food & Dining', isIncome: 0, categories: [
      { name: 'Groceries', icon: '🛒' },
      { name: 'Restaurants', icon: '🍽️' },
      { name: 'Coffee Shops', icon: '☕' },
      { name: 'Fast Food', icon: '🍔' },
      { name: 'Alcohol / Bars', icon: '🍷' },
    ],
  },
  {
    name: 'Travel & Lifestyle', isIncome: 0, categories: [
      { name: 'Flights', icon: '✈️' },
      { name: 'Hotels', icon: '🏨' },
      { name: 'Vacation', icon: '🏖️' },
      { name: 'Entertainment', icon: '🎬' },
      { name: 'Hobbies', icon: '🎨' },
    ],
  },
  {
    name: 'Shopping', isIncome: 0, categories: [
      { name: 'Clothing', icon: '👔' },
      { name: 'Electronics', icon: '💻' },
      { name: 'Home Goods', icon: '🛋️' },
      { name: 'Personal Care', icon: '✨' },
    ],
  },
  {
    name: 'Family', isIncome: 0, categories: [
      { name: 'Childcare / Daycare', icon: '👶' },
      { name: 'Kids Activities', icon: '🎪' },
      { name: 'School Supplies', icon: '🎒' },
      { name: 'Baby Supplies', icon: '🍼' },
      { name: 'Allowance', icon: '🐷' },
    ],
  },
  {
    name: 'Education', isIncome: 0, categories: [
      { name: 'Tuition', icon: '🎓' },
      { name: 'Books & Supplies', icon: '📚' },
      { name: 'Student Loans', icon: '📜' },
      { name: 'Online Courses', icon: '💻' },
    ],
  },
  {
    name: 'Health & Wellness', isIncome: 0, categories: [
      { name: 'Doctor / Medical', icon: '🩺' },
      { name: 'Dentist', icon: '🦷' },
      { name: 'Pharmacy', icon: '💊' },
      { name: 'Gym / Fitness', icon: '🏋️' },
      { name: 'Mental Health', icon: '🧠' },
      { name: 'Vision / Eye Care', icon: '👓' },
    ],
  },
  {
    name: 'Financial', isIncome: 0, categories: [
      { name: 'Savings', icon: '🐷' },
      { name: 'Investments', icon: '📈' },
      { name: 'Loan Payment', icon: '🏦' },
      { name: 'Bank Fees', icon: '💸' },
    ],
  },
  {
    name: 'Business', isIncome: 0, categories: [
      { name: 'Office Supplies', icon: '📎' },
      { name: 'Software / Tools', icon: '⚙️' },
      { name: 'Marketing', icon: '📣' },
      { name: 'Professional Services', icon: '💼' },
      { name: 'Business Travel', icon: '🧳' },
    ],
  },
  {
    name: 'Other', isIncome: 0, categories: [
      { name: 'Miscellaneous', icon: '📁' },
      { name: 'Cash / ATM', icon: '💵' },
      { name: 'Uncategorized', icon: '❓' },
    ],
  },
];

const existingGroups = db.select().from(categoryGroups).all();
if (existingGroups.length > 0) {
  console.log('Database already seeded, skipping.');
  process.exit(0);
}

defaultGroups.forEach((group, groupIdx) => {
  const groupId = nanoid();
  db.insert(categoryGroups).values({
    id: groupId,
    name: group.name,
    isIncome: group.isIncome,
    sortOrder: groupIdx,
    createdAt: new Date().toISOString(),
  }).run();

  group.categories.forEach((cat, catIdx) => {
    db.insert(categories).values({
      id: nanoid(),
      groupId,
      name: cat.name,
      icon: cat.icon,
      sortOrder: catIdx,
      createdAt: new Date().toISOString(),
    }).run();
  });
});

console.log('Seeded default categories.');
