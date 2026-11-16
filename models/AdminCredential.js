import mongoose from 'mongoose'

const AdminCredentialSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['admin', 'hr'], required: true, unique: true },
    passwordHash: { type: String, required: true, select: false },
  },
  { timestamps: true }
)

export default mongoose.model('AdminCredential', AdminCredentialSchema)
