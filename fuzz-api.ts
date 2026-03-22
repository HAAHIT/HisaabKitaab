import { randomBytes } from "crypto";

const URL = "http://localhost:3000/api";

function randomString() {
  return randomBytes(8).toString("hex");
}

function randomJunk() {
  const types = [
    null,
    undefined,
    "",
    "   ",
    randomString(),
    12345,
    -999,
    0,
    true,
    false,
    [],
    {},
    { [randomString()]: randomString() },
    "🔥", // emojis
    "{Size}", // formula injections
  ];
  return types[Math.floor(Math.random() * types.length)];
}

async function fuzzEndpoint(endpoint: string, method: string, payload: any) {
  try {
    const res = await fetch(`${URL}/${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-user-role": "ADMIN",
        "x-user-id": "fuzz-tester",
      },
      body: method === "POST" || method === "PATCH" ? JSON.stringify(payload) : undefined,
    });
    const status = res.status;
    if (status >= 500) {
      console.log(`❌ FATAL CRASH (${status}) on ${method} ${endpoint}`);
      console.log(`Payload:`, JSON.stringify(payload));
      return false;
    }
    return true;
  } catch (e) {
    console.log(`❌ NETWORK ERROR on ${method} ${endpoint}`, e);
    return false;
  }
}

async function main() {
  console.log("🐒 Monkey Testing API Boundaries Started...");
  let passed = 0;
  let failed = 0;

  for (let i = 0; i < 50; i++) {
    // 1. Fuzz Templates POST
    const tempPayload = {
      name: randomJunk(),
      columns: Array.from({ length: Math.random() * 5 }).map(() => ({
        id: randomJunk(),
        name: randomJunk(),
        type: randomJunk(),
        formula: randomJunk(),
      })),
    };
    const tRes = await fuzzEndpoint("templates", "POST", tempPayload);
    tRes ? passed++ : failed++;

    // 2. Fuzz Bills POST
    const billPayload = {
      templateId: randomJunk(),
      customerName: randomJunk(),
      rows: randomJunk(),
      status: randomJunk(),
      taxPercent: randomJunk(),
    };
    const bRes = await fuzzEndpoint("bills", "POST", billPayload);
    bRes ? passed++ : failed++;

    // 3. Fuzz Bills GET with crazy search params
    const bGet = await fuzzEndpoint(`bills?search=${randomJunk()}&status=${randomJunk()}&page=${randomJunk()}`, "GET", null);
    bGet ? passed++ : failed++;
  }

  console.log(`\nMonkey Testing Complete!`);
  console.log(`Total Requests: 150`);
  console.log(`Resilient Rejections/Successes: ${passed}`);
  console.log(`Fatal Crashes (500s): ${failed}`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

main();
