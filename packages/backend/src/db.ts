import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDb(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGODB_URI);
  return mongoose;
}

export default connectDb;
