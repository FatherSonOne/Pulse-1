import type { NextApiRequest, NextApiResponse } from 'next';
import { LabelService } from '../../../services/LabelService';
import { supabase } from '../../../lib/supabaseClient';

const labelService = new LabelService();

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
        // GET /api/email/labels - Get all labels
        const { includeSystem = 'true' } = req.query;
        const labels = await labelService.getUserLabels(
          userId,
          includeSystem === 'true'
        );
        return res.status(200).json(labels);

      case 'POST':
        // POST /api/email/labels - Create new label
        const { name, color, message_list_visibility, label_list_visibility } = req.body;

        if (!name) {
          return res.status(400).json({ error: 'Label name is required' });
        }

        const newLabel = await labelService.createLabel(userId, {
          name,
          color: color || '#808080',
          message_list_visibility: message_list_visibility || 'show',
          label_list_visibility: label_list_visibility || 'labelShow'
        });

        return res.status(201).json(newLabel);

      case 'PUT':
        // PUT /api/email/labels/:id - Update label
        const { id, ...updates } = req.body;

        if (!id) {
          return res.status(400).json({ error: 'Label ID is required' });
        }

        const updatedLabel = await labelService.updateLabel(
          userId,
          id,
          updates
        );

        return res.status(200).json(updatedLabel);

      case 'DELETE':
        // DELETE /api/email/labels/:id - Delete label
        const { id: deleteId } = req.query;

        if (!deleteId || typeof deleteId !== 'string') {
          return res.status(400).json({ error: 'Label ID is required' });
        }

        await labelService.deleteLabel(userId, deleteId);

        return res.status(204).end();

      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).json({ error: `Method ${req.method} not allowed` });
    }
  } catch (error: any) {
    console.error('Email labels API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
