import { dbService } from './src/services/db';

async function checkDatabase() {
  try {
    const transactions = await dbService.getTransactions();
    console.log('Transactions:', transactions);

    const categories = await dbService.getCategories();
    console.log('Categories:', categories);
  } catch (error) {
    console.error('Error checking database:', error);
  }
}

checkDatabase();
