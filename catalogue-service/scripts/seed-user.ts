/**
 * One-off seed script — creates a user.
 * Usage: npx tsx scripts/seed-user.ts
 */
import { createUser } from '../src/infra/db/repositories/userRepository.js';

const user = await createUser({
  userName: 'Local',
  email:    'email@email.com',
  password: '!Salasana1',
});

console.log('User created:', { id: user.id, email: user.email });
console.log('\n✓ Seed complete. Set MOVIES_PATH and/or TV_PATH in .env.');

