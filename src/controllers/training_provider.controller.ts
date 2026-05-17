import { NextFunction, Request, Response } from "express";
import { 
   bulkCreateProgramService, 
   createProgramService,
   getDraftProgramsService,
   getDraftByIdService,
   updateDraftService,
   publishDraftService,
   deleteDraftService
} from "../services/training_provider.service.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { AppError } from "../utils/appError.js";

export const createProgram = async (req: Request, res: Response, next: NextFunction) => {
   try {
      const file = req.file;
      const program = await createProgramService({ ...req.body, training_providerId: req.userId, file });

      return res.status(HTTP_STATUS.CREATED).json({
         success: true,
         message: MESSAGES.PROGRAM_CREATED,
         data: program,
      });
   } catch (error) {
      next(error);
   }
};

export const bulkCreateProgram = async (req: Request, res: Response, next: NextFunction) => {
   try {
      if (!req.file) {
         throw new AppError(MESSAGES.CSV_REQUIRED, HTTP_STATUS.BAD_REQUEST);
      }

      const result = await bulkCreateProgramService({
         file: req.file,
         training_providerId: req.userId,
      });

      return res.status(HTTP_STATUS.CREATED).json({
         success: true,
         message: MESSAGES.PROGRAM_CREATED,
         data: result,
      });
   } catch (error) {
      next(error);
   }
};

export const getDraftPrograms = async (req: Request, res: Response, next: NextFunction) => {
   try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search ? String(req.query.search) : undefined;
      const userId = req.userId as string;

      const result = await getDraftProgramsService(userId, page, limit, search);

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: MESSAGES.DRAFT_PROGRAMS_FETCHED,
         data: result
      });
   } catch (error) {
      next(error);
   }
};

export const getDraftById = async (req: Request, res: Response, next: NextFunction) => {
   try {
      const id = req.params.id as string;
      const userId = req.userId as string;

      const program = await getDraftByIdService(id, userId);

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: MESSAGES.DRAFT_PROGRAM_FETCHED,
         data: program
      });
   } catch (error) {
      next(error);
   }
};

export const updateDraft = async (req: Request, res: Response, next: NextFunction) => {
   try {
      const id = req.params.id as string;
      const file = req.file;
      const userId = req.userId as string;

      const program = await updateDraftService(id, userId, req.body, file);

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: MESSAGES.DRAFT_UPDATED,
         data: program
      });
   } catch (error) {
      next(error);
   }
};

export const publishDraft = async (req: Request, res: Response, next: NextFunction) => {
   try {
      const id = req.params.id as string;
      const userId = req.userId as string;

      const program = await publishDraftService(id, userId);

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: MESSAGES.DRAFT_PUBLISHED,
         data: program
      });
   } catch (error) {
      next(error);
   }
};

export const deleteDraft = async (req: Request, res: Response, next: NextFunction) => {
   try {
      const id = req.params.id as string;
      const userId = req.userId as string;

      await deleteDraftService(id, userId);

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: MESSAGES.DRAFT_DELETED
      });
   } catch (error) {
      next(error);
   }
};