/**
 * CyberCoderCRM - SuperAdmin Model
 */

const mongoose = require('mongoose');

const superAdminSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,  // unique o'zi index yaratadi
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 50,
    },
    password: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// OverwriteModelError himoyasi
module.exports = mongoose.models.SuperAdmin || mongoose.model('SuperAdmin', superAdminSchema);