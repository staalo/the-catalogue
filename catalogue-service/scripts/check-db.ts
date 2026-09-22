/**
 * Debug script — check database contents
 * Usage: npx tsx scripts/check-db.ts
 */
import { db } from '../src/infra/db/client.js';
import { users, localMovies } from '../src/infra/db/schema.js';

console.log('\n=== Users ===');
const allUsers = db.select().from(users).all();
console.log(`Total users: ${allUsers.length}`);
allUsers.forEach(u => {
  console.log(`  ID: ${u.id}, userName: ${u.userName}, email: ${u.email}`);
});

console.log('\n=== Local Movies ===');
const allMovies = db.select().from(localMovies).all();
console.log(`Total movies: ${allMovies.length}`);
allMovies.forEach(m => {
  console.log(`  ID: ${m.id}, title: ${m.title}, url: ${m.url}`);
});

console.log('\n✓ Database check complete\n');
