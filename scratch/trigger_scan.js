const http = require('http');

const bodyData = JSON.stringify({ limitSize: 5 });

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/fugu/scan',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(bodyData)
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Scan trigger response:', data);
  });
});

req.on('error', (e) => {
  console.error('Error triggering scan:', e.message);
});

req.write(bodyData);
req.end();
