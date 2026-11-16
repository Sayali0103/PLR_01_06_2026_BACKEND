import mongoose from 'mongoose'

const EmployeeDocumentSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  originalName: { type: String, required: true, maxlength: 200 },
  contentType: { type: String, required: true },
  size: { type: Number, required: true },
  uploadedByRole: { type: String, enum: ['admin', 'hr'], required: true },
  data: { type: Buffer, required: true, select: false },
}, { timestamps: true })

EmployeeDocumentSchema.index({ employeeId: 1, createdAt: -1 })

export default mongoose.model('EmployeeDocument', EmployeeDocumentSchema)
