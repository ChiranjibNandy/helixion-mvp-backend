import mongoose from "mongoose";

export const toObjectId = (id: string) =>
  new mongoose.Types.ObjectId(id);