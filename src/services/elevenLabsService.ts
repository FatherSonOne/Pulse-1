// ElevenLabs Text-to-Speech Service
// Using direct API calls for maximum compatibility

export const generateSpeech = async (apiKey: string, text: string, voiceId: string = '21m00Tcm4TlvDq8ikWAM') => {
  
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey
      },
      body: JSON.stringify({
        text: text,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5
        }
      })
    });

    if (!response.ok) {
        throw new Error(`ElevenLabs API Error: ${response.statusText}`);
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error("ElevenLabs Error:", error);
    throw error;
  }
};

export const getVoices = async (apiKey: string) => {
    try {
        const response = await fetch('https://api.elevenlabs.io/v1/voices', {
            headers: { 'xi-api-key': apiKey }
        });
        const data = await response.json();
        return data.voices;
    } catch (e) {
        console.error(e);
        return [];
    }
}
