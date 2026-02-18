import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

const [rows] = await connection.execute(`
  SELECT 
    TABLE_NAME,
    INDEX_NAME,
    GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) as COLUMNS,
    NON_UNIQUE
  FROM information_schema.STATISTICS 
  WHERE TABLE_SCHEMA = DATABASE()
  GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE
  ORDER BY TABLE_NAME, INDEX_NAME
`);

console.log('Current Database Indexes:');
console.log('='.repeat(80));

let currentTable = '';
for (const row of rows) {
  if (row.TABLE_NAME !== currentTable) {
    currentTable = row.TABLE_NAME;
    console.log(`\n${currentTable}:`);
  }
  const unique = row.NON_UNIQUE === 0 ? 'UNIQUE' : '';
  console.log(`  - ${row.INDEX_NAME}: (${row.COLUMNS}) ${unique}`);
}

await connection.end();
