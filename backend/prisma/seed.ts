import { prisma } from '../src/lib/prisma.js';

async function main() {
  const root = await prisma.module.upsert({
    where: { code: 'ROOT' },
    update: {},
    create: {
      code: 'ROOT',
      name: 'Anforderungen',
      description: 'Root module for requirements without assigned module',
      sortOrder: 0,
    },
  });
  console.log(`Seeded root module ${root.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
