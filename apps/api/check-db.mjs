import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const meta = await prisma.calendarEventMetadata.findMany({
    select: {
      id: true,
      eventId: true,
      category: true,
      audience: true,
      categoryMetadata: true,
    },
  });
  console.log('CalendarEventMetadata rows:');
  console.log(JSON.stringify(meta, null, 2));
  
  const events = await prisma.calendarEvent.findMany({
    take: 3,
    select: {
      id: true,
      title: true,
      googleEventId: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  console.log('\nRecent CalendarEvents:');
  console.log(JSON.stringify(events, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
