import mongoose from 'mongoose'

const SalarySlipSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
  originalName: { type: String, required: true },
  contentType: { type: String, enum: ['application/pdf'], default: 'application/pdf' },
  data: { type: Buffer, required: true, select: false },
}, { timestamps: true })

SalarySlipSchema.index({ employeeId:  1, month: 1 }, { unique: true })

export default mongoose.model('SalarySlip', SalarySlipSchema)
