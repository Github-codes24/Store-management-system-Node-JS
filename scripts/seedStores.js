import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import Store from '../src/models/store.model.js';

const dummyStores = [
  {
    storeCode: 'Store 001',
    name: 'Daily Choice Mart',
    mobile: '9876543210',
    email: 'store001@example.com',
    location: '1901 Thornridge Cir. Shiloh, Hawaii 81063',
  },
  {
    storeCode: 'Store 002',
    name: 'Family Basket Store',
    mobile: '9876543211',
    email: 'store002@example.com',
    location: '4517 Washington Ave. Manchester, Kentucky 39495',
  },
  {
    storeCode: 'Store 003',
    name: 'Smart Value Mart',
    mobile: '9876543212',
    email: 'store003@example.com',
    location: '3891 Ranchview Dr. Richardson, California 62639',
  },
  {
    storeCode: 'Store 004',
    name: 'One Stop Bazaar',
    mobile: '9876543213',
    email: 'store004@example.com',
    location: '4140 Parker Rd. Allentown, New Mexico 31134',
  },
  {
    storeCode: 'Store 005',
    name: 'Urban Cart',
    mobile: '9876543214',
    email: 'store005@example.com',
    location: '8502 Preston Rd. Inglewood, Maine 98380',
  },
  {
    storeCode: 'Store 006',
    name: 'Fresh & Fashion Mart',
    mobile: '9876543215',
    email: 'store006@example.com',
    location: '8502 Preston Rd. Inglewood, Maine 98380',
  },
  {
    storeCode: 'Store 007',
    name: 'Prime Choice Store',
    mobile: '9876543216',
    email: 'store007@example.com',
    location: '2118 Thornridge Cir. Syracuse, Connecticut 35624',
  },
  {
    storeCode: 'Store 008',
    name: 'Happy Home Mart',
    mobile: '9876543217',
    email: 'store008@example.com',
    location: '6391 Elgin St. Celina, Delaware 10299',
  },
];

const seedStores = async () => {
  try {
    await connectDB();

    for (const store of dummyStores) {
      const existing = await Store.findOne({
        $or: [{ storeCode: store.storeCode.toUpperCase() }, { email: store.email.toLowerCase() }],
        isDeleted: false,
      });

      if (!existing) {
        await Store.create(store);
        console.log(`✅ Created store: ${store.name} (${store.storeCode})`);
      } else {
        console.log(`ℹ️ Store (${store.name}) already exists.`);
      }
    }

    console.log('🎉 Store seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding stores:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Database connection closed.');
    process.exit(0);
  }
};

seedStores();
