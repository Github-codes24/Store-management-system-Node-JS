import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import Store from '../src/models/store.model.js';
import StoreEmployee from '../src/models/storeEmployee.model.js';

const dummyEmployees = [
  {
    name: 'Clark Kent',
    designation: 'Manager',
    storeName: 'Daily Choice Mart',
    mobile: '9876543210',
    email: 'clark.kent@example.com',
    address: '1901 Thornridge Cir. Shiloh, Hawaii 81063',
    userId: 'Clark_Kent',
    password: 'Store001@DCM',
  },
  {
    name: 'Tony Stark',
    designation: 'Cashier',
    storeName: 'Family Basket Store',
    mobile: '9876543210',
    email: 'tony.stark@example.com',
    address: '4517 Washington Ave. Manchester, Kentucky 39495',
    userId: 'Tony_Stark',
    password: 'Store002@FBS',
  },
  {
    name: 'Bruce Wayne',
    designation: 'Store Associate',
    storeName: 'Smart Value Mart',
    mobile: '9876543210',
    email: 'bruce.wayne@example.com',
    address: '3891 Ranchview Dr. Richardson, California 62639',
    userId: 'Bruce_Wayne',
    password: 'Store003@SVM',
  },
  {
    name: 'Barry Allen',
    designation: 'Sales Associate',
    storeName: 'One Stop Bazaar',
    mobile: '9876543210',
    email: 'barry.allen@example.com',
    address: '4140 Parker Rd. Allentown, New Mexico 31134',
    userId: 'Barry_Allen',
    password: 'Store004@OSB',
  },
  {
    name: 'Steve Rogers',
    designation: 'Storekeeper',
    storeName: 'Urban Cart',
    mobile: '9876543210',
    email: 'steve.rogers@example.com',
    address: '8502 Preston Rd. Inglewood, Maine 98380',
    userId: 'Steve_Rogers',
    password: 'Store005@UC',
  },
  {
    name: 'Clinton Barton',
    designation: 'Cashier',
    storeName: 'Fresh & Fashion Mart',
    mobile: '9876543210',
    email: 'clinton.barton@example.com',
    address: '8502 Preston Rd. Inglewood, Maine 98380',
    userId: 'Clinton_Barton',
    password: 'Store006@FFM',
  },
  {
    name: 'Scott Lang',
    designation: 'Sales Associate',
    storeName: 'Prime Choice Store',
    mobile: '9876543210',
    email: 'scott.lang@example.com',
    address: '2118 Thornridge Cir. Syracuse, Connecticut 35624',
    userId: 'Scott_Lang',
    password: 'Store007@PCS',
  },
  {
    name: 'Peter Parker',
    designation: 'Sales Associate',
    storeName: 'Happy Home Mart',
    mobile: '9876543210',
    email: 'peter.parker@example.com',
    address: '6391 Elgin St. Celina, Delaware 10299',
    userId: 'Peter_Parker',
    password: 'Store008@HHM',
  },
];

const seedStoreEmployees = async () => {
  try {
    await connectDB();

    for (const empData of dummyEmployees) {
      // Find assigned store by store name
      let store = await Store.findOne({ name: empData.storeName, isDeleted: false });

      if (!store) {
        // Fallback: create store if it doesn't exist
        store = await Store.create({
          storeCode: `STORE_${Math.floor(100 + Math.random() * 900)}`,
          name: empData.storeName,
          mobile: '9876543210',
          email: `${empData.storeName.replace(/\s+/g, '').toLowerCase()}@example.com`,
          location: empData.address,
        });
      }

      const existingEmployee = await StoreEmployee.findOne({
        $or: [
          { email: empData.email.toLowerCase() },
          { userId: empData.userId },
        ],
        isDeleted: false,
      });

      if (!existingEmployee) {
        await StoreEmployee.create({
          name: empData.name,
          designation: empData.designation,
          storeId: store._id,
          mobile: empData.mobile,
          phone: empData.mobile,
          email: empData.email.toLowerCase(),
          address: empData.address,
          userId: empData.userId,
          password: empData.password,
        });
        console.log(`✅ Created Store Employee: ${empData.name} (${empData.designation}) -> ${store.name}`);
      } else {
        console.log(`ℹ️ Store Employee (${empData.name}) already exists.`);
      }
    }

    console.log('🎉 Store Employee seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding store employees:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Database connection closed.');
    process.exit(0);
  }
};

seedStoreEmployees();
