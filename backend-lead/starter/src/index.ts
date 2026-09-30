import { createApp } from './app';
import { config } from './config';
import { sequelize } from './db/sequelize';

async function main() {
  await sequelize.authenticate();
  const app = createApp();
  app.listen(config.port, () => {
    console.log(`mini-wallet-service listening on :${config.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
