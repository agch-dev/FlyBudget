import { db } from './index.js';
import { categoryGroups, categories } from './schema.js';
import { nanoid } from 'nanoid';

const defaultGroups = [
  { name: 'Income', isIncome: 1, categories: ['Paycheck'] },
  { name: 'Housing', isIncome: 0, categories: ['Rent / Mortgage', 'Utilities', 'Internet'] },
  { name: 'Food', isIncome: 0, categories: ['Groceries', 'Restaurants'] },
  { name: 'Transport', isIncome: 0, categories: ['Gas', 'Insurance'] },
  { name: 'Personal', isIncome: 0, categories: ['Clothing', 'Health', 'Entertainment'] },
  { name: 'Savings', isIncome: 0, categories: ['Emergency Fund', 'Investments'] },
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

  group.categories.forEach((catName, catIdx) => {
    db.insert(categories).values({
      id: nanoid(),
      groupId,
      name: catName,
      sortOrder: catIdx,
      createdAt: new Date().toISOString(),
    }).run();
  });
});

console.log('Seeded default categories.');
