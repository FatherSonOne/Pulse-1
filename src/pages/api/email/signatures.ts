import type { NextApiRequest, NextApiResponse } from 'next';
import { EmailSignatureService } from '../../../services/EmailSignatureService';
import { supabase } from '../../../lib/supabaseClient';

const signatureService = new EmailSignatureService();

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
        // GET /api/email/signatures - Get all signatures
        const signatures = await signatureService.getUserSignatures(userId);
        return res.status(200).json(signatures);

      case 'POST':
        // POST /api/email/signatures - Create new signature
        const { name, content, is_html, is_default } = req.body;

        if (!name || !content) {
          return res.status(400).json({ error: 'Name and content are required' });
        }

        const newSignature = await signatureService.createSignature(userId, {
          name,
          content,
          is_html: is_html ?? false,
          is_default: is_default ?? false
        });

        return res.status(201).json(newSignature);

      case 'PUT':
        // PUT /api/email/signatures/:id - Update signature
        const { id, ...updates } = req.body;

        if (!id) {
          return res.status(400).json({ error: 'Signature ID is required' });
        }

        const updatedSignature = await signatureService.updateSignature(
          userId,
          id,
          updates
        );

        return res.status(200).json(updatedSignature);

      case 'DELETE':
        // DELETE /api/email/signatures/:id - Delete signature
        const { id: deleteId } = req.query;

        if (!deleteId || typeof deleteId !== 'string') {
          return res.status(400).json({ error: 'Signature ID is required' });
        }

        await signatureService.deleteSignature(userId, deleteId);

        return res.status(204).end();

      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).json({ error: `Method ${req.method} not allowed` });
    }
  } catch (error: any) {
    console.error('Email signatures API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
