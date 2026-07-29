/**
 * Circle user-controlled wallet routes (email OTP + PIN).
 * Mounted at /api/uc/*
 */

import { Router, type IRouter, type Request, type Response } from 'express';
import {
  ucEnabled,
  createSession,
  refreshSession,
  initChallenge,
  getWallet,
  emailDeviceToken,
  walletByToken,
  createWalletForToken,
  pinSetupByToken,
  contractExecutionChallenge,
  contractExecutionChallengeByToken,
  listUserTransactions,
} from '../lib/circle-user';

const router: IRouter = Router();

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Circle request failed';
}

router.get('/enabled', (_req: Request, res: Response) => {
  res.json({ enabled: ucEnabled() });
});

if (ucEnabled()) {
  router.post('/session', async (_req: Request, res: Response) => {
    try {
      res.json(await createSession());
    } catch (e) {
      res.status(502).json({ error: errMessage(e) });
    }
  });

  router.post('/refresh', async (req: Request, res: Response) => {
    const { userId } = req.body ?? {};
    if (!userId) {
      res.status(400).json({ error: 'userId required' });
      return;
    }
    try {
      res.json(await refreshSession(userId));
    } catch (e) {
      res.status(502).json({ error: errMessage(e) });
    }
  });

  router.post('/init', async (req: Request, res: Response) => {
    const { userId } = req.body ?? {};
    if (!userId) {
      res.status(400).json({ error: 'userId required' });
      return;
    }
    try {
      res.json(await initChallenge(userId));
    } catch (e) {
      res.status(502).json({ error: errMessage(e) });
    }
  });

  router.get('/wallet', async (req: Request, res: Response) => {
    const userId = req.query['userId'];
    if (!userId || typeof userId !== 'string') {
      res.status(400).json({ error: 'userId required' });
      return;
    }
    try {
      res.json((await getWallet(userId)) ?? {});
    } catch (e) {
      res.status(502).json({ error: errMessage(e) });
    }
  });

  router.post('/email-token', async (req: Request, res: Response) => {
    const { deviceId, email } = req.body ?? {};
    if (!deviceId || !email) {
      res.status(400).json({ error: 'deviceId and email required' });
      return;
    }
    try {
      res.json(await emailDeviceToken(deviceId, email));
    } catch (e) {
      res.status(502).json({ error: errMessage(e) });
    }
  });

  router.post('/wallet-by-token', async (req: Request, res: Response) => {
    const { userToken } = req.body ?? {};
    if (!userToken) {
      res.status(400).json({ error: 'userToken required' });
      return;
    }
    try {
      res.json((await walletByToken(userToken)) ?? {});
    } catch (e) {
      res.status(502).json({ error: errMessage(e) });
    }
  });

  router.post('/create-wallet', async (req: Request, res: Response) => {
    const { userToken } = req.body ?? {};
    if (!userToken) {
      res.status(400).json({ error: 'userToken required' });
      return;
    }
    try {
      res.json(await createWalletForToken(userToken));
    } catch (e) {
      res.status(502).json({ error: errMessage(e) });
    }
  });

  router.post('/pin-setup', async (req: Request, res: Response) => {
    const { userToken } = req.body ?? {};
    if (!userToken) {
      res.status(400).json({ error: 'userToken required' });
      return;
    }
    try {
      res.json(await pinSetupByToken(userToken));
    } catch (e) {
      res.status(502).json({ error: errMessage(e) });
    }
  });

  router.post('/execute', async (req: Request, res: Response) => {
    const {
      userId,
      userToken,
      walletId,
      contractAddress,
      abiFunctionSignature,
      abiParameters,
      callData,
      refId,
    } = req.body ?? {};

    if (
      !walletId ||
      !contractAddress ||
      (!abiFunctionSignature && !callData) ||
      (!userId && !userToken)
    ) {
      res.status(400).json({
        error:
          'walletId, contractAddress, (callData or abiFunctionSignature), and userId or userToken required',
      });
      return;
    }

    try {
      const opts = { abiFunctionSignature, abiParameters, callData, refId };
      const out = userToken
        ? await contractExecutionChallengeByToken(
            userToken,
            walletId,
            contractAddress,
            opts,
          )
        : await contractExecutionChallenge(
            userId,
            walletId,
            contractAddress,
            opts,
          );
      res.json(out);
    } catch (e) {
      res.status(502).json({ error: errMessage(e) });
    }
  });

  /** Recent Circle txs for this wallet — used to wait for COMPLETE + txHash after PIN. */
  router.post('/transactions', async (req: Request, res: Response) => {
    const { userToken, walletId } = req.body ?? {};
    if (!userToken || !walletId) {
      res.status(400).json({ error: 'userToken and walletId required' });
      return;
    }
    try {
      res.json({
        transactions: await listUserTransactions(userToken, walletId),
      });
    } catch (e) {
      res.status(502).json({ error: errMessage(e) });
    }
  });
}

export default router;
