import pool from '../db.js';

/**
 * GENERATE PRODUCT CATALOG REPORT
 * Useful for: Price Lists, Inventory Valuation
 */
export async function getProductReport({ includeDiscontinued = false, manufacturerId = null, productType = null }) {
  const client = await pool.connect();
  try {
    let query = `
      SELECT 
        p.id as product_id,
        v.name as manufacturer_name,
        p.name as product_name,
        p.product_type,
        pv.style as variant_style,
        pv.name as variant_color, 
        pv.size as variant_size,
        pv.sku,
        pv.unit_cost,
        pv.retail_price,
        pv.uom,
        p.is_discontinued
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      LEFT JOIN vendors v ON p.manufacturer_id = v.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    // Filter: Discontinued
    if (includeDiscontinued !== 'true') {
      // Use IS NOT TRUE to include FALSE or NULL values safely
      query += ` AND (p.is_discontinued IS NOT TRUE)`;
    }

    // Filter: Specific Manufacturer
    if (manufacturerId) {
      query += ` AND p.manufacturer_id = $${paramIndex}`;
      params.push(manufacturerId);
      paramIndex++;
    }

    // Filter: Product Type
    if (productType) {
      query += ` AND p.product_type = $${paramIndex}`;
      params.push(productType);
      paramIndex++;
    }

    // Order by Manufacturer -> Type -> Product Name -> Variant Size
    query += ` ORDER BY v.name ASC, p.product_type ASC, p.name ASC, pv.size ASC`;

    const result = await client.query(query, params);
    return result.rows;

  } finally {
    client.release();
  }
}

/**
 * GENERATE JOB PIPELINE REPORT
 * Useful for: Revenue Forecasting, Pipeline Health
 */
export async function getJobReport({ startDate, endDate, status = null }) {
  const client = await pool.connect();
  try {
    let query = `
      SELECT 
        p.id,
        p.project_name,
        c.full_name as customer_name,
        p.status,
        p.created_at,
        p.final_choice,
        -- Financials: Sum of ACCEPTED quotes only
        COALESCE(q.materials_amount, 0) + COALESCE(q.labor_amount, 0) + COALESCE(q.installer_markup, 0) as total_value,
        COALESCE(q.materials_amount, 0) as material_cost,
        COALESCE(q.labor_amount, 0) as labor_cost
      FROM projects p
      JOIN customers c ON p.customer_id = c.id
      LEFT JOIN quotes q ON p.id = q.project_id AND q.status = 'Accepted'
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    // Filter: Date Range (Based on Project Creation)
    if (startDate) {
      query += ` AND p.created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }
    if (endDate) {
      query += ` AND p.created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    // Filter: Status (Optional)
    if (status && status !== 'All') {
      query += ` AND p.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY p.created_at DESC`;

    const result = await client.query(query, params);
    return result.rows;

  } finally {
    client.release();
  }
}

/**
 * GENERATE INSTALLER ACTIVITY REPORT
 * Useful for: Work Volume Analysis
 */
export async function getInstallerReport({ startDate, endDate, installerId = null }) {
  const client = await pool.connect();
  try {
    // This query aggregates activity for the given period
    let query = `
      SELECT 
        i.id,
        i.installer_name,
        i.color,
        
        -- Count unique appointments in this timeframe
        COUNT(DISTINCT ja.id) as appointment_count,
        
        -- Sum labor value of quotes assigned to them (Approved quotes sent in this timeframe)
        COALESCE(SUM(q.labor_amount), 0) as total_labor_value

      FROM installers i
      
      -- Join Appointments to check activity volume
      LEFT JOIN job_appointments ja ON i.id = ja.installer_id 
        AND (ja.start_date >= $1 AND ja.start_date <= $2)
      
      -- Join Quotes to check financial volume (using date_sent as the metric for "period of time")
      LEFT JOIN quotes q ON i.id = q.installer_id 
        AND q.status = 'Accepted'
        AND (q.date_sent >= $1 AND q.date_sent <= $2)
        
      WHERE 1=1
    `;

    const params = [startDate || '1970-01-01', endDate || '2100-01-01'];
    let paramIndex = 3;

    if (installerId) {
      query += ` AND i.id = $${paramIndex}`;
      params.push(installerId);
      paramIndex++;
    }

    query += ` GROUP BY i.id, i.installer_name, i.color ORDER BY i.installer_name ASC`;

    const result = await client.query(query, params);
    return result.rows;

  } finally {
    client.release();
  }
}