import pool from '../config/db.js';
import { fits, occasions } from '../../shared/mensCatalog.js';
export async function productPlacement(body) {
 const [nodes]=await pool.query('SELECT id,parent_id,name,slug FROM catalog_nodes');
 const find=(parent,value)=>nodes.find(n=>n.parent_id===parent&&(n.name===value||n.slug===value));
 const category=find(null,body.category_name), sub=category&&find(category.id,body.subcategory);
 if(!category||!sub)throw new Error('Select a valid men’s department and its subcategory.');
 const type=body.product_type ? find(sub.id,body.product_type) : null;
 if(body.product_type&&!type)throw new Error('Product type does not belong to the selected subcategory.');
 if(body.fit && !fits.includes(body.fit))throw new Error('Invalid fit.');
 if(body.occasion && !occasions.includes(body.occasion))throw new Error('Invalid occasion.');
 return {category,sub,type,fit:body.fit||'',occasion:body.occasion||''};
}
export const productSelect = `SELECT p.*, COALESCE(c.name,p.category_name) AS category_name, COALESCE(s.name,p.subcategory) AS subcategory,
 COALESCE(t.name,p.product_type) AS product_type,c.slug AS category_slug,s.slug AS subcategory_slug,t.slug AS product_type_slug
 FROM products p LEFT JOIN catalog_nodes c ON c.id=p.catalog_category_id LEFT JOIN catalog_nodes s ON s.id=p.catalog_subcategory_id LEFT JOIN catalog_nodes t ON t.id=p.catalog_type_id`;
