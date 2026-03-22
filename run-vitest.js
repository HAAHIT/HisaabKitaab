const { execSync } = require('child_process');
const fs = require('fs');
try {
  const output = execSync('npx vitest run --reporter=json', { encoding: 'utf8' });
  fs.writeFileSync('vitest-results.json', output);
} catch (e) {
  // vitest exits with 1 when tests fail, so it throws here.
  fs.writeFileSync('vitest-results.json', e.stdout);
}

const r = require('./vitest-results.json');
const fail = r.testResults[0].assertionResults.find(a => a.status === 'failed');
console.log("FAILED TEST:", fail.title);
console.log("ERROR MESSAGE:", fail.failureMessages[0]);
