import { Router } from 'express';
import validate from '../../middlewares/validate.middleware.js';
import { createStoreEmployeeSchema, storeEmployeeLoginSchema } from '../../validations/store-employee/store-employee.validation.js';
import * as storeEmployeeController from "../../controllers/store-employee/storeEmployee.controller.js";
import adminAuth from '../../middlewares/admin.auth.middleware.js';

const storeEmployeeAuthRouter = Router();


storeEmployeeAuthRouter.post("/register", adminAuth, validate(createStoreEmployeeSchema), storeEmployeeController.register);


storeEmployeeAuthRouter.post("/login", validate(storeEmployeeLoginSchema), storeEmployeeController.login);

export default storeEmployeeAuthRouter;
