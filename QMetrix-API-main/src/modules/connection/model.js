import { Schema, ObjectId } from 'mongoose';

const connectionSchema = new Schema(
    {
        _id: { type: ObjectId, auto: true },
        companyId: { type: ObjectId },
        name: { type: String },
        host: { type: String },
        username: { type: String },
        password: { type: String },
        sourceType: { type: String },
        status: { type: Boolean, default: true },
    },
    { versionKey: false, timestamps: true }
);

// Connection lookups typically scoped by tenant and name
connectionSchema.index({ companyId: 1, name: 1 }, { name: 'connection_company_name' });

export const ConnectionModel = (connection) => connection.model('Connection', connectionSchema);
