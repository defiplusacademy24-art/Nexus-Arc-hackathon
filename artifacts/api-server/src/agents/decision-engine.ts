import OpenAI from 'openai';
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
  private readonly client: OpenAI | null;

  constructor() {
    this.client = agentConfig.llmApiKey
      ? new OpenAI({
          apiKey: agentConfig.llmApiKey,
          baseURL: agentConfig.llmBaseUrl,
          defaultHeaders: {
            // Some gateways (AgentRouter free tier) fingerprint clients
            'HTTP-Referer': process.env.VERCEL_URL
              ? `https://${process.env.VERCEL_URL}`
              : 'https://nexusu.app',
            'X-Title': 'Nexusu Agents',
          },
        })
      : null;
  }

  async decide(
    agent: AgentName,
    context: Record<string, unknown>,
    extraInstructions?: string,
  ): Promise<AgentDecision> {
    if (!this.client) {
      return failClosed(
        [
          'LLM decision engine is not configured (set OPENAI_API_KEY or XAI_API_KEY); fail closed.',
        ],
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
    if (!this.client) {
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

  /**
   * chat.completions — works with AgentRouter / OpenRouter / xAI.
   * Prefer json_object when supported; fall back to plain text if the gateway rejects it.
   */
  private async chat(
    system: string,
    user: string,
    jsonMode: boolean,
  ): Promise<string> {
    if (!this.client) return '';

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ];

    const attempt = async (useJsonObject: boolean) => {
      const response = await this.client!.chat.completions.create({
        model: agentConfig.llmModel,
        messages,
        ...(useJsonObject ? { response_format: { type: 'json_object' as const } } : {}),
        temperature: 0.2,
        max_tokens: jsonMode ? 1200 : 800,
      });
      const choice = response?.choices?.[0];
      if (!choice) {
        throw new Error(
          `LLM returned no choices (host=${agentConfig.llmBaseHost}, model=${agentConfig.llmModel}). ` +
            'Set OPENAI_AGENT_MODEL (or LLM_MODEL) to a model id your gateway serves.',
        );
      }
      return messageContent(choice.message?.content);
    };

    if (!jsonMode) {
      return attempt(false);
    }

    try {
      return await attempt(true);
    } catch (error) {
      logger.warn(
        { err: error, host: agentConfig.llmBaseHost },
        'json_object response_format rejected; retrying without it',
      );
      return attempt(false);
    }
  }
}
