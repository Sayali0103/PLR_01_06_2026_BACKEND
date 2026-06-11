import mongoose from 'mongoose'

const ApplicationSchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    jobTitle: { type: String, required: true },
    applicantType: { type: String, enum: ['intern', 'fulltime'], required: true },

    firstName: { type: String, required: true, trim: true },
    middleName: { type: String, trim: true },
    lastName: { type: String, required: true, trim: true },
    dob: { type: String, required: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    currentLocation: { type: String, trim: true },
    currentlyEmployed: { type: Boolean, default: false },
    employerDetails: { type: String, trim: true },

    // Resume attachment
    attachmentFileName: { type: String, trim: true },
    attachmentFilePath: { type: String, trim: true },
    attachmentDriveFileId: { type: String, trim: true },
    attachmentDriveLink: { type: String, trim: true },

    // Project attachment
    projectFileName: { type: String, trim: true },
    projectFilePath: { type: String, trim: true },
    projectDriveFileId: { type: String, trim: true },
    projectDriveLink: { type: String, trim: true },

    status: {
      type: String,
      enum: ['new', 'reviewing', 'shortlisted', 'rejected'],
      default: 'new',
    },
    atsScore: { type: Number, min: 0, max: 10 },
    atsScoredAt: { type: Date },
  },
  { timestamps: true }
)

export default mongoose.model('Application', ApplicationSchema)
