import { Types } from "mongoose";

export interface UserResponseDto {
   _id?: Types.ObjectId
   username: string,
   email: string,
   createdAt?: Date;
}

export interface CreateUserDto {
   username: string,
   email: string,
   password: string
}

export interface BulkProcessUserDto {
   email: string;
   role: string;
   action: string;
}
