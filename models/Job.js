import mongoose from 'mongoose'

const JobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    dept: { type: String, required: true, trim: true },
    location: { type: String, required: true, default: 'Pune, India' },
    positionType: { type: String, default: 'Full time' },
    overview: { type: String, required: true },
    responsibilities: [{ type: String }],
    requiredSkills: [{ type: String }],
    additionalSkills: [{ type: String }],
    whyJoin: [{ type: String }],
    tags: [{ type: String }],
    applyInternUrl: { type: String, default: '' },
    applyJobUrl: { type: String, default: '' },
    isPaid: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

export default mongoose.model('Job', JobSchema)