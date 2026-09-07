import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const parseDate = (dateStr: string): { start: string; end: string } => {
  const currentYear = 2026;
  const monthMap: { [key: string]: string } = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
  };

  // e.g., "1 Jan", "9 & 10 Nov", "2 & 3 Dec"
  // Remove day of week if present (e.g., "1 Jan, Thursday" -> "1 Jan")
  const datePart = dateStr.split(',')[0].trim();
  
  if (datePart.includes('&')) {
    // Range
    const parts = datePart.split('&').map(p => p.trim());
    const day1 = parts[0].padStart(2, '0');
    
    // "10 Nov"
    const part2 = parts[1].split(' ');
    const day2 = part2[0].padStart(2, '0');
    const month = monthMap[part2[1]];

    return {
      start: `${currentYear}-${month}-${day1}`,
      end: `${currentYear}-${month}-${day2}`
    };
  } else {
    // Single date: "1 Jan"
    const parts = datePart.split(' ');
    const day = parts[0].padStart(2, '0');
    const month = monthMap[parts[1]];
    const date = `${currentYear}-${month}-${day}`;
    return { start: date, end: date };
  }
};

async function main() {
  const filePath = path.join(__dirname, '../../holidayslist');
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  
  const lines = fileContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  let currentZone = '';
  const holidaysMap: { [key: string]: { name: string, start: string, end: string, isOptional: boolean, zones: Set<string> } } = {};

  for (const line of lines) {
    if (line.endsWith('Zone')) {
      currentZone = line;
      continue;
    }
    
    if (line.startsWith('Date\tHoliday')) {
      continue;
    }

    const parts = line.split('\t');
    if (parts.length < 2) continue;

    const dateStr = parts[0].trim();
    let name = parts[1].trim();
    
    let isOptional = false;
    if (name.includes('(Optional)')) {
      isOptional = true;
      name = name.replace('(Optional)', '').trim();
    }

    const { start, end } = parseDate(dateStr);
    
    // Create a unique key for the holiday
    // We group by start date and name (case-insensitive for variations like Dushera/Dasara)
    // Actually, some names vary slightly, e.g., "Dushera" vs "Dasara", "Vinayaka Chaturthi" vs "Vinayagar Chaturthi". 
    // It's better to group strictly by exact name and date, or we can just group by date and if names differ slightly, pick one.
    // Let's group by start date + name to be safe.
    const key = `${start}_${name.toLowerCase()}`;

    if (!holidaysMap[key]) {
      holidaysMap[key] = {
        name,
        start,
        end,
        isOptional,
        zones: new Set()
      };
    }
    holidaysMap[key].zones.add(currentZone);
  }

  // Clear existing holidays first if you want, or just insert new ones
  await prisma.holiday.deleteMany({});
  
  for (const key in holidaysMap) {
    const h = holidaysMap[key];
    await prisma.holiday.create({
      data: {
        name: h.name,
        startDate: new Date(`${h.start}T00:00:00Z`),
        endDate: new Date(`${h.end}T23:59:59Z`),
        isOptional: h.isOptional,
        zones: Array.from(h.zones)
      }
    });
    console.log(`Inserted ${h.name} (${h.start} to ${h.end}) for ${Array.from(h.zones).join(', ')}`);
  }

  console.log('Successfully seeded holidays!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
