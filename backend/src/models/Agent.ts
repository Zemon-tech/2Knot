import mongoose, { Schema, InferSchemaType } from 'mongoose';

const AgentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    slug: { type: String, required: true },
    description: { type: String },
    systemPrompt: { type: String, required: true },
  },
  { timestamps: true }
);

AgentSchema.index({ userId: 1, slug: 1 }, { unique: true });

export type AgentDocument = InferSchemaType<typeof AgentSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const AgentModel = mongoose.model('Agent', AgentSchema);
