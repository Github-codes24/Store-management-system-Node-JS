import connectDB from '../src/config/db.js';
import Admin from '../src/models/admin.model.js';
import mongoose from 'mongoose';

const seedSuperAdmin = async () => {
  try {
    await connectDB();

    const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@storemanagement.com';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@123456';
    const adminName = process.env.SEED_ADMIN_NAME || 'Super Admin';

    const existingAdmin = await Admin.findOne({ email: adminEmail.toLowerCase() });

    if (existingAdmin) {
      console.log(`ℹ️ Admin account (${adminEmail}) already exists.`);
    } else {
      const newAdmin = await Admin.create({
        name: adminName,
        email: adminEmail.toLowerCase(),
        password: adminPassword,
        role: 'superadmin',
        status: 'active',
      });
      console.log(`✅ Super Admin created successfully!`);
      console.log(`   - Name: ${newAdmin.name}`);
      console.log(`   - Email: ${newAdmin.email}`);
      console.log(`   - Role: ${newAdmin.role}`);
    }
  } catch (error) {
    console.error('❌ Error seeding Super Admin:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Database connection closed.');
    process.exit(0);
  }
};

seedSuperAdmin();
