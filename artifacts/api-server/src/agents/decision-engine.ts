import type { AgentDecision, AgentName } from './types';
import { agentConfig } from './config';
import { promptFor } from './prompts';
import { toolsFor } from './tools';
import { logger } from '../lib/logger';

const DECISION_ENUM = [
  'approved',
  'rejected',
  'governance_review',
  'recommendation',
  'notify',
  'noop',
] as const;

const RISK_ENUM = ['low', 'medium', 'high', 'critical'] as const;

const decisionSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'decision',
    'confidence',
    'reasons',
    'risk',
    'requiresHumanApproval',
    'evidence',
  ],
  properties: {
    decision: {
      type: 'string',
      enum: [...DECISION_ENUM],
    },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    reasons: { type: 'array', items: { type: 'string' } },
    risk: {
      type: 'string',
      enum: [...RISK_ENUM],
    },
    requiresHumanApproval: { type: 'boolean' },
    evidence: { type: 'object', additionalProperties: true },
  },
} as const;

function failClosed(
  reasons: string[],
  evidence: Record<string, unknown> = {},
): AgentDecision {
  return {
    decision: 'governance_review',
    confidence: 0,
    risk: 'medium',
    requiresHumanApproval: true,
    reasons,
    evidence,
  };
}

function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) return trimmed;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

function parseDecision(raw: string, context: Record<string, unknown>): AgentDecision {
  try {
    const parsed = JSON.parse(extractJsonObject(raw)) as Partial<AgentDecision>;
    const decision = DECISION_ENUM.includes(parsed.decision as (typeof DECISION_ENUM)[number])
      ? (parsed.decision as AgentDecision['decision'])
      : 'governance_review';
    const risk = RISK_ENUM.includes(parsed.risk as (typeof RISK_ENUM)[number])
      ? (parsed.risk as AgentDecision['risk'])
      : 'medium';
    const confidence =
      typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)
        ? Math.min(1, Math.max(0, parsed.confidence))
        : 0;
    return {
      decision,
      confidence,
      risk,
      requiresHumanApproval:
        typeof parsed.requiresHumanApproval === 'boolean'
          ? parsed.requiresHumanApproval
          : decision === 'governance_review',
      reasons: Array.isArray(parsed.reasons)
        ? parsed.reasons.map(String)
        : ['Model returned incomplete decision payload'],
      evidence:
        parsed.evidence && typeof parsed.evidence === 'object'
          ? (parsed.evidence as Record<string, unknown>)
          : { ...context },
    };
  } catch {
    return failClosed(
      ['Failed to parse model JSON decision; fail closed.', raw.slice(0, 400)],
      context,
    );
  }
}

function messageContent(
  content: string | Array<{ type?: string; text?: string }> | null | undefined,
): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  return content
    .map((part) => (typeof part === 'object' && part && 'text' in part ? part.text ?? '' : ''))
    .join('');
}

/**
 * Structured decision engine for OpenAI-compatible gateways
 * (AgentRouter, OpenRouter, xAI, etc.) via chat.completions.
 * Fail-closed when the model is unavailable.
 */
export class DecisionEngine {
  private get configured(): boolean {
    return Boolean(agentConfig.llmApiKey);
  }

  async decide(
    agent: AgentName,
    context: Record<string, unknown>,
    extraInstructions?: string,
  ): Promise<AgentDecision> {
    if (!this.configured) {
      return failClosed(
        [
          'LLM decision engine is not configured (set OPENROUTER_API_KEY=sk-or-v1-… from openrouter.ai/keys); fail closed.',
          agentConfig.llmAuthHint ?? '',
        ].filter(Boolean),
        context,
      );
    }

    const tools = toolsFor(agent).map((t) => ({
      name: t.name,
      kind: t.kind,
      description: t.description,
    }));

    const instructions = [
      promptFor(agent),
      extraInstructions ?? '',
      'Never authorize money movement outside the permitted contract tools.',
      'Funds always remain in smart contracts; agents never custody USDC.',
      'Respond with a single JSON object only (no markdown) matching this schema:',
      JSON.stringify(decisionSchema),
      `Available tools: ${JSON.stringify(tools)}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    try {
      const content = await this.chat(
        instructions,
        JSON.stringify({ agent, context }),
        /* jsonMode */ true,
      );
      if (!content) {
        return failClosed(['Empty model response; fail closed.'], context);
      }
      return parseDecision(content, context);
    } catch (error) {
      logger.error({ agent, err: error }, 'Decision engine failed');
      return failClosed(
        [
          'Decision engine error; fail closed.',
          error instanceof Error ? error.message : String(error),
        ],
        context,
      );
    }
  }

  /**
   * Free-form assistant answer for Nexa (still constrained by system prompt).
   */
  async answer(
    agent: AgentName,
    question: string,
    memberScopedContext: Record<string, unknown>,
  ): Promise<{ answer: string; decision: AgentDecision }> {
    if (!this.configured) {
      return {
        answer:
          'Nexa is temporarily unavailable (AI not configured). Please try again later.',
        decision: failClosed(['Nexa LLM not configured']),
      };
    }

    try {
      const system = `${promptFor(agent)}

Answer in clear plain language for a cooperative member.
Never reveal other members' private data.
If the context lacks the answer, say what is missing.
Keep answers under 400 words unless the user asks for detail.`;

      const answer =
        (
          await this.chat(
            system,
            JSON.stringify({ question, context: memberScopedContext }),
            /* jsonMode */ false,
          )
        )?.trim() || 'I could not generate an answer.';

      return {
        answer,
        decision: {
          decision: 'recommendation',
          confidence: 0.7,
          reasons: ['Nexa assistant response'],
          risk: 'low',
          requiresHumanApproval: false,
          evidence: { question },
        },
      };
    } catch (error) {
      logger.error({ agent, err: error }, 'Nexa answer failed');
      return {
        answer: 'Something went wrong answering that. Please try again.',
        decision: failClosed([
          error instanceof Error ? error.message : String(error),
        ]),
      };
    }
  }

  /** Prefer configured model, then free/cheap gateway models. */
  private modelCandidates(): string[] {
    const primary = agentConfig.llmModel;
    const host = agentConfig.llmBaseHost.toLowerCase();
    const extras = host.includes('openrouter')
      ? [
          'openai/gpt-4o-mini',
          'google/gemini-2.0-flash-001',
          'anthropic/claude-3.5-sonnet',
          'meta-llama/llama-3.3-70b-instruct',
        ]
      : host.includes('agentrouter')
        ? [
            'glm-4.5-air',
            'gpt-4o-mini',
            'claude-haiku-3-5-20241022',
            'deepseek-r1',
          ]
        : [];
    return [...new Set([primary, ...extras].filter(Boolean))];
  }

  /**
   * chat.completions via raw HTTP for reliable gateway errors
   * (AgentRouter / OpenRouter / xAI). Tries multiple models when needed.
   */
  private async chat(
    system: string,
    user: string,
    jsonMode: boolean,
  ): Promise<string> {
    if (!agentConfig.llmApiKey) return '';

    const messages = [
      { role: 'system' as const, content: system },
      { role: 'user' as const, content: user },
    ];

    const errors: string[] = [];
    for (const model of this.modelCandidates()) {
      try {
        return await this.chatOnce(model, messages, jsonMode);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        errors.push(`${model}: ${msg}`);
        logger.warn(
          { model, host: agentConfig.llmBaseHost, err: error },
          'LLM model attempt failed; trying next',
        );
      }
    }
    throw new Error(
      `All LLM models failed (host=${agentConfig.llmBaseHost}): ${errors.join(' | ')}`,
    );
  }

  private async chatOnce(
    model: string,
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    jsonMode: boolean,
  ): Promise<string> {
    const base = agentConfig.llmBaseUrl.replace(/\/+$/, '');
    const url = `${base}/chat/completions`;

    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: 0.2,
      max_tokens: jsonMode ? 1200 : 800,
    };
    if (jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    const doFetch = async (payload: Record<string, unknown>) => {
      const apiKey = agentConfig.llmApiKey?.trim();
      if (!apiKey) {
        throw new Error(
          'LLM API key missing at request time. Set OPENROUTER_API_KEY on Vercel (Production) and redeploy.',
        );
      }
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'https://nexusu-v0.vercel.app',
          'X-Title': 'Nexusu Agents',
        },
        body: JSON.stringify(payload),
      });
      const raw = await res.text();
      if (
        /aliyun_waf/i.test(raw) ||
        (/^\s*<!doctype html/i.test(raw) && !raw.trimStart().startsWith('{'))
      ) {
        throw new Error(
          `Gateway returned WAF/HTML instead of JSON (host=${agentConfig.llmBaseHost}). ` +
            'Set AGENTROUTER_BASE_URL=https://agentrouter.org/v1 (same as Claude Code).',
        );
      }
      let data: Record<string, unknown> = {};
      try {
        data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      } catch {
        throw new Error(
          `Non-JSON LLM response HTTP ${res.status}: ${raw.slice(0, 240)}`,
        );
      }
      if (!res.ok) {
        const errObj = data.error as { message?: string } | string | undefined;
        const errMsg =
          (typeof errObj === 'object' && errObj?.message) ||
          (typeof errObj === 'string' ? errObj : undefined) ||
          (typeof data.msg === 'string' ? data.msg : undefined) ||
          (typeof data.message === 'string' ? data.message : undefined) ||
          raw.slice(0, 400) ||
          res.statusText;
        throw new Error(`HTTP ${res.status}: ${errMsg}`);
      }
      return data;
    };

    let data: Record<string, unknown>;
    try {
      data = await doFetch(body);
    } catch (error) {
      // Some gateways reject response_format; retry plain JSON instruction only
      if (jsonMode) {
        logger.warn(
          { model, err: error },
          'json response_format rejected; retrying without it',
        );
        const { response_format: _rf, ...plain } = body;
        data = await doFetch(plain);
      } else {
        throw error;
      }
    }

    const content = extractCompletionText(data);
    if (!content) {
      throw new Error(
        `empty completion body: ${JSON.stringify(data).slice(0, 400)}`,
      );
    }
    return content;
  }
}

function extractCompletionText(data: Record<string, unknown>): string {
  const choices = data.choices;
  if (Array.isArray(choices) && choices[0]) {
    const c0 = choices[0] as Record<string, unknown>;
    const message = c0.message as
      | { content?: string | Array<{ type?: string; text?: string }> }
      | undefined;
    if (message?.content != null) {
      return messageContent(message.content);
    }
    if (typeof c0.text === 'string') return c0.text;
    if (typeof c0.content === 'string') return c0.content;
  }
  if (typeof data.output_text === 'string') return data.output_text;
  if (typeof data.content === 'string') return data.content;
  // Anthropic-ish passthrough
  const content = data.content;
  if (Array.isArray(content)) {
    return content
      .map((p) =>
        typeof p === 'object' && p && 'text' in p
          ? String((p as { text?: string }).text ?? '')
          : '',
      )
      .join('');
  }
  return '';
}
