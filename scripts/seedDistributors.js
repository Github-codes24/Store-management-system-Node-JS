import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import Distributor from '../src/models/distributor.model.js';

const dummyDistributors = [
  {
    name: 'Sysco',
    salesperson: 'John Doe',
    mobile: '9876543210',
    email: 'sysco@example.com',
    gstin: '27AAACR5055K1Z7',
    address: '100 Sysco Way, Houston, TX 77077',
    status: 'active',
  },
  {
    name: 'Reinhart Foodservice',
    salesperson: 'Ralph Edwards',
    mobile: '9876543211',
    email: 'reinhart@example.com',
    gstin: '27AAACR5055K1Z8',
    address: '6250 River Rd, Rosemont, IL 60018',
    status: 'active',
  },
  {
    name: 'U.S. Foods',
    salesperson: 'Arlene McCoy',
    mobile: '9876543212',
    email: 'usfoods@example.com',
    gstin: '27AAACR5055K1Z9',
    address: '9399 W Higgins Rd, Rosemont, IL 60018',
    status: 'active',
  },
  {
    name: 'Performance Foodservice',
    salesperson: 'Cameron Williamson',
    mobile: '9876543213',
    email: 'pfg@example.com',
    gstin: '27AAACR5055K1ZA',
    address: '12500 Fair Lakes Cir, Fairfax, VA 22033',
    status: 'active',
  },
  {
    name: 'Gordon Food Service',
    salesperson: 'Jane Cooper',
    mobile: '9876543214',
    email: 'gordon@example.com',
    gstin: '27AAACR5055K1ZB',
    address: '1300 Gezon Pkwy SW, Wyoming, MI 49509',
    status: 'active',
  },
  {
    name: 'DOT Transportation',
    salesperson: 'Jerome Bell',
    mobile: '9876543215',
    email: 'dot@example.com',
    gstin: '27AAACR5055K1ZC',
    address: '1 Dot Way, Mt Sterling, IL 62353',
    status: 'active',
  },
  {
    name: 'The Martin-Brower Co',
    salesperson: 'Leslie Alexander',
    mobile: '9876543216',
    email: 'martinbrower@example.com',
    gstin: '27AAACR5055K1ZD',
    address: '1 Gulf and Western Pl, Rosemont, IL 60018',
    status: 'active',
  },
  {
    name: 'McLane Foodservice',
    salesperson: 'Eleanor Pena',
    mobile: '9876543217',
    email: 'mclane@example.com',
    gstin: '27AAACR5055K1ZE',
    address: '4747 McLane Pkwy, Temple, TX 76504',
    status: 'active',
  },
];

const seedDistributors = async () => {
  try {
    await connectDB();

    for (const dist of dummyDistributors) {
      const existing = await Distributor.findOne({
        $or: [{ email: dist.email.toLowerCase() }, { gstin: dist.gstin }],
        isDeleted: false,
      });

      if (!existing) {
        await Distributor.create(dist);
        console.log(`✅ Created distributor: ${dist.name}`);
      } else {
        console.log(`ℹ️ Distributor (${dist.name}) already exists.`);
      }
    }

    console.log('🎉 Distributor seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding distributors:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Database connection closed.');
    process.exit(0);
  }
};

seedDistributors();
