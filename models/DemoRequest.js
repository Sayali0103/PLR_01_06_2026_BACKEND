import mongoose from 'mongoose'

const DemoRequestSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 80 },
    lastName: { type: String, required: true, trim: true, maxlength: 80 },
    companyName: { type: String, required: true, trim: true, maxlength: 160 },
    companyEmail: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
    companyAddress: { type: String, required: true, trim: true, maxlength: 500 },
    companyContact: { type: String, required: true, trim: true, maxlength: 30 },
    interestedIn: { type: String, required: true, trim: true, maxlength: 160 },
    industryType: { type: String, required: true, trim: true, maxlength: 160 },
    application: { type: String, required: true, trim: true, maxlength: 2000 },
    status: {
      type: String,
      enum: ['new', 'contacted', 'scheduled', 'closed'],
      default: 'new',
    },
  },
  { timestamps: true }
)

export default mongoose.model('DemoRequest', DemoRequestSchema)
