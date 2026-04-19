const mongoose = require('mongoose');

/**
 * MongoDB Atlas ga ulanish
 * Muvaffaqiyatli ulanish yoki xato holatida log chiqaradi
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });

    console.log(`✅ MongoDB ulandi: ${conn.connection.host}`);
    console.log(`📦 Database: ${conn.connection.name}`);

    // Ulanish uzilib qolganda
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB ulanish uzildi');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB qayta ulandi');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB xatosi:', err.message);
    });
  } catch (error) {
    console.error('❌ MongoDB ga ulanishda xato:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;