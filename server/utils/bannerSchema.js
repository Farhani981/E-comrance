export async function ensureBannerSchema(connection) {
  const additions = {
    badge: "VARCHAR(80) NOT NULL DEFAULT ''",
    link: "VARCHAR(500) NOT NULL DEFAULT '/shop'",
    secondaryButtonText: "VARCHAR(100) NOT NULL DEFAULT 'Explore categories'",
    secondaryLink: "VARCHAR(500) NOT NULL DEFAULT '/#categories'",
    imageAlt: "VARCHAR(255) NOT NULL DEFAULT ''",
    imagePosition: "VARCHAR(20) NOT NULL DEFAULT 'center'",
    kind: "VARCHAR(10) NOT NULL DEFAULT 'hero'",
  };
  const [columns] = await connection.query('SHOW COLUMNS FROM banners');
  for (const [name, definition] of Object.entries(additions)) {
    if (!columns.some(column => column.Field === name)) await connection.query('ALTER TABLE banners ADD COLUMN ' + name + ' ' + definition);
  }
  if (columns.find(column => column.Field === 'image')?.Type.toLowerCase() !== 'mediumtext') await connection.query('ALTER TABLE banners MODIFY COLUMN image MEDIUMTEXT NOT NULL');
}
