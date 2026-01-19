import type { NextApiRequest, NextApiResponse } from 'next';
import { BulkOperationsService } from '../../../services/BulkOperationsService';
import { supabase } from '../../../lib/supabaseClient';

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

    const { operation, emailIds, ...params } = req.body;

    if (!operation || !Array.isArray(emailIds) || emailIds.length === 0) {
      return res.status(400).json({ 
        error: 'Operation and emailIds array are required' 
      });
    }

    let result;

    switch (operation) {
      case 'markAsRead':
        result = await bulkService.markAsRead(user.id, emailIds, params);
        break;

      case 'markAsUnread':
        result = await bulkService.markAsUnread(user.id, emailIds);
        break;

      case 'archive':
        result = await bulkService.archive(user.id, emailIds);
        break;

      case 'delete':
        result = await bulkService.delete(user.id, emailIds, params.permanent);
        break;

      case 'star':
        result = await bulkService.star(user.id, emailIds);
        break;

      case 'unstar':
        result = await bulkService.unstar(user.id, emailIds);
        break;

      case 'addLabel':
        if (!params.labelId) {
          return res.status(400).json({ error: 'labelId is required for addLabel operation' });
        }
        result = await bulkService.addLabel(user.id, emailIds, params.labelId);
        break;

      case 'removeLabel':
        if (!params.labelId) {
          return res.status(400).json({ error: 'labelId is required for removeLabel operation' });
        }
        result = await bulkService.removeLabel(user.id, emailIds, params.labelId);
        break;

      case 'move':
        if (!params.toFolder) {
          return res.status(400).json({ error: 'toFolder is required for move operation' });
        }
        result = await bulkService.move(user.id, emailIds, params.toFolder);
        break;

      case 'export':
        if (!params.format) {
          return res.status(400).json({ error: 'format is required for export operation' });
        }
        result = await bulkService.export(user.id, emailIds, params.format);
        break;

      case 'applyFilters':
        result = await bulkService.applyFilters(user.id, emailIds);
        break;

      default:
        return res.status(400).json({ 
          error: `Unknown operation: ${operation}`,
          validOperations: [
            'markAsRead', 'markAsUnread', 'archive', 'delete', 
            'star', 'unstar', 'addLabel', 'removeLabel', 
            'move', 'export', 'applyFilters'
          ]
        });
    }

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Bulk operations API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
