import type { NextApiRequest, NextApiResponse } from 'next';
import { EmailFilterService } from '../../../../../services/EmailFilterService';
import { supabase } from '../../../../../lib/supabaseClient';

const filterService = new EmailFilterService();

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

    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Filter ID is required' });
    }

    const updatedFilter = await filterService.toggleFilter(user.id, id);

    return res.status(200).json(updatedFilter);
  } catch (error: any) {
    console.error('Toggle filter API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
