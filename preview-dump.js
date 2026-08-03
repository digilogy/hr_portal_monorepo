const fs = require('fs');
const readline = require('readline');

async function processFile() {
  const fileStream = fs.createReadStream('hr-portal (5).sql');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let insertLinesCount = 0;
  for await (const line of rl) {
    if (line.startsWith('INSERT INTO')) {
      console.log(line.substring(0, 150) + '...');
      insertLinesCount++;
      if (insertLinesCount >= 10) {
        break;
      }
    }
  }
}

processFile();
