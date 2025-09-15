module.exports = {
  databaseUrl: 
    (() => {
      const databaseUrl = `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`;
      console.log('node-pg-migrate DEBUG databaseUrl:', databaseUrl);
      return databaseUrl;
    })(),
  migrationsTable: 'pgmigrations',
  dir: 'migrations',
};
