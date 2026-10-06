export const slugify = value => String(value || '').toLowerCase().trim().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const fits = ['Slim Fit', 'Regular Fit', 'Relaxed Fit'];
export const occasions = ['Casual', 'Formal', 'Party Wear', 'Festive/Eid Special'];
const definitions = [
 ['Top Wear', [
  ['Casual Shirts', ['Button-down', 'Printed', 'Linen']],
  ['Formal Shirts', ['Dress Shirts', 'Crisp Cotton']],
  ['T-Shirts & Polos', ['Crew Neck', 'V-Neck', 'Polo Shirts']],
  ['Jackets, Hoodies & Sweatshirts', ['Denim Jackets', 'Leather Jackets', 'Hoodies', 'Sweatshirts', 'Cardigans']]
 ]],
 ['Bottom Wear', [
  ['Jeans & Denim Pants', ['Slim Fit', 'Straight Fit', 'Cargo Jeans']],
  ['Trousers & Chinos', ['Formal Trousers', 'Casual Chinos']],
  ['Shorts & Joggers', ['Sweatpants', 'Trackpants', 'Casual Shorts']]
 ]],
 ['Eastern Wear', [
  ['Kurta Suits', ['2-Piece Kurta Shalwar', 'Kurta Pajama']],
  ['Single Kurtas', ['Casual Kurtas', 'Embroidered Kurtas']],
  ['Waistcoats & Prince Suits', ['Waistcoats', 'Prince Suits']],
  ['Unstitched Fabric', ['Gents Suit Lengths']],
  ['Shawls & Dupattas', ['Gents Woolen Shawls', 'Cashmere Shawls']]
 ]],
 ['Accessories', [
  ['Wallets, Cardholders & Belts', ['Leather Belts', 'RFID Wallets', 'Cardholders']],
  ['Watches & Sunglasses', ['Analog Watches', 'Digital Watches', 'Polarized Glasses']],
  ['Footwear', ['Formal Shoes', 'Loafers', 'Sneakers', 'Peshawari Chappal', 'Khussa']],
  ['Grooming & Perfumes', ['Fragrances', 'Colognes', 'Ties & Cufflinks']],
  ['Caps & Innerwear', ['Caps', 'Vests', 'Boxers']]
 ]]
];
export const initialMensTree = definitions.map(([name, children], position) => ({ name, slug: slugify(name), position, children: children.map(([name, types], position) => ({ name, slug: slugify(name), position, children: types.map((name, position) => ({ name, slug: slugify(name), position, children: [] })) })) }));
const aliases = { topwear:'top-wear', bottomwear:'bottom-wear', 'denim-jeans':'jeans-and-denim-pants', jeans:'jeans-and-denim-pants', 'chinos-and-trousers':'trousers-and-chinos', 'formal-pants':'trousers-and-chinos', trousers:'trousers-and-chinos', chinos:'trousers-and-chinos', 't-shirts':'t-shirts-and-polos', 'jackets-and-coats':'jackets-hoodies-and-sweatshirts', jackets:'jackets-hoodies-and-sweatshirts', 'shalwar-kameez':'kurta-suits', kurta:'kurta-suits', waistcoats:'waistcoats-and-prince-suits', 'belts-and-wallets':'wallets-cardholders-and-belts', 'gift-sets':'wallets-cardholders-and-belts', watches:'watches-and-sunglasses', 'attar-and-fragrance':'grooming-and-perfumes', perfumes:'grooming-and-perfumes', 'grooming-and-tech':'grooming-and-perfumes', shoes:'footwear', shoies:'footwear' };
export const catalogKey = value => aliases[slugify(value)] || slugify(value);
export function legacyPlacement(product, tree = initialMensTree) {
 const rawCategory=product.category || product.category_name || '';
 const rawSub=product.subCategory || product.subcategory || '';
 const cat=catalogKey(rawCategory), sub=catalogKey(rawSub);
 for(const parent of tree) for(const child of parent.children) {
  const childMatch=child.slug===sub || child.slug===cat;
  const type=child.children.find(t=>catalogKey(t.name)===sub || catalogKey(t.name)===cat || (t.name==='Formal Shoes' && ['dress-shoes','shoes'].includes(slugify(rawSub))) );
  if ((parent.slug===cat && childMatch) || child.slug===cat || (parent.slug===cat && type) || (['footwear','grooming-and-perfumes'].includes(cat) && child.slug===cat)) return {category:parent.name, subCategory:child.name, productType:type?.name || product.productType || product.product_type || ''};
 }
 // Legacy product titles only refine a recognized parent when its old subcategory is absent.
 const parent=tree.find(p=>p.slug===cat);
 if(parent && (!rawSub || catalogKey(rawSub)===cat)) {
  const title=String(product.title || product.name || '').toLowerCase();
  const hint=title.includes('casual')&&title.includes('shirt')?'casual-shirts':title.includes('shirt')?'formal-shirts':title.includes('jean')?'jeans-and-denim-pants':title.includes('kurta')||title.includes('shalwar')?'kurta-suits':'';
  const child=parent.children.find(c=>c.slug===hint);
  if(child)return {category:parent.name,subCategory:child.name,productType:''};
 }
 return {category:parent?.name || rawCategory,subCategory:rawSub,productType:product.productType || product.product_type || ''};
}
export function buildTree(rows) {
 const nodes = rows.map(row=>({...row,children:[]}));
 const byId=new Map(nodes.map(row=>[row.id,row]));
 for(const row of nodes) if(row.parent_id) byId.get(row.parent_id)?.children.push(row);
 return nodes.filter(row=>!row.parent_id);
}
