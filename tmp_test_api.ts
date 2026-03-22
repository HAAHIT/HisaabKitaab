import { GET } from './src/app/api/bills/route';
import { NextRequest } from 'next/server';

async function testApi() {
  const req = new NextRequest('http://localhost:3000/api/bills?page=1', {
    headers: {
      'x-user-role': 'ADMIN',
      'x-user-id': 'admin-id'
    }
  });

  try {
    const res = await GET(req);
    console.log('STATUS:', res.status);
    const body = await res.json();
    console.log('BODY:', JSON.stringify(body));
  } catch (e) {
    console.error('API_TEST_ERROR:', e);
  }
}

testApi();
