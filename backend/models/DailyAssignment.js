/**
 * CyberCoderCRM - DailyAssignment Model
 *
 * MUHIM: dateString = "YYYY-MM-DD" string format
 * Bu timezone muammolarini butunlay hal qiladi.
 * Date object ham saqlanadi (qulaylik uchun), lekin asosiy unique key - dateString.
 */

const mongoose = require('mongoose');

const dailyAssignmentSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    directionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Direction',
      required: true,
    },
    // Asosiy sana - YYYY-MM-DD string format (timezone safe)
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
    shift: {
      type: Number,
      required: true,
      enum: [0.5, 1],
      default: 1,
    },
    type: {
      type: String,
      enum: ['piecework', 'daily'],
      default: 'piecework',
    },
    dailyAmount: {
      type: Number,
      default: 0,
    },
    priceSnapshot: {
      type: Number,
      required: true,
    },
    earning: {
      type: Number,
      required: true,
      default: 0,
    },
    fairShare: {
      type: Number,
      default: 0,
    },
    bonus: {
      type: Number,
      default: 0,
    },
    isManual: {
      type: Boolean,
      default: false,
    },
    manualAmount: {
      type: Number,
      default: null,
    },
    employeeSnapshot: {
      firstName: String,
      lastName: String,
      code: String,
    },
    directionSnapshot: {
      name: String,
      departmentName: String,
    },
  },
  {
    timestamps: true,
  }
);

// dateString bilan unique - timezone safe
dailyAssignmentSchema.index(
  { businessId: 1, employeeId: 1, dateString: 1 },
  { unique: true }
);
dailyAssignmentSchema.index({ businessId: 1, dateString: -1 });
dailyAssignmentSchema.index({ businessId: 1, directionId: 1, dateString: 1 });

const DailyAssignment = mongoose.models.DailyAssignment || mongoose.model('DailyAssignment', dailyAssignmentSchema);

// MIGRATSIYA: eski indexlarni va eski sanalarni tuzatish
async function runMigration() {
  try {
    // 1. Eski indexlarni o'chirish
    const indexes = await DailyAssignment.collection.indexes();
    for (const idx of indexes) {
      const isOldDateIndex =
        (idx.key && idx.key.date !== undefined && idx.unique) || // eski date+unique
        (idx.name && idx.name.includes('employeeId_1_date_1') && idx.unique);

      if (isOldDateIndex) {
        console.log(`🗑️  Eski index o'chirilyapti: ${idx.name}`);
        try {
          await DailyAssignment.collection.dropIndex(idx.name);
          console.log(`✅ O'chirildi: ${idx.name}`);
        } catch (e) {
          console.error(`Index drop xato: ${idx.name}`, e.message);
        }
      }
    }

    // 2. dateString yo'q biriktirishlarni topib, qo'shish
    const docs = await DailyAssignment.find({
      $or: [
        { dateString: null },
        { dateString: { $exists: false } },
        { dateString: '' },
      ]
    });

    if (docs.length > 0) {
      console.log(`🔄 ${docs.length} ta eski biriktirishga dateString qo'shilyapti...`);
      for (const doc of docs) {
        if (doc.date) {
          const d = new Date(doc.date);
          // Lokal sana asosida YYYY-MM-DD
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          doc.dateString = `${y}-${m}-${day}`;
          await doc.save();
        }
      }
      console.log(`✅ Migratsiya tugadi`);
    }
  } catch (err) {
    if (err.code !== 26 && !err.message?.includes('ns does not exist')) {
      console.error('Migratsiya xato:', err.message);
    }
  }
}

mongoose.connection.once('open', () => {
  runMigration();
});

if (mongoose.connection.readyState === 1) {
  runMigration();
}

module.exports = DailyAssignment;