/**
 * CyberCoderCRM - Direction Model
 * Endi har yo'nalishda 2 ta type: piecework va daily
 * Har biri alohida yoqilishi/o'chirilishi va narxi belgilanishi mumkin
 */

const mongoose = require('mongoose');

const directionSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    // ESKI MAYDON - migratsiya uchun saqlanadi
    currentPrice: {
      type: Number,
      default: 0,
    },

    // YANGI: Shtuk turi
    pieceworkEnabled: {
      type: Boolean,
      default: true,
    },
    pieceworkPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    // YANGI: Kunlik turi
    dailyEnabled: {
      type: Boolean,
      default: false,
    },
    dailyPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

directionSchema.index({ businessId: 1, status: 1 });
directionSchema.index({ businessId: 1, departmentId: 1 });

const Direction = mongoose.models.Direction || mongoose.model('Direction', directionSchema);

// MIGRATSIYA: eski currentPrice -> pieceworkPrice
async function migrateDirections() {
  try {
    // pieceworkPrice = 0 va currentPrice > 0 bo'lganlarni topish
    const docs = await Direction.find({
      $and: [
        { currentPrice: { $gt: 0 } },
        {
          $or: [
            { pieceworkPrice: 0 },
            { pieceworkPrice: { $exists: false } },
          ]
        }
      ]
    });

    if (docs.length > 0) {
      console.log(`🔄 ${docs.length} ta yo'nalishni migratsiya qilmoqdaman...`);
      for (const doc of docs) {
        doc.pieceworkPrice = doc.currentPrice;
        doc.pieceworkEnabled = true;
        if (doc.dailyPrice === undefined || doc.dailyPrice === null) doc.dailyPrice = 0;
        if (doc.dailyEnabled === undefined || doc.dailyEnabled === null) doc.dailyEnabled = false;
        await doc.save();
      }
      console.log(`✅ Direction migratsiya tugadi`);
    }
  } catch (err) {
    if (err.code !== 26 && !err.message?.includes('ns does not exist')) {
      console.error('Direction migratsiya xato:', err.message);
    }
  }
}

mongoose.connection.once('open', () => {
  migrateDirections();
});

if (mongoose.connection.readyState === 1) {
  migrateDirections();
}

module.exports = Direction;