/**
 * CyberCoderCRM - SalaryPayment Model
 * Endi: assignmentId orqali aniq kunga bog'lanadi
 */

const mongoose = require('mongoose');

const salaryPaymentSchema = new mongoose.Schema(
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
      index: true,
    },
    // Aynan qaysi kunga to'lov - DailyAssignment'dan
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DailyAssignment',
      required: true,
      index: true,
    },
    // Kun (qulaylik uchun)
    dateString: {
      type: String,
      required: true,
      index: true,
    },
    // Snapshot
    employeeSnapshot: {
      firstName: String,
      lastName: String,
      code: String,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paidAt: {
      type: Date,
      default: Date.now,
    },
    note: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Bir assignment uchun faqat bir to'lov
salaryPaymentSchema.index(
  { businessId: 1, assignmentId: 1 },
  { unique: true }
);
salaryPaymentSchema.index({ businessId: 1, employeeId: 1, dateString: 1 });
salaryPaymentSchema.index({ businessId: 1, paidAt: -1 });

const SalaryPayment = mongoose.models.SalaryPayment || mongoose.model('SalaryPayment', salaryPaymentSchema);

// MIGRATSIYA: eski periodMonth indexni o'chirish
async function migrateOldIndexes() {
  try {
    const indexes = await SalaryPayment.collection.indexes();
    for (const idx of indexes) {
      // Eski periodMonth index o'chirish
      if (idx.key && (idx.key.periodMonth !== undefined) && idx.unique) {
        console.log(`🗑️  Eski SalaryPayment index o'chirilyapti: ${idx.name}`);
        try {
          await SalaryPayment.collection.dropIndex(idx.name);
          console.log(`✅ O'chirildi: ${idx.name}`);
        } catch (e) {
          console.error(`Drop xato: ${idx.name}`, e.message);
        }
      }
    }
  } catch (err) {
    if (err.code !== 26 && !err.message?.includes('ns does not exist')) {
      console.error('SalaryPayment migratsiya xato:', err.message);
    }
  }
}

mongoose.connection.once('open', () => {
  migrateOldIndexes();
});

if (mongoose.connection.readyState === 1) {
  migrateOldIndexes();
}

module.exports = SalaryPayment;