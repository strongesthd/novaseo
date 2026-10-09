import { Router } from 'express';
import projectRoutes from './project-routes.js';
import keywordRoutes from './keyword-routes.js';
import contentRoutes from './content-routes.js';
import jobRoutes from './job-routes.js';
import { createSeoRouter } from './seo-route-factory.js';

const router = Router();
router.use('/projects', projectRoutes);
router.use('/keywords', keywordRoutes);
router.use('/content', contentRoutes);
router.use('/jobs', jobRoutes);
router.use('/', createSeoRouter());

export default router;
