import { PrismaClient } from '@prisma/client';

const INDIA_TIMEZONE = "Asia/Kolkata";

function formatTallyDate(date) {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: INDIA_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    })
        .format(date)
        .replace(/-/g, ""); // YYYY-MM-DD → YYYYMMDD
}

const prisma = new PrismaClient();

async function main() {
    const entry = await prisma.journalEntry.findFirst({
        orderBy: { entryDate: 'asc' }
    });

    if (!entry) {
        console.log("No entries found");
        return;
    }

    console.log("entryDate:", entry.entryDate);
    const formatted = formatTallyDate(entry.entryDate);
    console.log("Tally formatted date:", formatted);
    console.log("String bytes:", Array.from(formatted).map(c => c.charCodeAt(0)));
}

main().finally(() => prisma.$disconnect());
