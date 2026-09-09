/**
 * One-off seed script — creates a user, media paths, and test movies.
 * Usage: npx tsx scripts/seed-user.ts
 */
import { createUser } from '../src/infra/db/repositories/userRepository.js';
import { db } from '../src/infra/db/client.js';
import { localMedia, localMovies } from '../src/infra/db/schema.js';

const user = await createUser({
  userName: 'Local',
  email:    'email@email.com',
  password: '!Salasana1',
});

console.log('User created:', { id: user.id, email: user.email });

// Insert media paths for the user — update the path to match your actual movies directory
const moviesPath = 'C:/temp/leffat';  // ← Change this to your movies folder

db.insert(localMedia).values({
  userName: user.userName,
  moviesPath,
  tvPath: null,
}).run();

console.log('Media paths created:', { userName: user.userName, moviesPath });

// Insert test movies (the watcher would normally do this by scanning the directory)
// const testMovies = [
//   {
//     title: 'Test Movie 1',
//     originalTitle: 'Test Movie 1',
//     overview: 'A test movie for browse API validation.',
//     url: `${moviesPath}/test-movie-1.mp4`,  // Must start with moviesPath
//     releaseDate: '2024-01-01',
//     runtime: 120,
//     adult: false,
//     popularity: 8.5,
//     voteAverage: 8.0,
//     voteCount: 100,
//   },
//   {
//     title: 'Test Movie 2',
//     originalTitle: 'Test Movie 2',
//     overview: 'Another test movie.',
//     url: `${moviesPath}/test-movie-2.mkv`,  // Must start with moviesPath
//     releaseDate: '2024-02-01',
//     runtime: 130,
//     adult: false,
//     popularity: 7.5,
//     voteAverage: 7.5,
//     voteCount: 80,
//   },
// ];

// db.insert(localMovies).values(testMovies).run();

// console.log(`Test movies created: ${testMovies.length} movies inserted`);
console.log('\n✓ Seed complete. The browse endpoint should now return results.');

