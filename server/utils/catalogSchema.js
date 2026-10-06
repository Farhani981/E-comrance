import { initialMensTree, legacyPlacement, buildTree } from '../../shared/mensCatalog.js';
export async function ensureCatalogSchema(db) {
 await db.query(`CREATE TABLE IF NOT EXISTS catalog_nodes (
  id INT AUTO_INCREMENT PRIMARY KEY, parent_id INT NULL, name VARCHAR(100) NOT NULL,
  slug VARCHAR(120) NOT NULL, position INT NOT NULL DEFAULT 0, image VARCHAR(1000) NOT NULL DEFAULT '',
  promo_title VARCHAR(150) NOT NULL DEFAULT '',
  UNIQUE KEY unique_catalog_sibling (parent_id,slug),
  FOREIGN KEY (parent_id) REFERENCES catalog_nodes(id) ON DELETE RESTRICT
 )`);
 await db.query('CREATE TABLE IF NOT EXISTS app_migrations (name VARCHAR(100) PRIMARY KEY)');
 const [columns]=await db.query('SHOW COLUMNS FROM products');
 for(const [name,definition] of Object.entries({catalog_category_id:'INT NULL',catalog_subcategory_id:'INT NULL',catalog_type_id:'INT NULL',product_type:"VARCHAR(100) DEFAULT ''",fit:"VARCHAR(40) DEFAULT ''",occasion:"VARCHAR(40) DEFAULT ''"})) {
  if(!columns.some(c=>c.Field===name)) await db.query(`ALTER TABLE products ADD COLUMN ${name} ${definition}`);
 }
 const [keys]=await db.query("SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='products' AND CONSTRAINT_TYPE='FOREIGN KEY'");
 for(const name of ['catalog_category_id','catalog_subcategory_id','catalog_type_id']) {
  const constraint='fk_products_'+name;
  if(!keys.some(k=>k.CONSTRAINT_NAME===constraint)) await db.query('ALTER TABLE products ADD CONSTRAINT '+constraint+' FOREIGN KEY ('+name+') REFERENCES catalog_nodes(id) ON DELETE RESTRICT');
 }
 const [done]=await db.query("SELECT name FROM app_migrations WHERE name='mens-catalog-v1'");
 if(done.length) return;
 await db.beginTransaction();
 try {
  async function seed(nodes,parent=null) {for(const node of nodes){const [result]=await db.query('INSERT INTO catalog_nodes (parent_id,name,slug,position) VALUES (?,?,?,?)',[parent,node.name,node.slug,node.position]);await seed(node.children,result.insertId);}}
  await seed(initialMensTree);
  const [rows]=await db.query('SELECT * FROM catalog_nodes ORDER BY position,id');const tree=buildTree(rows);
  const [products]=await db.query('SELECT id,name,category_name,subcategory FROM products');
  for(const product of products){const placement=legacyPlacement(product);const parent=tree.find(p=>p.name===placement.category);const sub=parent?.children.find(s=>s.name===placement.subCategory);if(!sub)continue;const type=sub.children.find(t=>t.name===placement.productType);await db.query('UPDATE products SET catalog_category_id=?,catalog_subcategory_id=?,catalog_type_id=?,category_name=?,subcategory=?,product_type=? WHERE id=?',[parent.id,sub.id,type?.id || null,parent.name,sub.name,type?.name || '',product.id]);}
  await db.query("INSERT INTO app_migrations (name) VALUES ('mens-catalog-v1')");await db.commit();
 }catch(error){await db.rollback();throw error;}
}
