import express from 'express';
import pool from '../config/db.js';
import { protect,adminOnly } from '../middleware/authMiddleware.js';
import { buildTree,slugify,fits,occasions } from '../../shared/mensCatalog.js';
const router=express.Router();
router.get('/',async(_req,res)=>{try{const [rows]=await pool.query('SELECT * FROM catalog_nodes ORDER BY position,id');res.json({success:true,tree:buildTree(rows),fits,occasions});}catch{res.status(503).json({success:false,message:'Category navigation is unavailable. Check backend initialization.'});}});
const validate=body=>{
 const name=typeof body.name==='string'?body.name.trim():'';
 if(!name||name.length>100)throw new Error('Name is required (up to 100 characters).');
 const position=Number(body.position??0);if(!Number.isInteger(position)||position<0||position>1000)throw new Error('Invalid display order.');
 const image=body.image||'';if(typeof image!=='string'||image.length>1000||(image&&!/^(https?:\/\/[^\s]+|\/(?!\/)[^\s\\]+)$/.test(image)))throw new Error('Use a valid promotional image URL.');
 const promo=body.promo_title||'';if(typeof promo!=='string'||promo.length>150)throw new Error('Promotion title is too long.');
 return {name,position,image,promo};
};
router.post('/',protect,adminOnly,async(req,res)=>{
 try{const {name,position,image,promo}=validate(req.body);const slug=slugify(name);if(!slug)throw new Error('Name must contain letters or numbers.');
 const [parents]=await pool.query('SELECT n.*, p.parent_id AS grandparent FROM catalog_nodes n LEFT JOIN catalog_nodes p ON p.id=n.parent_id WHERE n.id=?',[req.body.parent_id]);
 const parent=parents[0];if(!parent||parent.grandparent)throw new Error('Select a department or subcategory. Only three category levels are supported.');
 const [result]=await pool.query('INSERT INTO catalog_nodes (parent_id,name,slug,position,image,promo_title) VALUES (?,?,?,?,?,?)',[parent.id,name,slug,position,image,promo]);res.status(201).json({success:true,id:result.insertId});
 }catch(error){res.status(400).json({success:false,message:error.code==='ER_DUP_ENTRY'?'This category already exists.':error.message});}
});
router.put('/:id',protect,adminOnly,async(req,res)=>{
 let connection;
 try{const {name,position,image,promo}=validate(req.body);connection=await pool.getConnection();await connection.beginTransaction();
 const [rows]=await connection.query('SELECT * FROM catalog_nodes WHERE id=? FOR UPDATE',[req.params.id]);const node=rows[0];if(!node)throw new Error('Category not found.');if(!node.parent_id&&node.name!==name)throw new Error('The four men’s department names are fixed.');
 await connection.query('UPDATE catalog_nodes SET name=?,position=?,image=?,promo_title=? WHERE id=?',[name,position,image,promo,node.id]);
 // Keep legacy text consumers in sync while stable IDs and slugs remain unchanged.
 await connection.query('UPDATE products SET category_name=? WHERE catalog_category_id=?',[name,node.id]);await connection.query('UPDATE products SET subcategory=? WHERE catalog_subcategory_id=?',[name,node.id]);await connection.query('UPDATE products SET product_type=? WHERE catalog_type_id=?',[name,node.id]);
 await connection.commit();res.json({success:true});
 }catch(error){if(connection)await connection.rollback();res.status(400).json({success:false,message:error.message});}finally{connection?.release();}
});
router.delete('/:id',protect,adminOnly,async(req,res)=>{
 try{const [rows]=await pool.query('SELECT * FROM catalog_nodes WHERE id=?',[req.params.id]);if(!rows[0]?.parent_id)return res.status(400).json({success:false,message:'Main departments cannot be deleted.'});
 const [used]=await pool.query('SELECT id FROM products WHERE catalog_category_id=? OR catalog_subcategory_id=? OR catalog_type_id=? LIMIT 1',[req.params.id,req.params.id,req.params.id]);if(used.length)return res.status(409).json({success:false,message:'Move assigned products before deleting this category.'});
 await pool.query('DELETE FROM catalog_nodes WHERE id=?',[req.params.id]);res.json({success:true});
 }catch{res.status(409).json({success:false,message:'Remove child product types before deleting this category.'});}
});
export default router;
