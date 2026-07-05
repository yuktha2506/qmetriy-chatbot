import { Schema } from 'mongoose';

const companySchema = new Schema(
    {
        companyName: { type: String, required: true, unique: true },
        host: { type: String, required: true, unique: true },
        databaseUri: { type: String, required: true },
        lastSynced: { type: String },
        syncStatus: { type: Boolean },
        roleRates: [
            {
                role: { type: String },
                rate: { type: Number },
            },
            { _id: false },
        ],
        storyPoints: { type: Number },
        isActive: { type: Boolean, default: true },
        isRegistered: { type: Boolean, default: true },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
        holidayList: [
            {
                date: { type: Date, required: true },
                name: { type: String, required: true },
            },
            { _id: false },
        ],
        customFields: [
            {
                key: { type: String, required: true },
                name: { type: String, required: true },
            },
        ],
    },
    { versionKey: false, timestamps: true }
);

// Company lookups scoped by name/host
companySchema.index({ companyName: 1, host: 1 }, { name: 'company_name_host' });

export const CompanyModel = (connection) => connection.model('Company', companySchema);
