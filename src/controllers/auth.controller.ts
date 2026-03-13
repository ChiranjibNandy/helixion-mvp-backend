import { NextFunction, Request, Response } from "express";
import { loginService, signupService } from "../services/auth.service.js";
import { MESSAGES } from "../constants/messages.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

//register the user
export const signup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username,email, password } = req.body;

    const user = await signupService(username,email, password);

    res.status(HTTP_STATUS.CREATED).json({
      success:true,
      message: MESSAGES.USER_CREATED_SUCCESSFULLY,
      user,
    });
  } catch (error: any) {
    next(error)
  }
};

//login the user
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const user = await loginService(email, password);
    res.status(HTTP_STATUS.OK).json({
      success:true,
      message: MESSAGES.USER_LOGGED_IN_SUCCESSFULLY,
      user
    });
  } catch (error: any) {
    next(error)
  }
}