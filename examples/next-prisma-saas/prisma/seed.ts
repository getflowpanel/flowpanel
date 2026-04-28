import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
async function main() {
  const alice = await prisma.user.upsert({
    where: { email: "alice@example.com" },
    update: {},
    create: { email: "alice@example.com", name: "Alice", role: "ADMIN" },
  });
  await prisma.post.upsert({
    where: { id: "seed-1" },
    update: {},
    create: {
      id: "seed-1",
      title: "First post",
      body: "Hello world",
      authorId: alice.id,
      published: true,
    },
  });
  console.log("Seeded successfully");
}
main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
