import { PrismaClient } from ".prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.contactOption.createMany({
    data: [
      {
        method: "Email",
        details: "support@example.com",
        responseTime: "Within 24 hours",
        businessHours: "9 AM - 5 PM",
      },
      {
        method: "WhatsApp",
        details: "+1234567890",
        responseTime: "Within 1 hour",
        businessHours: "8 AM - 8 PM",
      },
      {
        method: "Phone",
        details: "+1234567890",
        responseTime: "Immediate",
        businessHours: "9 AM - 5 PM",
      },
    ],
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });