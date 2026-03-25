import { UserResponseDto } from "../dtos/user.dto.js";
import { IUser } from "../interfaces/user.interface.js";

export const mapUserToResponseDto  = (user: IUser): UserResponseDto => {
   return {
      _id: user._id,
      email: user.email,
      username: user.username,
      createdAt: user.createdAt
   }
}