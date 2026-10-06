import { productPlacement, productSelect } from '../utils/productPlacement.js';
import { catalogKey, slugify } from '../../shared/mensCatalog.js';
import express from 'express';
import pool from '../config/db.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';
import { resolveProductAttributes, withProductAttributes } from '../utils/productAttributes.js';
import { ensureVariantSchema } from '../utils/variantSchema.js';
import { attachVariants, saveVariants } from '../utils/variants.js';
import { validateImageReference } from '../../shared/images.js';
import { getActiveDiscounts, calculateProductDiscount } from '../services/pricingEngine.js';

const router = express.Router();
let attributeSchema;
router.use(async (req, res, next) => {
  try {
    await ensureVariantSchema();
    attributeSchema ||= (async () => {
      const [columns] = await pool.query("SHOW COLUMNS FROM products LIKE 'attributes'");
      if (!columns.length) await pool.query('ALTER TABLE products ADD COLUMN attributes JSON NULL');
    })().catch(error => { attributeSchema = undefined; throw error; });
    await attributeSchema;
    next();
  } catch (error) { next(error); }
});

// Get all products (with search and category filter)
router.get('/', async (req, res) => {
  try {
    const { category, search, subcategory, type, fit, occasion } = req.query;
    let query = productSelect + ' WHERE p.deleted_at IS NULL';
    const params = [];

    if (category && String(category).toLowerCase() !== 'all') {
      query += ' AND (c.slug = ? OR s.slug = ? OR c.name = ? OR p.category_name = ?)';
      params.push(catalogKey(category),catalogKey(category),category,category);
    }
    for (const [column,value,normalize] of [['s.slug',subcategory,catalogKey],['t.slug',type,slugify],['p.fit',fit,v=>v],['p.occasion',occasion,v=>v]]) {
      if(value){query += ' AND '+column+' = ?';params.push(normalize(value));}
    }

    if (search) {
      query += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY p.id DESC';

    const [products] = await pool.query(query, params);
    const attached = await attachVariants(pool, products.map(withProductAttributes));
    const activeDiscounts = await getActiveDiscounts(pool).catch(() => []);

    const pricedProducts = attached.map(p => {
      const discountCalc = calculateProductDiscount(p, activeDiscounts);
      if (discountCalc.discountAmount > 0) {
        return {
          ...p,
          price: discountCalc.finalPrice,
          original_price: discountCalc.originalPrice,
          discount_amount: discountCalc.discountAmount,
          discount_percentage: discountCalc.discountPercent,
          discount_label: `${discountCalc.discountPercent}% OFF`,
          applied_discount: discountCalc.appliedDiscount,
        };
      }
      return p;
    });

    res.json({ success: true, count: pricedProducts.length, products: pricedProducts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single product
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(productSelect + ' WHERE p.id = ? AND p.deleted_at IS NULL', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    const attached = await attachVariants(pool, rows.map(withProductAttributes));
    let p = attached[0];
    if (p) {
      const activeDiscounts = await getActiveDiscounts(pool).catch(() => []);
      const discountCalc = calculateProductDiscount(p, activeDiscounts);
      if (discountCalc.discountAmount > 0) {
        p = {
          ...p,
          price: discountCalc.finalPrice,
          original_price: discountCalc.originalPrice,
          discount_amount: discountCalc.discountAmount,
          discount_percentage: discountCalc.discountPercent,
          discount_label: `${discountCalc.discountPercent}% OFF`,
          applied_discount: discountCalc.appliedDiscount,
        };
      }
    }
    res.json({ success: true, product: p });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create product (Admin Only)
router.post('/', protect, adminOnly, async (req, res) => {
  let connection;
  try {
    validateImageReference(req.body.image, { optional: true });
    let placement;
    try { placement = await productPlacement(req.body); } catch (error) { return res.status(400).json({success:false,message:error.message}); }
    const { name, sku, category_id, price, original_price, stock, image, description, status } = req.body;
    if (!name || price === undefined || price === null || price === '') {
      return res.status(400).json({ success: false, message: 'Product name and price are required' });
    }

    const numPrice = Number(price);
    if (!Number.isFinite(numPrice) || numPrice < 0) {
      return res.status(400).json({ success: false, message: 'Product price must be a valid non-negative number' });
    }

    if (original_price !== undefined && original_price !== null && original_price !== '') {
      const numOriginal = Number(original_price);
      if (!Number.isFinite(numOriginal) || numOriginal < 0) {
        return res.status(400).json({ success: false, message: 'Original price must be a valid non-negative number' });
      }
    }

    if (stock !== undefined && stock !== null && stock !== '') {
      const numStock = Number(stock);
      if (!Number.isInteger(numStock) || numStock < 0) {
        return res.status(400).json({ success: false, message: 'Stock must be a non-negative integer' });
      }
    }

    const generatedSku = sku || `SKU-${Date.now().toString().slice(-6)}`;
    let attributes;
    try { attributes = await resolveProductAttributes(pool, req.body.attributes ?? []); }
    catch (error) { return res.status(400).json({ success: false, message: error.message }); }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [result] = await connection.query(
      `INSERT INTO products 
      (name, sku, category_id, category_name, subcategory, price, original_price, stock, image, description, status, catalog_category_id, catalog_subcategory_id, catalog_type_id, product_type, fit, occasion, attributes) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        generatedSku,
        category_id || null,
        placement.category.name,
        placement.sub.name,
        price,
        original_price || null,
        stock || 0,
        image || '',
        description || '',
        status || 'Active',
        placement.category.id, placement.sub.id, placement.type?.id || null, placement.type?.name || '', placement.fit, placement.occasion,
        JSON.stringify(attributes),
      ]
    );

    if (req.body.variants !== undefined) await saveVariants(connection, result.insertId, attributes, req.body.variants);
    const [[savedProduct]] = await connection.query('SELECT * FROM products WHERE id=?', [result.insertId]);
    const [saved] = await attachVariants(connection, [withProductAttributes(savedProduct)]);
    await connection.commit();
    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      productId: result.insertId,
      attributes,
      product: saved,
    });
  } catch (error) {
    if (connection) await connection.rollback();
    res.status(error.code === 'ER_DUP_ENTRY' ? 409 : error.status || 500).json({ success: false, message: error.code === 'ER_DUP_ENTRY' ? 'A product or variant SKU already exists.' : error.message });
  } finally {
    connection?.release();
  }
});

// Update product (Admin Only)
router.put('/:id', protect, adminOnly, async (req, res) => {
  let connection;
  try {
    let placement;
    try { placement = await productPlacement(req.body); } catch (error) { return res.status(400).json({success:false,message:error.message}); }
    const { name, sku, category_id, price, original_price, stock, image, description, status } = req.body;
    const { id } = req.params;

    if (price !== undefined && price !== null && price !== '') {
      const numPrice = Number(price);
      if (!Number.isFinite(numPrice) || numPrice < 0) {
        return res.status(400).json({ success: false, message: 'Product price must be a valid non-negative number' });
      }
    }

    if (original_price !== undefined && original_price !== null && original_price !== '') {
      const numOriginal = Number(original_price);
      if (!Number.isFinite(numOriginal) || numOriginal < 0) {
        return res.status(400).json({ success: false, message: 'Original price must be a valid non-negative number' });
      }
    }

    if (stock !== undefined && stock !== null && stock !== '') {
      const numStock = Number(stock);
      if (!Number.isInteger(numStock) || numStock < 0) {
        return res.status(400).json({ success: false, message: 'Stock must be a non-negative integer' });
      }
    }

    let attributes;
    if (req.body.attributes !== undefined) {
      try { attributes = await resolveProductAttributes(pool, req.body.attributes); }
      catch (error) { return res.status(400).json({ success: false, message: error.message }); }
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [[existing]] = await connection.query('SELECT * FROM products WHERE id=? AND deleted_at IS NULL FOR UPDATE', [id]);
    if (!existing) throw Object.assign(new Error('Product not found'), { status: 404 });
    const [[skuConflict]] = await connection.query('SELECT id FROM products WHERE sku=? AND id<>? LIMIT 1', [sku, id]);
    if (skuConflict) throw Object.assign(new Error(`Product SKU "${sku}" is already assigned to another product. Keep this product's original SKU or enter a unique one.`), { status: 409 });
    // Keep existing images editable even if they predate the new upload limits.
    if (req.body.image !== existing.image) validateImageReference(req.body.image, { optional: true });
    if (existing.has_variants && req.body.variants === undefined) throw Object.assign(new Error('Include the variant matrix when editing this product.'), { status: 400 });
    const [result] = await connection.query(
      `UPDATE products SET 
      name = ?, sku = ?, category_id = ?, category_name = ?, subcategory = ?, price = ?, original_price = ?, stock = ?, image = COALESCE(?, image), description = ?, status = ?, catalog_category_id = ?, catalog_subcategory_id = ?, catalog_type_id = ?, product_type = ?, fit = ?, occasion = ?
      , attributes = COALESCE(?, attributes) WHERE id = ?`,
      [
        name,
        sku,
        category_id || null,
        placement.category.name,
        placement.sub.name,
        price,
        original_price || null,
        stock || 0,
        image === existing.image ? null : image || '',
        description || '',
        status || 'Active',
        placement.category.id, placement.sub.id, placement.type?.id || null, placement.type?.name || '', placement.fit, placement.occasion,
        attributes === undefined ? null : JSON.stringify(attributes),
        id,
      ]
    );

    if (result.affectedRows === 0) {
      throw Object.assign(new Error('Product not found'), { status: 404 });
    }

    if (req.body.variants !== undefined) await saveVariants(connection, Number(id), attributes ?? withProductAttributes(existing).attributes, req.body.variants);
    const [[savedProduct]] = await connection.query('SELECT * FROM products WHERE id=?', [id]);
    const [saved] = await attachVariants(connection, [withProductAttributes(savedProduct)]);
    await connection.commit();
    res.json({ success: true, message: 'Product updated successfully', product: saved, ...(attributes === undefined ? {} : { attributes }) });
  } catch (error) {
    if (connection) await connection.rollback();
    res.status(error.code === 'ER_DUP_ENTRY' ? 409 : error.status || 500).json({ success: false, message: error.code === 'ER_DUP_ENTRY' ? 'A product or variant SKU already exists.' : error.message });
  } finally {
    connection?.release();
  }
});

// Delete product (Admin Only)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query("UPDATE products SET deleted_at = NOW(), status = 'Out of Stock' WHERE id = ? AND deleted_at IS NULL", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') return res.status(409).json({ success: false, message: 'This product has variants or order history. Disable its variants to stop selling it.' });
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
