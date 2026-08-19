import mongoose from 'mongoose';
import env from './env.js';

let isConnected = false;

const connectDB = async () => {
  try {
    if (isConnected || mongoose.connection.readyState === 1) {
      console.log('MongoDB already connected');
      return;
    }

    const conn = await mongoose.connect(env.MONGO_URI, {
      autoIndex: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    isConnected = true;

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
};

mongoose.connection.on('connected', () => {
  console.log('📡 Mongoose connected');
});

mongoose.connection.on('error', (err) => {
  console.error('🚨 Mongoose error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ Mongoose disconnected');
});

export default connectDB;
