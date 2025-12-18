import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../db.js';
import { toCamelCase, logActivity, verifyRole } from '../utils.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';
import { sendEmail } from '../lib/emailService.js';
import { processImage } from '../lib/imageProcessor.js'; // NEW IMPORT

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadRoot = path.join(__dirname, '../uploads');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadRoot),
    filename: (req, file, cb) => {
        cb(null, `temp-${Date.now()}-${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage });

// Helper to get full order details including line items and joined entities
const getFullOrderById = async (orderId, client = pool) => {
    const query = `
        SELECT
            mo.id, mo.project_id, mo.supplier_id, v.name as supplier_name, 
            mo.order_date, mo.eta_date, mo.date_received, mo.purchaser_type, mo.status, mo.notes, mo.parent_order_id,
            p.project_name,
            j.po_number,
            c.full_name as customer_name, c.email as customer_email,
            i.installer_name, i.contact_email as installer_email,
            COALESCE(
                (SELECT json_agg(json_build_object(
                    'id', oli.id, 'quantity', oli.quantity, 'unit', oli.unit, 'totalCost', oli.total_cost, 
                    'unitPriceSold', oli.unit_price_sold,
                    'variantId', v.id, 
                    'style', p.name,       -- Parent Name
                    'color', v.name,       -- Variant Name (Color)
                    'manufacturerName', m.name
                )) 
                FROM order_line_items oli 
                JOIN product_variants v ON oli.variant_id = v.id
                JOIN products p ON v.product_id = p.id
                LEFT JOIN vendors m ON p.manufacturer_id = m.id
                WHERE oli.order_id = mo.id),
                '[]'::json
            ) AS line_items
        FROM material_orders mo
        LEFT JOIN vendors v ON mo.supplier_id = v.id
        JOIN projects p ON mo.project_id = p.id
        LEFT JOIN jobs j ON j.project_id = p.id
        JOIN customers c ON p.customer_id = c.id
        -- Attempt to find the assigned installer via an Accepted Quote
        LEFT JOIN LATERAL (
            SELECT i.installer_name, i.contact_email
            FROM quotes q
            JOIN installers i ON q.installer_id = i.id
            WHERE q.project_id = p.id AND q.status = 'Accepted'
            ORDER BY q.id DESC
            LIMIT 1
        ) i ON true
        WHERE mo.id = $1;
    `;
    const result = await client.query(query, [orderId]);
    return result.rows.length > 0 ? toCamelCase(result.rows[0]) : null;
};

// GET Orders (All or by Project)
router.get('/', verifySession(), async (req, res) => {
    const { projectId } = req.query;
    
    const baseQuery = `
        SELECT
            mo.id, mo.project_id, mo.supplier_id, v.name as supplier_name, 
            mo.order_date, mo.eta_date, mo.date_received, mo.purchaser_type, mo.status, mo.notes, mo.parent_order_id,
            p.project_name,
            j.po_number,
            c.full_name as customer_name, c.email as customer_email,
            i.installer_name, i.contact_email as installer_email,
            COALESCE(
                (
                    SELECT json_agg(json_build_object(
                        'id', oli.id, 'quantity', oli.quantity, 'unit', oli.unit,
                        'unitPriceSold', oli.unit_price_sold,
                        'totalCost', oli.total_cost, 'variantId', v.id, 
                        'style', p.name,
                        'color', v.name,
                        'manufacturerName', m.name
                    ))
                    FROM order_line_items oli
                    JOIN product_variants v ON oli.variant_id = v.id
                    JOIN products p ON v.product_id = p.id
                    LEFT JOIN vendors m ON p.manufacturer_id = m.id
                    WHERE oli.order_id = mo.id
                ),
                '[]'::json
            ) AS line_items
        FROM material_orders mo 
        LEFT JOIN vendors v ON mo.supplier_id = v.id
        JOIN projects p ON mo.project_id = p.id
        LEFT JOIN jobs j ON j.project_id = p.id
        JOIN customers c ON p.customer_id = c.id
        LEFT JOIN LATERAL (
            SELECT i.installer_name, i.contact_email
            FROM quotes q
            JOIN installers i ON q.installer_id = i.id
            WHERE q.project_id = p.id AND q.status = 'Accepted'
            ORDER BY q.id DESC
            LIMIT 1
        ) i ON true
    `;

    try {
        let result;
        if (projectId) {
            result = await pool.query(`${baseQuery} WHERE mo.project_id = $1 ORDER BY mo.order_date DESC;`, [projectId]);
        } else {
            // For Dashboard: Active first, then by date
            result = await pool.query(`${baseQuery} ORDER BY CASE WHEN mo.status = 'Ordered' THEN 0 ELSE 1 END, mo.order_date DESC;`);
        }
        res.json(result.rows.map(toCamelCase));
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// CREATE Order
router.post('/', verifySession(), async (req, res) => {
    const userId = req.session.getUserId();
    const { projectId, supplierId, etaDate, purchaserType, lineItems, notes } = req.body;
    
    if (!projectId || !lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
        return res.status(400).json({ error: 'projectId and lineItems are required.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const orderInsertQuery = `
            INSERT INTO material_orders (project_id, supplier_id, eta_date, purchaser_type, status, notes)
            VALUES ($1, $2, $3, $4, 'Ordered', $5) RETURNING id;
        `;
        const orderResult = await client.query(orderInsertQuery, [projectId, supplierId, etaDate || null, purchaserType || 'Customer', notes || '']);
        const orderId = orderResult.rows[0].id;

        for (const item of lineItems) {
            const { variantId, quantity, unit, totalCost, unitPriceSold } = item; // CHANGED
            await client.query(`
                INSERT INTO order_line_items (order_id, variant_id, quantity, unit, total_cost, unit_price_sold)
                VALUES ($1, $2, $3, $4, $5, $6);
            `, [orderId, variantId, quantity, unit || null, totalCost || null, unitPriceSold || null]);
        }

        await client.query('COMMIT');
        
        const newOrder = await getFullOrderById(orderId, client);
        await logActivity(userId, 'CREATE', 'MATERIAL_ORDER', orderId, { createdData: newOrder });
        res.status(201).json(newOrder);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Transaction failed:', err.message);
        res.status(500).json({ error: 'Failed to create order.' });
    } finally {
        client.release();
    }
});

// UPDATE Order (General Edit)
router.put('/:id', verifySession(), async (req, res) => {
    const { id: orderId } = req.params;
    const userId = req.session.getUserId();
    const { supplierId, etaDate, purchaserType, lineItems, notes } = req.body;

    const client = await pool.connect();
    try {
        const beforeData = await getFullOrderById(orderId);
        if (!beforeData) return res.status(404).json({ error: 'Order not found' });

        await client.query('BEGIN');
        
        await client.query(`
            UPDATE material_orders SET supplier_id = $1, eta_date = $2, purchaser_type = $3, notes = $4 WHERE id = $5;
        `, [supplierId, etaDate || null, purchaserType || 'Customer', notes || '', orderId]);

        await client.query('DELETE FROM order_line_items WHERE order_id = $1', [orderId]);
        for (const item of lineItems) {
            const { variantId, quantity, unit, totalCost, unitPriceSold } = item; // CHANGED
            await client.query(`
                INSERT INTO order_line_items (order_id, variant_id, quantity, unit, total_cost, unit_price_sold)
                VALUES ($1, $2, $3, $4, $5, $6);
            `, [orderId, variantId, quantity, unit || null, totalCost || null, unitPriceSold || null]);
        }

        await client.query('COMMIT');
        const updatedOrder = await getFullOrderById(orderId, client);
        await logActivity(userId, 'UPDATE', 'MATERIAL_ORDER', orderId, { before: beforeData, after: updatedOrder });
        res.status(200).json(updatedOrder);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Update transaction failed:', err.message);
        res.status(500).json({ error: 'Failed to update order.' });
    } finally {
        client.release();
    }
});

// DELETE Order
router.delete('/:id', verifySession(), verifyRole('Admin'), async (req, res) => {
    const { id: orderId } = req.params;
    const userId = req.session.getUserId();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const deletedData = await getFullOrderById(orderId, client);
        if (!deletedData) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Material order not found.' });
        }
        await client.query('DELETE FROM order_line_items WHERE order_id = $1', [orderId]);
        await client.query('DELETE FROM material_orders WHERE id = $1', [orderId]);
        await logActivity(userId, 'DELETE', 'MATERIAL_ORDER', orderId, { deletedData });
        await client.query('COMMIT');
        res.status(204).send();
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error deleting material order:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

// --- NEW: RECEIVE ORDER & REPORT DAMAGE ---

// 1. RECEIVE ORDER
router.post('/:id/receive', verifySession(), upload.array('paperwork', 5), async (req, res) => {
    const { id: orderId } = req.params;
    const userId = req.session.getUserId();
    let { dateReceived, notes, sendEmailNotification } = req.body;
    
    // Fix FormData boolean string conversion
    const shouldSendEmail = sendEmailNotification === 'true' || sendEmailNotification === true;

    const client = await pool.connect();
    try {
        const beforeData = await getFullOrderById(orderId, client);
        if (!beforeData) return res.status(404).json({ error: 'Order not found' });

        await client.query('BEGIN');

        // Update Status
        const updateQuery = `
            UPDATE material_orders 
            SET status = 'Received', date_received = $1, notes = $2
            WHERE id = $3 RETURNING *;
        `;
        await client.query(updateQuery, [dateReceived || new Date(), notes || '', orderId]);

        const updatedOrder = await getFullOrderById(orderId, client);
        await logActivity(userId, 'UPDATE', 'MATERIAL_ORDER', orderId, { 
            action: 'RECEIVED', 
            before: beforeData, 
            after: updatedOrder 
        });

        // --- NEW: Process & Save Uploaded Paperwork ---
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                // Save as DOCUMENT type linked to the PROJECT
                const { imageUrl, thumbnailUrl, fileName, mimeType } = await processImage(file, 'jobs', 'doc');
                
                if (imageUrl) {
                    await client.query(
                        `INSERT INTO photos (url, thumbnail_url, file_name, mime_type, category, entity_type, entity_id) 
                         VALUES ($1, $2, $3, $4, 'DOCUMENT', 'PROJECT', $5)`,
                        [imageUrl, thumbnailUrl, fileName, mimeType, updatedOrder.projectId]
                    );
                }
            }
        }
        // ----------------------------------------------

        await client.query('COMMIT');

        // Send Email Notification (if requested)
        if (shouldSendEmail && updatedOrder) {
            let recipientEmail = null;
            let recipientName = null;

            if (updatedOrder.purchaserType === 'Installer' && updatedOrder.installerEmail) {
                recipientEmail = updatedOrder.installerEmail;
                recipientName = updatedOrder.installerName;
            } else if (updatedOrder.customerEmail) {
                recipientEmail = updatedOrder.customerEmail;
                recipientName = updatedOrder.customerName;
            }

            if (recipientEmail) {
                try {
                    await sendEmail(recipientEmail, 'Your Order Has Arrived', 'orderReceived', {
                        customerName: recipientName,
                        projectName: updatedOrder.projectName,
                        lineItems: updatedOrder.lineItems,
                        orderId: updatedOrder.id,
                        notes: notes
                    });
                } catch (emailErr) {
                    console.error('Failed to send receipt email:', emailErr);
                    // Don't fail the request if email fails
                }
            }
        }

        res.status(200).json(updatedOrder);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Receive transaction failed:', err.message);
        res.status(500).json({ error: 'Failed to receive order.' });
    } finally {
        client.release();
    }
});

// 2. REPORT DAMAGE (Creates Replacement Order)
router.post('/:id/damage', verifySession(), upload.array('damagePhotos', 10), async (req, res) => {
    const { id: originalOrderId } = req.params;
    const userId = req.session.getUserId();
    // Parse 'items' because FormData sends it as a string
    let { items, replacementEta, notes, sendEmailNotification } = req.body;
    
    if (typeof items === 'string') items = JSON.parse(items);
    // Fix FormData boolean string conversion
    const shouldSendEmail = sendEmailNotification === 'true' || sendEmailNotification === true;

    if (!items || items.length === 0) return res.status(400).json({ error: 'No damage items specified.' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const originalOrder = await getFullOrderById(originalOrderId, client);
        if (!originalOrder) throw new Error('Original order not found');

        // 1. Create new Replacement Order
        const createOrderQuery = `
            INSERT INTO material_orders (
                project_id, supplier_id, eta_date, purchaser_type, status, notes, parent_order_id
            ) VALUES ($1, $2, $3, $4, 'Damage Replacement', $5, $6) RETURNING id;
        `;
        const newOrderRes = await client.query(createOrderQuery, [
            originalOrder.projectId, 
            originalOrder.supplierId, 
            replacementEta || null, 
            originalOrder.purchaserType, 
            notes || 'Replacement for damaged goods', 
            originalOrderId
        ]);
        const newOrderId = newOrderRes.rows[0].id;

        // 2. Add Line Items to Replacement Order
        for (const item of items) {
            await client.query(`
                INSERT INTO order_line_items (order_id, variant_id, quantity, unit, total_cost, unit_price_sold)
                VALUES ($1, $2, $3, $4, 0.00, 0.00); -- Usually replacements are free cost-wise in the system until adjusted
            `, [newOrderId, item.variantId, item.quantity, item.unit]);
        }

        // 3. Ensure Original Order is Marked Received (if not already)
        if (originalOrder.status !== 'Received') {
            await client.query(`
                UPDATE material_orders SET status = 'Received', date_received = CURRENT_DATE WHERE id = $1;
            `, [originalOrderId]);
        }

        await client.query('COMMIT');

        const newOrder = await getFullOrderById(newOrderId, client);
        const updatedOriginal = await getFullOrderById(originalOrderId, client);

        await logActivity(userId, 'CREATE', 'MATERIAL_ORDER', newOrderId, { 
            type: 'DAMAGE_REPLACEMENT',
            originalOrderId: originalOrderId,
            createdData: newOrder 
        });

        // --- NEW: Process Damage Photos ---
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                // Add "DAMAGE" prefix to filename for clarity in the document list
                file.originalname = `DAMAGE - ${file.originalname}`;
                const { imageUrl, thumbnailUrl, fileName, mimeType } = await processImage(file, 'jobs', 'doc');
                
                if (imageUrl) {
                    await client.query(
                        `INSERT INTO photos (url, thumbnail_url, file_name, mime_type, category, entity_type, entity_id) 
                         VALUES ($1, $2, $3, $4, 'DOCUMENT', 'PROJECT', $5)`,
                        [imageUrl, thumbnailUrl, fileName, mimeType, originalOrder.projectId]
                    );
                }
            }
        }
        // ----------------------------------

        // --- NEW: Send Damage Email ---
        if (shouldSendEmail) {
            let recipientEmail = null;
            let recipientName = null;
            if (originalOrder.purchaserType === 'Installer' && originalOrder.installerEmail) {
                recipientEmail = originalOrder.installerEmail;
                recipientName = originalOrder.installerName;
            } else if (originalOrder.customerEmail) {
                recipientEmail = originalOrder.customerEmail;
                recipientName = originalOrder.customerName;
            }

            if (recipientEmail) {
                // Fetch the actual items for the email list
                // The 'items' array from body only has {sampleId, quantity}, we need names.
                // We can grab them from the newly created order object which has joined details.
                await sendEmail(recipientEmail, 'Urgent: Damage Reported on Your Order', 'orderDamage', {
                    customerName: recipientName,
                    projectName: originalOrder.projectName,
                    lineItems: newOrder.lineItems, // The new order contains the damaged items list
                    replacementEta: replacementEta,
                    notes: notes
                }).catch(err => console.error("Failed to send damage email:", err));
            }
        }

        res.status(201).json({ 
            originalOrder: updatedOriginal, 
            replacementOrder: newOrder 
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Damage report transaction failed:', err.message);
        res.status(500).json({ error: 'Failed to process damage report.' });
    } finally {
        client.release();
    }
});

router.get('/:id/history', verifySession(), async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT 
                al.*,
                ep.email AS user_email
            FROM activity_log al
            LEFT JOIN emailpassword_users ep ON al.user_id = ep.user_id
            WHERE al.target_entity = 'MATERIAL_ORDER' AND al.target_id = $1
            ORDER BY al.created_at DESC;
        `;
        const result = await pool.query(query, [id]);
        res.json(result.rows.map(toCamelCase));
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Internal server error retrieving material order history" });
    }
});

export default router;