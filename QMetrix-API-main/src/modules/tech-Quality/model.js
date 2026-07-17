import { Schema, ObjectId } from 'mongoose';

const techQualitySubSchema = {
    defectEscapeRatio: {
        escapedDefects: { type: Number, default: 0 },
        totalDefects: { type: Number, default: 0 },
        defectEscapeRatio: { type: Number, default: 0 },
    },
    defectAcceptanceRatio: {
        acceptedDefects: { type: Number, default: 0 },
        totalDefects: { type: Number, default: 0 },
        acceptanceRatio: { type: Number, default: 0 },
    },
    bugRate: {
        bugsCreated: { type: Number, default: 0 },
        closedStories: { type: Number, default: 0 },
        bugRateValue: { type: Number, default: 0 },
    },
    timeToResolution: {
        overall: {
            resolvedBugs: { type: Number, default: 0 },
            avgResolutionDays: { type: Number, default: 0 },
            totalResolutionDays: { type: Number, default: 0 },
        },
        bySeverity: {
            critical: {
                resolvedBugs: { type: Number, default: 0 },
                avgResolutionDays: { type: Number, default: 0 },
                totalResolutionDays: { type: Number, default: 0 },
            },
            high: {
                resolvedBugs: { type: Number, default: 0 },
                avgResolutionDays: { type: Number, default: 0 },
                totalResolutionDays: { type: Number, default: 0 },
            },
            medium: {
                resolvedBugs: { type: Number, default: 0 },
                avgResolutionDays: { type: Number, default: 0 },
                totalResolutionDays: { type: Number, default: 0 },
            },
            low: {
                resolvedBugs: { type: Number, default: 0 },
                avgResolutionDays: { type: Number, default: 0 },
                totalResolutionDays: { type: Number, default: 0 },
            },
        },
    },
};

const techQualitySchema = new Schema(
    {
        _id: { type: ObjectId, auto: true },
        projectId: { type: ObjectId, required: true },
        companyId: { type: ObjectId, required: true },
        boardId: { type: ObjectId },
        projectKeyId: { type: Number, required: true },
        periodType: { type: String, required: true },
        periodName: { type: String, required: true },
        year: { type: String, required: true },
        periodStartDate: { type: Date, required: true },
        periodEndDate: { type: Date, required: true },
        totalTicketsStarted: { type: Number, default: 0 },
        techQuality: techQualitySubSchema,
    },
    { versionKey: false, timestamps: true }
);

export const TechQualityModel = (connection) => connection.model('techQuality', techQualitySchema);

const dailyTechQualitySchema = new Schema(
    {
        _id: { type: ObjectId, auto: true },
        projectId: { type: ObjectId, required: true },
        companyId: { type: ObjectId, required: true },
        boardId: { type: ObjectId },
        projectKeyId: { type: Number, required: true },
        dayStartDate: { type: Date, required: true },
        dayEndDate: { type: Date, required: true },
        dayName: { type: String, required: true },
        totalTicketsStarted: { type: Number, default: 0 },
        techQuality: techQualitySubSchema,
    },
    { versionKey: false, timestamps: true }
);

export const DailyTechQualityModel = (connection) => connection.model('dailyTechQuality', dailyTechQualitySchema);
