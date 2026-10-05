import { Router } from 'express';
import { addDays, format } from 'date-fns';
import { z } from 'zod';
import { MAX_RATE } from '../services/exchangeRates.js';
import {
  estimatedRateDates,
  ratesOverview,
  refreshRates,
  saveManualRate,
  type RateSource,
} from '../services/exchangeRateService.js';
import { isRealDate } from '../utils/validation.js';

// /api/exchange-rates: the stored rates (Settings → Exchange rates). Only the server ever
// contacts the source, and only for POST /refresh; `source` is passed in so the in-browser
// demo, which mounts this router too, has no network code and never fetches.

const manualRate = z.object({ rate: z.number().positive().max(MAX_RATE) });

export function createExchangeRatesRouter(source: RateSource) {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json(ratesOverview());
  });

  // The dates of dollar transactions older than every stored rate (the "estimated" banner)
  router.get('/estimated', (_req, res) => {
    res.json({ dates: estimatedRateDates() });
  });

  // The Refresh button: from the last stored date through today, whatever the 24-hour wait says
  router.post('/refresh', async (_req, res) => {
    try {
      await refreshRates(source, { force: true });
    } catch (err) {
      console.error('Exchange rates: could not fetch:', err);
      // Not a 502-504: the page reads those as "FlyBudget's own server is unreachable"
      return res.status(500).json({
        error: "Couldn't get exchange rates right now. The rates already stored are kept.",
      });
    }
    res.json(ratesOverview());
  });

  // Enter or correct one date's rate by hand
  router.put('/:date', (req, res) => {
    const { date } = req.params;
    // A day of slack: the browser may be a time zone ahead of the server
    const latest = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    if (!isRealDate(date) || date > latest) {
      return res.status(400).json({ error: 'Choose a date up to today' });
    }
    const parsed = manualRate.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    res.json(saveManualRate(date, parsed.data.rate));
  });

  return router;
}
