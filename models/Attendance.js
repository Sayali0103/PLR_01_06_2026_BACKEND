import mongoose from 'mongoose'

const AttendanceSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    status: { type: String, enum: ['present', 'absent'], required: true },
  },
  { timestamps: true }
)

AttendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true })

export default mongoose.model('Attendance', AttendanceSchema)
