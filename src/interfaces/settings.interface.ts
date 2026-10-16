import { Types } from "mongoose";
import { ProfileType } from "../constants/settings.js";

export interface IAddress {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
}

export interface ISettingsProfile {
   _id: Types.ObjectId;
   ownerId: Types.ObjectId;     
   profileType: ProfileType;
   gstNumber:String;
   panNumber:String
   location?: IAddress;
}