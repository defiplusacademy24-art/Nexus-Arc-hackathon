import OpenAI from 'openai';
import type { AgentDecision, AgentName } from './types';
import { agentConfig } from './config';
import { promptFor } from './prompts';
import { toolsFor } from './tools';
import { logger } from '../lib/logger';

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
      enum: [
        'approved',
        'rejected',
        'governance_review',
        'recommendation',
        'notify',
        'noop',
      ],
    },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    reasons: { type: 'array', items: { type: 'string' } },
    risk: {
      type: 'string',
      enum: ['low', 'medium', 'high', 'critical'],
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

/**
 * Structured decision engine powered by SpaceXAI (xAI OpenAI-compatible API).
 * Fail-closed when the model is unavailable.
 */
export class DecisionEngine {
  private readonly client: OpenAI | null;

  constructor() {
    this.client = agentConfig.llmApiKey
      ? new OpenAI({
          apiKey: agentConfig.llmApiKey,
          baseURL: agentConfig.llmBaseUrl,
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
          'LLM decision engine is not configured (set XAI_API_KEY); fail closed.',
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
      'Return only JSON matching the agent_decision schema.',
      `Available tools: ${JSON.stringify(tools)}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    try {
      const response = await this.client.responses.create({
        model: agentConfig.llmModel,
        instructions,
        input: JSON.stringify({ agent, context }),
        text: {
          format: {
            type: 'json_schema',
            name: 'agent_decision',
            strict: true,
            schema: decisionSchema,
          },
        },
      });

      const parsed = JSON.parse(response.output_text) as AgentDecision;
      if (!parsed.reasons) parsed.reasons = [];
      if (!parsed.evidence) parsed.evidence = {};
      return parsed;
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
      const response = await this.client.responses.create({
        model: agentConfig.llmModel,
        instructions: `${promptFor(agent)}

Answer in clear plain language for a cooperative member.
Never reveal other members' private data.
If the context lacks the answer, say what is missing.
Keep answers under 400 words unless the user asks for detail.`,
        input: JSON.stringify({ question, context: memberScopedContext }),
      });

      const answer = response.output_text?.trim() || 'I could not generate an answer.';
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
}
