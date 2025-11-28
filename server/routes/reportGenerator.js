import express from 'express';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';
import * as reportLib from '../lib/reportGenerator.js';

const router = express.Router();

// GET /api/report-generator/products
// Returns a flat list of all product variants with pricing
router.get('/products', verifySession(), async (req, res) => {
  try {
    const { includeDiscontinued, manufacturerId, productType } = req.query;
    
    console.log(`📊 GENERATING PRODUCT REPORT [User: ${req.session.getUserId()}]`);
    
    const data = await reportLib.getProductReport({
      includeDiscontinued,
      manufacturerId: manufacturerId || null,
      productType: productType || null
    });
    
    res.json(data);
  } catch (error) {
    console.error('Error generating product report:', error);
    res.status(500).json({ message: 'Failed to generate product report' });
  }
});

// GET /api/report-generator/jobs
// Returns job pipeline data with financial totals
router.get('/jobs', verifySession(), async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;

    const data = await reportLib.getJobReport({
      startDate: startDate || null,
      endDate: endDate || null,
      status: status || null
    });

    res.json(data);
  } catch (error) {
    console.error('Error generating job report:', error);
    res.status(500).json({ message: 'Failed to generate job report' });
  }
});

// GET /api/report-generator/installers
// Returns installer activity and labor revenue stats
router.get('/installers', verifySession(), async (req, res) => {
  try {
    const { startDate, endDate, installerId } = req.query;

    const data = await reportLib.getInstallerReport({
      startDate: startDate || null,
      endDate: endDate || null,
      installerId: installerId || null
    });

    res.json(data);
  } catch (error) {
    console.error('Error generating installer report:', error);
    res.status(500).json({ message: 'Failed to generate installer report' });
  }
});

export default router;