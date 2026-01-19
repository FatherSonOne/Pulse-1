import type { NextApiRequest, NextApiResponse } from 'next';
import { EmailFilterService } from '../../../services/EmailFilterService';
import { supabase } from '../../../lib/supabaseClient';

const filterService = new EmailFilterService();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = user.id;

    switch (req.method) {
      case 'GET':
        // GET /api/email/filters - Get all filters
        const { activeOnly = 'false' } = req.query;
        const filters = await filterService.getUserFilters(
          userId,
          activeOnly === 'true'
        );
        return res.status(200).json(filters);

      case 'POST':
        // POST /api/email/filters - Create new filter
        const { name, conditions, actions, is_active, priority } = req.body;

        if (!name || !conditions || !actions) {
          return res.status(400).json({ 
            error: 'Name, conditions, and actions are required' 
          });
        }

        const newFilter = await filterService.createFilter(userId, {
          name,
          conditions,
          actions,
          is_active: is_active ?? true,
          priority: priority ?? 0
        });

        return res.status(201).json(newFilter);

      case 'PUT':
        // PUT /api/email/filters/:id - Update filter
        const { id, ...updates } = req.body;

        if (!id) {
          return res.status(400).json({ error: 'Filter ID is required' });
        }

        const updatedFilter = await filterService.updateFilter(
          userId,
          id,
          updates
        );

        return res.status(200).json(updatedFilter);

      case 'DELETE':
        // DELETE /api/email/filters/:id - Delete filter
        const { id: deleteId } = req.query;

        if (!deleteId || typeof deleteId !== 'string') {
          return res.status(400).json({ error: 'Filter ID is required' });
        }

        await filterService.deleteFilter(userId, deleteId);

        return res.status(204).end();

      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).json({ error: `Method ${req.method} not allowed` });
    }
  } catch (error: any) {
    console.error('Email filters API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
