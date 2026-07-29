import mongoose from 'mongoose'

const InterviewBatchSchema = new mongoose.Schema(
  {
    interviewDate: { type: String, required: true, unique: true },
    applicationIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true }],
  },
  { timestamps: true }
)

export default mongoose.model('InterviewBatch', InterviewBatchSchema)
