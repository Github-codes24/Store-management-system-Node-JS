import { Router } from 'express';
import distributorRouter from './distributor.route.js';
import storeRouter from './store.route.js';

const router = Router();

router.use('/distributors', distributorRouter);
router.use('/stores', storeRouter);

export default router;
