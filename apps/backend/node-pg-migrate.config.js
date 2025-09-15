module.exports = {
  databaseUrl: 
    `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`,
  migrationsTable: 'pgmigrations',
  dir: 'migrations',
};
