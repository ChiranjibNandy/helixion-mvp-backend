import express from "express";
import { approveUser } from "../controllers/admin.controller.js";


const router = express.Router();

router.patch("/approve/:userId",approveUser)


export default router;