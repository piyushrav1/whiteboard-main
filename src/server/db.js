import mongoose from "mongoose";

let connectionPromise;

export async function connectMongo() {
  if (mongoose.connection.readyState >= 1) return mongoose.connection;

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required");
  }

  connectionPromise ??= mongoose.connect(process.env.MONGODB_URI, {
    bufferCommands: false,
    dbName: "whiteboard-codex"
  });

  await connectionPromise;
  return mongoose.connection;
}
