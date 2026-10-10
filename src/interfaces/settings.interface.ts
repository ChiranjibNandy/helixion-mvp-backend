import { Types } from "mongoose";
import { ProfileType } from "../constants/settings.js";

export interface ISettingsProfile {
   _id: Types.ObjectId;
   ownerId: Types.ObjectId;     
   profileType: ProfileType;
   gstNumber:String;
   panNumber:String
}