import { Injectable } from '@nestjs/common';

export interface LlmTurn {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface FraudAiAssessment {
  riskAdjustment: number;
  reason: string;
}

const PROVIDERS: Record<string, { baseUrl: string; defaultModel: string }> = {
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.5-flash',
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
  },
};

@Injectable()
export class LlmService {
  private histories = new Map<string, LlmTurn[]>();

  private get providerCfg() {
    const name = (process.env.LLM_PROVIDER || '').toLowerCase();
    return PROVIDERS[name] || null;
  }

  private get apiKey(): string | undefined {
    return process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
  }

  get available(): boolean {
    return !!this.providerCfg && !!this.apiKey;
  }

  get provider(): string {
    if (!this.available || !this.providerCfg) return 'builtin-nlu';
    return `llm:${process.env.LLM_MODEL || this.providerCfg.defaultModel}`;
  }

  private async complete(messages: LlmTurn[], maxTokens: number, json = false): Promise<string | null> {
    const cfg = this.providerCfg;
    if (!cfg || !this.apiKey) return null;
    const model = process.env.LLM_MODEL || cfg.defaultModel;
    const baseUrl = (process.env.LLM_BASE_URL || cfg.baseUrl).replace(/\/+$/, '');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const body: any = { model, temperature: json ? 0 : 0.4, max_tokens: maxTokens, messages };
      if (json) body.response_format = { type: 'json_object' };
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const data: any = await res.json();
      return data?.choices?.[0]?.message?.content?.trim() || null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async ask(userId: string, userName: string, message: string, context: string): Promise<string | null> {
    const history = this.histories.get(userId) || [];
    const reply = await this.complete(
      [
        {
          role: 'system',
          content: [
            "Tu es Shield, l'assistant bancaire virtuel de la banque Shield.",
            'Réponds clairement et brièvement en français sauf si le client écrit en anglais.',
            'Ne jamais inventer un solde ou une transaction. Utilise uniquement le contexte fourni.',
            `Client : ${userName}.`,
            `Contexte live : ${context}`,
          ].join('\n'),
        },
        ...history.slice(-6),
        { role: 'user', content: message },
      ],
      400,
    );
    if (reply) {
      history.push({ role: 'user', content: message }, { role: 'assistant', content: reply });
      this.histories.set(userId, history.slice(-8));
    }
    return reply;
  }

  async assessFraud(context: {
    type: string;
    amount: number;
    beneficiaryName?: string | null;
    paymentMethod?: string | null;
    paymentPhone?: string | null;
    accountBalance: number;
    dailyLimit: number;
    recentTransactionCount: number;
  }): Promise<FraudAiAssessment | null> {
    const prompt = [
      'Évalue le risque contextuel de cette transaction bancaire.',
      'Retourne uniquement un JSON valide : {"riskAdjustment":0,"reason":"courte justification en français"}',
      'riskAdjustment doit être un entier entre 0 et 20 représentant uniquement un risque additionnel.',
      JSON.stringify({
        type: context.type,
        amountXaf: context.amount,
        beneficiaryName: context.beneficiaryName || null,
        paymentMethod: context.paymentMethod || null,
        paymentPhoneProvided: Boolean(context.paymentPhone),
        accountBalanceXaf: context.accountBalance,
        dailyLimitXaf: context.dailyLimit,
        recentTransactionCount: context.recentTransactionCount,
      }),
    ].join('\n');
    const raw = await this.complete(
      [
        {
          role: 'system',
          content: 'Tu es un analyste antifraude bancaire prudent. Ne fournis jamais de données personnelles.',
        },
        { role: 'user', content: prompt },
      ],
      180,
      true,
    );
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      const riskAdjustment = Math.round(Number(parsed.riskAdjustment));
      if (!Number.isFinite(riskAdjustment) || typeof parsed.reason !== 'string') return null;
      return {
        riskAdjustment: Math.max(0, Math.min(20, riskAdjustment)),
        reason: parsed.reason.slice(0, 240),
      };
    } catch {
      return null;
    }
  }
}
