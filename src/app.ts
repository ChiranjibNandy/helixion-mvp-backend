import express from "express";
import authRoutes from './routes/auth.routes.js'
import adminRoutes from './routes/admin.routes.js'
import employeeRoutes from './routes/employee.routes.js'
import { corsMiddleware } from "./middlewares/cors.middleware.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";

const app = express();

app.use(corsMiddleware);
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/admin",adminRoutes)
app.use("/api/employee",employeeRoutes)

app.use(errorMiddleware);

export default app;