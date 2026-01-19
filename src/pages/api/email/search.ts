import type { NextApiRequest, NextApiResponse } from 'next';
import { SearchQueryParser } from '../../../services/SearchQueryParser';
import { supabase } from '../../../lib/supabaseClient';

const parser = new SearchQueryParser();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    // Parse the search query
    const parsedQuery = parser.parse(q);

    // Build Supabase query
    let query = supabase
      .from('email_cache')
      .select('*')
      .eq('user_id', user.id);

    // Apply filters from parsed query
    query = parser.toSupabaseQuery(parsedQuery, query);

    // Execute query
    const { data: emails, error: searchError } = await query
      .order('timestamp', { ascending: false })
      .limit(100);

    if (searchError) {
      throw searchError;
    }

    return res.status(200).json({
      query: q,
      parsedQuery,
      results: emails,
      count: emails?.length || 0
    });
  } catch (error: any) {
    console.error('Email search API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
