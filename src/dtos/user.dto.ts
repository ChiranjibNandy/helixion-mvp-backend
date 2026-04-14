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

export interface BatchCreateUserDto {
   username: string;
   email: string;
   password: string;
   role: string;
   description?: string;
}
