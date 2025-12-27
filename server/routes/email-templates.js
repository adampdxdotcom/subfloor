import express from 'express';
import pool from '../db.js'; // FIX: Default import 'pool', not named 'sql'
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';
import { verifyRole } from '../utils.js';
import { sendEmail } from '../lib/emailService.js';

const router = express.Router();

// Middleware: Admin access required for these settings
router.use(verifySession());
router.use(verifyRole('Admin'));

// GET /api/email-templates - List all templates (metadata only)
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT key, subject, description, available_variables, updated_at 
      FROM email_templates 
      ORDER BY key ASC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching email templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// GET /api/email-templates/:key - Get full details including content
router.get('/:key', async (req, res) => {
  const { key } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT * FROM email_templates WHERE key = $1`, 
      [key]
    );
    
    if (rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    res.json(rows[0]);
  } catch (error) {
    console.error(`Error fetching template ${key}:`, error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// PUT /api/email-templates/:key - Update content
router.put('/:key', async (req, res) => {
  const { key } = req.params;
  const { subject, body_content } = req.body;
  const userId = req.session.getUserId();

  // Use the SuperTokens User ID directly (Table column updated to VARCHAR)
  const dbUserId = userId;

  try {
    const { rows } = await pool.query(`
      UPDATE email_templates 
      SET 
        subject = $1, 
        body_content = $2, 
        updated_at = NOW(),
        updated_by = $3
      WHERE key = $4
      RETURNING *
    `, [subject, body_content, dbUserId, key]);
    
    res.json(rows[0]);
  } catch (error) {
    console.error(`Error updating template ${key}:`, error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// POST /api/email-templates/:key/test - Send a test email
router.post('/:key/test', async (req, res) => {
  const { key } = req.params;
  const { email } = req.body;

  if (!email) return res.status(400).json({ error: 'Email address is required' });

  try {
    const { rows } = await pool.query(`SELECT subject, body_content FROM email_templates WHERE key = $1`, [key]);
    
    if (rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    const template = rows[0];

    let subject = `[TEST] ${template.subject}`;
    let html = template.body_content || '<p><em>No custom content saved. Using system default.</em></p>';

    // Mock Variables
    const mockData = {
      customer_name: "John Doe",
      job_name: "Kitchen Reno",
      date: "Oct 15, 2025",
      start_time: "9:00 AM",
      address: "123 Main St",
      items_list: "<ul><li>Sample A</li><li>Sample B</li></ul>",
      company_name: "Your Company",
      order_number: "PO-999",
      supplier_name: "Test Supplier",
      invite_link: "http://example.com/join",
      role: "Installer"
    };

    Object.keys(mockData).forEach(k => {
      const regex = new RegExp(`{{${k}}}`, 'g');
      html = html.replace(regex, mockData[k]);
      subject = subject.replace(regex, mockData[k]);
    });

    await sendEmail({
      to: email,
      subject: subject,
      html: html
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

export default router;