require('dotenv').config();
const { connectDB, mongoose } = require('../config/db');
const { seedDatabase } = require('./seedData');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/reliefgrid?replicaSet=rs0';

(async () => {
  await connectDB(MONGODB_URI);
  const { shelters, resources, volunteers, needs } = await seedDatabase();

  console.log(`[seed] users: officer1/officer123, volunteer1/volunteer123, citizen1/citizen123`);
  console.log(`[seed] shelters: ${shelters.length}, resources: ${resources.length}, volunteers: ${volunteers.length}, needs: ${needs.length}`);

  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
