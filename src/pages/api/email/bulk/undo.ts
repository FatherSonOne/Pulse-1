import type { NextApiRequest, NextApiResponse} from 'next';
import { BulkOperationsService } from '../../../../services/BulkOperationsService';
import { supabase } from '../../../../lib/supabaseClient';

const bulkService = new BulkOperationsService();

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

    const { undoData } = req.body;

    if (!undoData) {
      return res.status(400).json({ error: 'undoData is required' });
    }

    await bulkService.undo(user.id, undoData);

    return res.status(200).json({ success: true, message: 'Operation undone successfully' });
  } catch (error: any) {
    console.error('Undo operation API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
