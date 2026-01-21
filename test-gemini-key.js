// Test script to verify Gemini API key
const API_KEY = 'AIzaSyDh5M3w42XfQsdJ9cTMBAoXzqqwrzJF3bY';

async function testGeminiKey() {
  console.log('Testing Gemini API key...');

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Say hello' }] }]
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ API Key Test FAILED');
      console.error('Status:', response.status);
      console.error('Error:', JSON.stringify(errorData, null, 2));

      if (response.status === 403) {
        console.error('\n⚠️  This API key has been flagged as leaked by Google.');
        console.error('You need to create a completely NEW API key at:');
        console.error('https://aistudio.google.com/apikey');
      }
      return false;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    console.log('✅ API Key Test PASSED');
    console.log('Response:', text);
    return true;
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    return false;
  }
}

testGeminiKey();
