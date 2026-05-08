import mongoose from "mongoose";

const uri = "mongodb+srv://piyushrav1:meowmeow@cluster0.5qelsi6.mongodb.net/?appName=Cluster0";

async function test() {
  try {
    console.log("Connecting...");
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log("Connected successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Connection failed:", err.message);
    process.exit(1);
  }
}

test();
