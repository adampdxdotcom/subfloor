import express from 'express';
import pool from '../db.js';
import { toCamelCase } from '../utils.js';

const router = express.Router();

// GET /api/orders
router.get('/', async (req, res) => {
    const { projectId } = req.query;
    
    let query;
    let queryParams = [];
    
    const baseQuery = `
        SELECT
            mo.id, mo.project_id, mo.supplier, mo.order_date, mo.eta_date, mo.status,
            COALESCE(
                (
                    SELECT json_agg(json_build_object(
                        'id', oli.id, 'quantity', oli.quantity, 'unitCost', oli.unit_cost,
                        'sampleId', s.id, 'styleColor', s.style_color, 'manufacturer', s.manufacturer
                    ))
                    FROM order_line_items oli
                    JOIN samples s ON oli.sample_id = s.id
                    WHERE oli.order_id = mo.id
                ),
                '[]'::json
            ) AS line_items
        FROM
            material_orders mo
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

// POST /api/orders
router.post('/', async (req, res) => {
    const { projectId, supplier, etaDate, lineItems } = req.body;
    if (!projectId || !lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
        return res.status(400).json({ error: 'projectId and a non-empty array of lineItems are required.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const orderInsertQuery = `
            INSERT INTO material_orders (project_id, supplier, eta_date, status)
            VALUES ($1, $2, $3, 'Ordered')
            RETURNING id;
        `;
        const orderResult = await client.query(orderInsertQuery, [projectId, supplier, etaDate || null]);
        const orderId = orderResult.rows[0].id;

        for (const item of lineItems) {
            const { sampleId, quantity, unitCost } = item;
            if (!sampleId || quantity === undefined) {
                throw new Error('Each line item must have a sampleId and quantity.');
            }
            const lineItemInsertQuery = `
                INSERT INTO order_line_items (order_id, sample_id, quantity, unit_cost)
                VALUES ($1, $2, $3, $4);
            `;
            await client.query(lineItemInsertQuery, [orderId, sampleId, quantity, unitCost || null]);
        }

        await client.query('COMMIT');

        const newOrderQuery = `
            SELECT
                mo.id, mo.project_id, mo.supplier, mo.order_date, mo.eta_date, mo.status,
                COALESCE(
                    (SELECT json_agg(json_build_object('id', oli.id, 'quantity', oli.quantity, 'unitCost', oli.unit_cost, 'sampleId', s.id, 'styleColor', s.style_color, 'manufacturer', s.manufacturer)) FROM order_line_items oli JOIN samples s ON oli.sample_id = s.id WHERE oli.order_id = mo.id),
                    '[]'::json
                ) AS line_items
            FROM material_orders mo
            WHERE mo.id = $1;
        `;
        const newOrderResult = await client.query(newOrderQuery, [orderId]);

        res.status(201).json(toCamelCase(newOrderResult.rows[0]));

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Transaction failed:', err.message);
        res.status(500).json({ error: 'Failed to create order. Transaction was rolled back.' });
    } finally {
        client.release();
    }
});

// PUT /api/orders/:id
router.put('/:id', async (req, res) => {
    const { id: orderId } = req.params;
    const { supplier, etaDate, lineItems } = req.body;

    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
        return res.status(400).json({ error: 'An order must have at least one line item.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const orderUpdateQuery = `
            UPDATE material_orders
            SET supplier = $1, eta_date = $2
            WHERE id = $3;
        `;
        await client.query(orderUpdateQuery, [supplier, etaDate || null, orderId]);
        await client.query('DELETE FROM order_line_items WHERE order_id = $1', [orderId]);

        for (const item of lineItems) {
            const { sampleId, quantity, unitCost } = item;
            if (!sampleId || quantity === undefined) {
                throw new Error('Each line item must have a sampleId and quantity.');
            }
            const lineItemInsertQuery = `
                INSERT INTO order_line_items (order_id, sample_id, quantity, unit_cost)
                VALUES ($1, $2, $3, $4);
            `;
            await client.query(lineItemInsertQuery, [orderId, sampleId, quantity, unitCost || null]);
        }
        
        await client.query('COMMIT');
        const updatedOrderQuery = `
            SELECT
                mo.id, mo.project_id, mo.supplier, mo.order_date, mo.eta_date, mo.status,
                COALESCE(
                    (SELECT json_agg(json_build_object('id', oli.id, 'quantity', oli.quantity, 'unitCost', oli.unit_cost, 'sampleId', s.id, 'styleColor', s.style_color, 'manufacturer', s.manufacturer)) FROM order_line_items oli JOIN samples s ON oli.sample_id = s.id WHERE oli.order_id = mo.id),
                    '[]'::json
                ) AS line_items
            FROM material_orders mo
            WHERE mo.id = $1;
        `;
        const updatedOrderResult = await client.query(updatedOrderQuery, [orderId]);

        res.status(200).json(toCamelCase(updatedOrderResult.rows[0]));

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Update transaction failed:', err.message);
        res.status(500).json({ error: 'Failed to update order. Transaction was rolled back.' });
    } finally {
        client.release();
    }
});

export default router;