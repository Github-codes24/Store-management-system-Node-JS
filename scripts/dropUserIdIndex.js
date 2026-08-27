import dns from 'node:dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (err) {
  console.warn('Failed to set custom DNS servers:', err.message);
}

import mongoose from 'mongoose';
import env from '../src/config/env.js';

const dropIndex = async () => {
  try {
    await mongoose.connect(env.MONGO_URI);
    console.log('📡 Connected to MongoDB:', env.MONGO_URI);
    
    const collection = mongoose.connection.collection('storeemployees');
    const indexes = await collection.indexes();
    console.log('📊 Current indexes:', indexes.map(idx => idx.name));
    
    const hasUserIdIndex = indexes.some(idx => idx.name === 'userId_1');
    if (hasUserIdIndex) {
      await collection.dropIndex('userId_1');
      console.log('✅ Successfully dropped unique index userId_1');
    } else {
      console.log('ℹ️ Index userId_1 not found, nothing to drop');
    }

    const hasUserIdDeletedIndex = indexes.some(idx => idx.name === 'userId_1_isDeleted_1');
    if (hasUserIdDeletedIndex) {
      await collection.dropIndex('userId_1_isDeleted_1');
      console.log('✅ Successfully dropped unique index userId_1_isDeleted_1');
    } else {
      console.log('ℹ️ Index userId_1_isDeleted_1 not found, nothing to drop');
    }
  } catch (error) {
    console.error('❌ Error dropping index:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected');
  }
};

dropIndex();
