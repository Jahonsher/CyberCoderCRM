/**
 * CyberCoderCRM - DailyProduct Model
 * dateString (YYYY-MM-DD) bilan timezone safe
 */

const mongoose = require('mongoose');

const dailyProductSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    directionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Direction',
      required: false,
      index: true,
    },
    dateString: {
      type: String,
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    directionSnapshot: {
      name: String,
      price: Number,
    },
  },
  {
    timestamps: true,
  }
);

dailyProductSchema.index({ businessId: 1, dateString: -1 });

const DailyProduct = mongoose.models.DailyProduct || mongoose.model('DailyProduct', dailyProductSchema);

// Migratsiya - eski productlarga dateString qo'shish
async function migrateProducts() {
  try {
    const docs = await DailyProduct.find({
      $or: [
        { dateString: null },
        { dateString: { $exists: false } },
        { dateString: '' },
      ]
    });

    if (docs.length > 0) {
      console.log(`🔄 ${docs.length} ta eski mahsulotga dateString qo'shilyapti...`);
      for (const doc of docs) {
        if (doc.date) {
          const d = new Date(doc.date);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          doc.dateString = `${y}-${m}-${day}`;
          await doc.save();
        }
      }
      console.log(`✅ DailyProduct migratsiya tugadi`);
    }
  } catch (err) {
    if (err.code !== 26 && !err.message?.includes('ns does not exist')) {
      console.error('DailyProduct migratsiya xato:', err.message);
    }
  }
}

mongoose.connection.once('open', () => {
  migrateProducts();
});

if (mongoose.connection.readyState === 1) {
  migrateProducts();
}

module.exports = DailyProduct;