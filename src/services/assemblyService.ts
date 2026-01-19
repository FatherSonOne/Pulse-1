// AssemblyAI Service - Using direct API calls for browser compatibility
// The SDK requires Node.js, so we use fetch instead

const ASSEMBLYAI_API_URL = 'https://api.assemblyai.com/v2';

// Helper to convert File to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix if present
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Upload audio file to AssemblyAI
const uploadAudio = async (apiKey: string, audioFile: File): Promise<string> => {
  const response = await fetch(`${ASSEMBLYAI_API_URL}/upload`, {
    method: 'POST',
    headers: {
      'Authorization': apiKey,
      'Content-Type': 'application/octet-stream',
    },
    body: audioFile
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.upload_url;
};

// Poll for transcription completion
const pollTranscript = async (apiKey: string, transcriptId: string): Promise<any> => {
  const maxAttempts = 60; // 5 minutes max (5s intervals)
  
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`${ASSEMBLYAI_API_URL}/transcript/${transcriptId}`, {
      headers: { 'Authorization': apiKey }
    });
    
    const transcript = await response.json();
    
    if (transcript.status === 'completed') {
      return transcript;
    } else if (transcript.status === 'error') {
      throw new Error(transcript.error || 'Transcription failed');
    }
    
    // Wait 5 seconds before polling again
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  throw new Error('Transcription timed out');
};

export const transcribeAudio = async (apiKey: string, audioFile: File) => {
  try {
    // Step 1: Upload the audio file
    const audioUrl = await uploadAudio(apiKey, audioFile);
    
    // Step 2: Submit for transcription
    const response = await fetch(`${ASSEMBLYAI_API_URL}/transcript`, {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        speaker_labels: true,
        sentiment_analysis: true
      })
    });

    if (!response.ok) {
      throw new Error(`Transcription request failed: ${response.statusText}`);
    }

    const transcriptRequest = await response.json();
    
    // Step 3: Poll until complete
    const transcript = await pollTranscript(apiKey, transcriptRequest.id);
    
    return transcript;
  } catch (error) {
    console.error("AssemblyAI Transcription Error:", error);
    throw error;
  }
};

export const generateMeetingInsights = async (apiKey: string, transcriptId: string, prompt: string) => {
  try {
    const response = await fetch(`${ASSEMBLYAI_API_URL}/lemur/v3/generate/task`, {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transcript_ids: [transcriptId],
        prompt: prompt,
        final_model: 'anthropic/claude-3-5-sonnet'
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `LeMUR request failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error("AssemblyAI LeMUR Error:", error);
    throw error;
  }
};
