import type { NextApiRequest, NextApiResponse } from 'next';
import { LabelService } from '../../../../services/LabelService';
import { GmailService } from '../../../../services/gmailService';
import { supabase } from '../../../../lib/supabaseClient';

const labelService = new LabelService();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get Gmail access token
    const { data: integration } = await supabase
      .from('integrations')
      .select('access_token')
      .eq('user_id', user.id)
      .eq('platform', 'gmail')
      .single();

    if (!integration?.access_token) {
      return res.status(400).json({ error: 'Gmail not connected' });
    }

    // Initialize Gmail API
    const gmailService = new GmailService(integration.access_token);
    const gmailApi = gmailService.getApiClient();

    // Sync labels
    await labelService.syncWithGmail(user.id, gmailApi);

    return res.status(200).json({ success: true, message: 'Labels synced successfully' });
  } catch (error: any) {
    console.error('Gmail label sync API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
