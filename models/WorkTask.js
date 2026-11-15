import mongoose from 'mongoose'

const WorkTaskSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    dueDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    status: { type: String, enum: ['assigned', 'in_progress', 'completed'], default: 'assigned' },
    updateNote: { type: String, trim: true, maxlength: 1000, default: '' },
    employeeUpdatedAt: { type: Date },
  },
  { timestamps: true }
)

WorkTaskSchema.index({ employeeId: 1, createdAt: -1 })

export default mongoose.model('WorkTask', WorkTaskSchema)
