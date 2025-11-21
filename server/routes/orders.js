// server/routes/orders.js

import express from 'express';
import pool from '../db.js';
import { toCamelCase, logActivity, verifyRole } from '../utils.js';
import { verifySession } from 'supertokens-node/recipe/session/framework/express/index.js';

const router = express.Router();

const getFullOrderById = async (orderId, client = pool) => {
    // --- MODIFIED QUERY ---
    const query = `
        SELECT
            mo.id, mo.project_id, mo.supplier_id, v.name as supplier_name, mo.order_date, mo.eta_date, mo.purchaser_type, mo.status,
            COALESCE(
                (SELECT json_agg(json_build_object(
                    'id', oli.id, 'quantity', oli.quantity, 'unit', oli.unit, 'totalCost', oli.total_cost, 
                    'unitPriceSold', oli.unit_price_sold,
                    'sampleId', s.id, 
                    'style', s.style,      -- REPLACED style_color
                    'color', s.color,      -- ADDED color
                    'manufacturerName', m.name
                )) 
                FROM order_line_items oli 
                JOIN samples s ON oli.sample_id = s.id 
                LEFT JOIN vendors m ON s.manufacturer_id = m.id
                WHERE oli.order_id = mo.id),
                '[]'::json
            ) AS line_items
        FROM material_orders mo
        LEFT JOIN vendors v ON mo.supplier_id = v.id
        WHERE mo.id = $1;
    `;
    const result = await client.query(query, [orderId]);
    return result.rows.length > 0 ? toCamelCase(result.rows[0]) : null;
};

router.get('/', verifySession(), async (req, res) => {
    const { projectId } = req.query;
    let query;
    let queryParams = [];
    // --- MODIFIED QUERY ---
    const baseQuery = `
        SELECT
            mo.id, mo.project_id, mo.supplier_id, v.name as supplier_name, mo.order_date, mo.eta_date, mo.purchaser_type, mo.status,
            COALESCE(
                (
                    SELECT json_agg(json_build_object(
                        'id', oli.id, 'quantity', oli.quantity, 'unit', oli.unit,
                        'unitPriceSold', oli.unit_price_sold,
                        'totalCost', oli.total_cost, 'sampleId', s.id, 
                        'style', s.style,       -- REPLACED style_color
                        'color', s.color,       -- ADDED color
                        'manufacturerName', m.name
                    ))
                    FROM order_line_items oli
                    JOIN samples s ON oli.sample_id = s.id
                    LEFT JOIN vendors m ON s.manufacturer_id = m.id
                    WHERE oli.order_id = mo.id
                ),
                '[]'::json
            ) AS line_items
        FROM material_orders mo LEFT JOIN vendors v ON mo.supplier_id = v.id
    `;
    if (projectId) {
        query = `${baseQuery} WHERE mo.project_id = $1 ORDER BY mo.order_date DESC;`;
        queryParams = [projectId];
    } else {
        query = `${baseQuery} ORDER BY mo.order_date DESC;`;
    }
    try {
        const result = await pool.query(query, queryParams);
        res.json(result.rows.map(toCamelCase));
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/', verifySession(), async (req, res) => {
    const userId = req.session.getUserId();
    const { projectId, supplierId, etaDate, purchaserType, lineItems } = req.body;
    if (!projectId || !lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
        return res.status(400).json({ error: 'projectId and a non-empty array of lineItems are required.' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const orderInsertQuery = `
            INSERT INTO material_orders (project_id, supplier_id, eta_date, purchaser_type, status)
            VALUES ($1, $2, $3, $4, 'Ordered') RETURNING id;
        `;
        const orderResult = await client.query(orderInsertQuery, [projectId, supplierId, etaDate || null, purchaserType || 'Customer']);
        const orderId = orderResult.rows[0].id;
        for (const item of lineItems) {
            const { sampleId, quantity, unit, totalCost, unitPriceSold } = item;
            if (!sampleId || quantity === undefined) throw new Error('Each line item must have a sampleId and quantity.');
            const lineItemInsertQuery = `
                INSERT INTO order_line_items (order_id, sample_id, quantity, unit, total_cost, unit_price_sold)
                VALUES ($1, $2, $3, $4, $5, $6);
            `;
            await client.query(lineItemInsertQuery, [orderId, sampleId, quantity, unit || null, totalCost || null, unitPriceSold || null]);
        }
        await client.query('COMMIT');
        
        const newOrder = await getFullOrderById(orderId, client);
        await logActivity(userId, 'CREATE', 'MATERIAL_ORDER', orderId, { createdData: newOrder });
        res.status(201).json(newOrder);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Transaction failed:', err.message);
        res.status(500).json({ error: 'Failed to create order. Transaction was rolled back.' });
    } finally {
        client.release();
    }
});

router.put('/:id', verifySession(), async (req, res) => {
    const { id: orderId } = req.params;
    const userId = req.session.getUserId();
    const { supplierId, etaDate, purchaserType, lineItems } = req.body;
    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
        return res.status(400).json({ error: 'An order must have at least one line item.' });
    }
    const client = await pool.connect();
    try {
        const beforeData = await getFullOrderById(orderId);
        if (!beforeData) return res.status(404).json({ error: 'Order not found' });
        await client.query('BEGIN');
        const orderUpdateQuery = `
            UPDATE material_orders SET supplier_id = $1, eta_date = $2, purchaser_type = $3 WHERE id = $4;
        `;
        await client.query(orderUpdateQuery, [supplierId, etaDate || null, purchaserType || 'Customer', orderId]);
        await client.query('DELETE FROM order_line_items WHERE order_id = $1', [orderId]);
        for (const item of lineItems) {
            const { sampleId, quantity, unit, totalCost, unitPriceSold } = item;
            if (!sampleId || quantity === undefined) throw new Error('Each line item must have a sampleId and quantity.');
            const lineItemInsertQuery = `
                INSERT INTO order_line_items (order_id, sample_id, quantity, unit, total_cost, unit_price_sold)
                VALUES ($1, $2, $3, $4, $5, $6);
            `;
            await client.query(lineItemInsertQuery, [orderId, sampleId, quantity, unit || null, totalCost || null, unitPriceSold || null]);
        }
        await client.query('COMMIT');
        const updatedOrder = await getFullOrderById(orderId, client);
        await logActivity(userId, 'UPDATE', 'MATERIAL_ORDER', orderId, { before: beforeData, after: updatedOrder });
        res.status(200).json(updatedOrder);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Update transaction failed:', err.message);
        res.status(500).json({ error: 'Failed to update order. Transaction was rolled back.' });
    } finally {
        client.release();
    }
});

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