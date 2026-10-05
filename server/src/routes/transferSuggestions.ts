import { Router } from 'express';
import { z } from 'zod';
import {
  dismissTransferSuggestion,
  listTransferSuggestions,
} from '../services/transferSuggestionService.js';

// /api/transfer-suggestions: pairs of transactions that look like the two sides of a transfer.
// Reading them never changes anything. The user confirms one with
// POST /api/transactions/:id/link-transfer, or dismisses it here.

export const transferSuggestionsRouter = Router();

const id = z.string().min(1).max(64);

// GET /transfer-suggestions — [{ outflow, inflow, rate }], newest first
transferSuggestionsRouter.get('/', (_req, res) => {
  res.json(listTransferSuggestions());
});

// POST /transfer-suggestions/dismiss — this pair is not suggested again
transferSuggestionsRouter.post('/dismiss', (req, res) => {
  const parsed = z.object({ transactionId: id, otherTransactionId: id }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const result = dismissTransferSuggestion(
    parsed.data.transactionId,
    parsed.data.otherTransactionId,
  );
  if (!result.ok) return res.status(result.status).json({ error: result.error });
  res.status(204).send();
});
