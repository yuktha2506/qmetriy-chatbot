import { Schema, ObjectId } from 'mongoose';

const userSchema = new Schema(
    {
        _id: { type: ObjectId, auto: true },
        name: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        password: { type: String },
        role: { type: String },
        companyId: { type: ObjectId, required: true },
        companyName: { type: String, required: true },
        isActive: { type: Boolean, default: true },
        createdBy: { type: String },
        lastLoggedIn: { type: Date },
    },
    { versionKey: false, timestamps: true }
);

// User listings scoped by tenant and active flag
userSchema.index({ companyId: 1, isActive: 1 }, { name: 'user_company_isActive' });

export const UserModel = (connection) => connection.model('User', userSchema);
