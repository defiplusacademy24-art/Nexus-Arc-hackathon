import { Router, type IRouter, type Request, type Response } from 'express';
import { agentConfig } from '../agents/config';
import { agentRuntime } from '../agents/runtime';
import { AGENT_NAMES, type AgentName, type DomainEventName } from '../agents/types';
import { quoteLoanInterest } from '../agents/interest';
import { AGENT_PROMPTS } from '../agents/prompts';
import { toolsFor } from '../agents/tools';
import { logger } from '../lib/logger';
import { requireWallet } from '../lib/wallet';

const router: IRouter = Router();

function isAgentName(value: string): value is AgentName {
  return (AGENT_NAMES as readonly string[]).includes(value);
}

/** GET /api/agents/health — runtime + per-agent health */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const agents = agentConfig.enabled
      ? await agentRuntime().statuses()
      : AGENT_NAMES.map((agent) => ({
          agent,
          ready: false,
          queueDepth: 0,
          walletConfigured: Boolean(agentConfig.walletAddress(agent)),
          walletAddress: agentConfig.walletAddress(agent),
        }));

    res.json({
      enabled: agentConfig.enabled,
      llmConfigured: Boolean(agentConfig.llmApiKey),
      llmModel: agentConfig.llmModel,
      contracts: agentConfig.contracts,
      agents,
    });
  } catch (error) {
    logger.error({ err: error }, 'agents/health failed');
    res.status(500).json({
      error: error instanceof Error ? error.message : 'health check failed',
    });
  }
});

/** GET /api/agents — catalog of agents, prompts, tools */
router.get('/', (_req: Request, res: Response) => {
  res.json({
    architecture: 'multi-agent',
    custody: 'smart_contracts_only',
    walletProvider: 'circle_agent_stack',
    agents: AGENT_NAMES.map((name) => ({
      name,
      promptSummary: AGENT_PROMPTS[name].slice(0, 180) + '…',
      tools: toolsFor(name).map((t) => ({
        name: t.name,
        kind: t.kind,
        description: t.description,
      })),
      walletConfigured: Boolean(agentConfig.walletAddress(name)),
      walletAddress: agentConfig.walletAddress(name) ?? null,
    })),
  });
});

/** GET /api/agents/audit — recent decisions / wallet txs */
router.get('/audit', async (req: Request, res: Response) => {
  if (!agentConfig.enabled) {
    res.status(503).json({ error: 'Agents disabled (set AGENTS_ENABLED=true)' });
    return;
  }
  try {
    const agent =
      typeof req.query.agent === 'string' && isAgentName(req.query.agent)
        ? req.query.agent
        : undefined;
    const limit = Math.min(
      200,
      Math.max(1, Number(req.query.limit ?? 50) || 50),
    );
    const rows = await agentRuntime().store.listAudit(agent, limit);
    res.json({ audit: rows });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'audit query failed',
    });
  }
});

/** GET /api/agents/events — recent domain events */
router.get('/events', async (req: Request, res: Response) => {
  if (!agentConfig.enabled) {
    res.status(503).json({ error: 'Agents disabled' });
    return;
  }
  try {
    const limit = Math.min(
      200,
      Math.max(1, Number(req.query.limit ?? 50) || 50),
    );
    const events = await agentRuntime().store.recentEvents(limit);
    res.json({
      events: events.map((e) => ({
        ...e,
        blockNumber:
          e.blockNumber != null ? e.blockNumber.toString() : undefined,
      })),
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'events query failed',
    });
  }
});

/** GET /api/agents/:name/memory */
router.get('/:name/memory', async (req: Request, res: Response) => {
  if (!agentConfig.enabled) {
    res.status(503).json({ error: 'Agents disabled' });
    return;
  }
  const rawName = req.params.name;
  const name = Array.isArray(rawName) ? rawName[0] : rawName;
  if (!name || !isAgentName(name)) {
    res.status(404).json({ error: 'Unknown agent' });
    return;
  }
  try {
    const memory = await agentRuntime().store.listMemory(name, 100);
    res.json({ agent: name, memory });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'memory query failed',
    });
  }
});

/** POST /api/agents/events — inject domain event (ops / tests / webhooks) */
router.post('/events', async (req: Request, res: Response) => {
  if (!agentConfig.enabled) {
    res.status(503).json({ error: 'Agents disabled' });
    return;
  }
  try {
    const body = req.body as {
      name?: DomainEventName;
      idempotencyKey?: string;
      payload?: Record<string, unknown>;
      source?: 'api' | AgentName;
    };
    if (!body.name || !body.idempotencyKey) {
      res.status(400).json({ error: 'name and idempotencyKey required' });
      return;
    }
    const recorded = await agentRuntime().emit({
      name: body.name,
      source: body.source ?? 'api',
      idempotencyKey: body.idempotencyKey,
      payload: body.payload ?? {},
    });
    res.status(recorded ? 202 : 200).json({
      accepted: Boolean(recorded),
      duplicate: !recorded,
      event: recorded
        ? {
            ...recorded,
            blockNumber:
              recorded.blockNumber != null
                ? recorded.blockNumber.toString()
                : undefined,
          }
        : null,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'emit failed',
    });
  }
});

/**
 * POST /api/agents/nexa/ask — member-scoped Nexa assistant.
 * Requires x-wallet-address. Never answers with other members' private data.
 */
router.post('/nexa/ask', async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req).toLowerCase();
    const body = req.body as {
      question?: string;
      memberFacts?: Record<string, unknown>;
      treasuryHealth?: Record<string, unknown>;
      loanPrincipal?: number;
      termMonths?: number;
    };
    const question = body.question?.trim();
    if (!question) {
      res.status(400).json({ error: 'question is required' });
      return;
    }

    // Fast path for interest quotes without full agent runtime
    if (
      /interest|repay|monthly payment/i.test(question) &&
      body.loanPrincipal &&
      body.termMonths
    ) {
      try {
        const quote = quoteLoanInterest(body.loanPrincipal, body.termMonths);
        res.json({
          answer: `For a ${quote.termMonths}-month loan of ${quote.principal}: interest is ${quote.interestRatePercent}% (simple), total interest ${quote.totalInterest}, total repayment ${quote.totalRepayment}, monthly payment ≈ ${quote.monthlyPayment.toFixed(2)}.`,
          quote,
          agent: 'nexa',
        });
        return;
      } catch {
        // fall through to agent
      }
    }

    if (!agentConfig.enabled) {
      // Offline assist for interest schedule only
      res.json({
        answer:
          'Nexa agents are offline. Loan interest schedule: 1m 5%, 2m 6%, 3m 7%, 4m 8%, 5m 9%, 6m 10% (simple interest on principal). Enable AGENTS_ENABLED for full answers.',
        agent: 'nexa',
        offline: true,
      });
      return;
    }

    const idempotencyKey = `nexa:${wallet}:${Date.now()}:${question.slice(0, 48)}`;
    const event = await agentRuntime().emit({
      name: 'nexa.question',
      source: 'api',
      idempotencyKey,
      payload: {
        question,
        memberWallet: wallet,
        memberFacts: body.memberFacts ?? {},
        treasuryHealth: body.treasuryHealth,
        loanPrincipal: body.loanPrincipal,
        termMonths: body.termMonths,
      },
    });

    // Synchronously process Nexa for interactive UX
    const nexa = agentRuntime().agents.find((a) => a.name === 'nexa');
    if (!nexa || !event) {
      res.status(202).json({
        accepted: true,
        message: 'Question queued; poll memory for answer',
        idempotencyKey,
      });
      return;
    }

    const result = await nexa.handle(event, {
      remember: (k, v) => agentRuntime().store.remember('nexa', k, v),
      recall: (k) => agentRuntime().store.recall('nexa', k),
      audit: (action, status, detail, idk, tx) =>
        agentRuntime().store.audit('nexa', action, status, detail, idk, tx),
      wallet: agentRuntime().wallets.wallet('nexa'),
    });

    const answer =
      (result.decision.evidence?.answer as string | undefined) ??
      (result.decision.reasons.join(' ') || 'No answer generated.');

    await agentRuntime().store.audit(
      'nexa',
      'answer',
      'success',
      { question, answer, wallet },
      idempotencyKey,
    );

    res.json({
      answer,
      decision: result.decision,
      agent: 'nexa',
      memberWallet: wallet,
    });
  } catch (error) {
    const status =
      error && typeof error === 'object' && 'status' in error
        ? Number((error as { status: number }).status)
        : 500;
    res.status(status || 500).json({
      error: error instanceof Error ? error.message : 'nexa ask failed',
    });
  }
});

/** GET /api/agents/loans/quote?principal=&termMonths= */
router.get('/loans/quote', (req: Request, res: Response) => {
  try {
    const principal = Number(req.query.principal);
    const termMonths = Number(req.query.termMonths);
    const amountPaid = Number(req.query.amountPaid ?? 0);
    const quote = quoteLoanInterest(principal, termMonths, amountPaid);
    res.json({ quote, schedule: { 1: 5, 2: 6, 3: 7, 4: 8, 5: 9, 6: 10 } });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : 'invalid quote request',
    });
  }
});

export default router;
