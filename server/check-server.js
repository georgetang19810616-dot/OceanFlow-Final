import axios from 'axios';

async function diagnose() {
  const urls = [
    'http://localhost:3001/api/health',
    'http://localhost:3001/api/settings',
    'http://localhost:3001/api/debug/settings/diagnose'
  ];
  
  for (const url of urls) {
    try {
      const response = await axios.get(url);
      console.log(`✅ ${url}:`, response.status, response.data);
    } catch (error) {
      console.log(`❌ ${url}:`, error.message);
      if (error.response) {
        console.log('   Status:', error.response.status);
        console.log('   Data:', error.response.data);
      }
    }
  }
}

diagnose();