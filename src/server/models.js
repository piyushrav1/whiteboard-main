import mongoose from "mongoose";

const pointSchema = new mongoose.Schema(
  {
    x: { type: Number, required: true },
    y: { type: Number, required: true }
  },
  { _id: false }
);

const styleSchema = new mongoose.Schema(
  {
    color: { type: String, required: true },
    width: { type: Number, required: true }
  },
  { _id: false }
);

const roomSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, default: "Untitled board" },
    strokeCount: { type: Number, default: 0 },
    latestSnapshot: { type: mongoose.Schema.Types.ObjectId, ref: "Snapshot" }
  },
  { timestamps: true }
);

const strokeSchema = new mongoose.Schema(
  {
    strokeID: { type: String, required: true, unique: true },
    roomID: { type: String, required: true, index: true },
    author: {
      id: { type: String, required: true },
      name: { type: String, required: true }
    },
    points: { type: [pointSchema], default: [] },
    style: { type: styleSchema, required: true },
    zIndex: { type: Number, required: true },
    isDeleted: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

const messageSchema = new mongoose.Schema(
  {
    roomID: { type: String, required: true, index: true },
    author: {
      id: { type: String, required: true },
      name: { type: String, required: true }
    },
    body: { type: String, required: true, trim: true, maxlength: 1000 }
  },
  { timestamps: true }
);

const snapshotSchema = new mongoose.Schema(
  {
    roomID: { type: String, required: true, index: true },
    image: { type: String, required: true },
    strokeCount: { type: Number, required: true }
  },
  { timestamps: true }
);

strokeSchema.index({ roomID: 1, zIndex: 1 });
messageSchema.index({ roomID: 1, createdAt: 1 });

export const Room = mongoose.models.Room || mongoose.model("Room", roomSchema);
export const Stroke = mongoose.models.Stroke || mongoose.model("Stroke", strokeSchema);
export const Message = mongoose.models.Message || mongoose.model("Message", messageSchema);
export const Snapshot = mongoose.models.Snapshot || mongoose.model("Snapshot", snapshotSchema);
