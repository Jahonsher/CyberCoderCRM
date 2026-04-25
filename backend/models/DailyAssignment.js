/**
 * CyberCoderCRM - DailyAssignment Model
 * Migratsiya: eski dateString index'ni o'chirish
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

dailyAssignmentSchema.index(
  { businessId: 1, employeeId: 1, date: 1 },
  { unique: true }
);
dailyAssignmentSchema.index({ businessId: 1, date: -1 });
dailyAssignmentSchema.index({ businessId: 1, directionId: 1, date: 1 });

const DailyAssignment = mongoose.models.DailyAssignment || mongoose.model('DailyAssignment', dailyAssignmentSchema);

// MIGRATSIYA: eski dateString index'ni o'chirish
// Faqat birinchi marta serverga ulanganda ishlaydi
async function dropOldIndexes() {
  try {
    const indexes = await DailyAssignment.collection.indexes();
    for (const idx of indexes) {
      // dateString bilan bog'liq eski indexlarni topish
      if (idx.name && (idx.name.includes('dateString') || idx.key?.dateString !== undefined)) {
        console.log(`🗑️  Eski index o'chirilyapti: ${idx.name}`);
        try {
          await DailyAssignment.collection.dropIndex(idx.name);
          console.log(`✅ Index o'chirildi: ${idx.name}`);
        } catch (err) {
          console.error(`❌ Index o'chirib bo'lmadi: ${idx.name}`, err.message);
        }
      }
    }
  } catch (err) {
    // Collection hali yo'q bo'lsa - muammo emas
    if (err.code !== 26 && !err.message?.includes('ns does not exist')) {
      console.error('Index drop xato:', err.message);
    }
  }
}

// MongoDB ulangandan keyin migratsiya
mongoose.connection.once('open', () => {
  dropOldIndexes();
});

// Agar allaqachon ulangan bo'lsa
if (mongoose.connection.readyState === 1) {
  dropOldIndexes();
}

module.exports = DailyAssignment;