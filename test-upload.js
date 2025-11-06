// Test upload to backend
import axios from 'axios';

async function testUpload() {
  try {
    const response = await axios.post('http://localhost:3001/api/upload', {
      contentType: 'text',
      textContent: 'This is a test content',
      price: 1.00,
      creatorWallet: 'Cvrif4buVf5iLAAxY4whavmBWz9onCBdvEXYnMdE7wnF',
      expiresIn: 'never'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Upload successful!');
    console.log('Response:', response.data);
  } catch (error) {
    console.error('❌ Upload failed:');
    console.error('Error:', error.response ? error.response.data : error.message);
  }
}

testUpload();