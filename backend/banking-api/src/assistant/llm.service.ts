import { Injectable } from '@nestjs/common';

/**
 * Adaptateur LLM externe de l'Assistant Shield ("LLM-ready").
 *
 * Par défaut, aucune clé n'est configurée : l'assistant utilise le moteur
 * NLU intégré (nlu.ts), 100 % hors-ligne. Pour activer un vrai modèle de
 * langage, définir dans `.env` :
 *
 *   Option 1 — Gemini (gratuit, recommandé) :
 *     LLM_PROVIDER=gemini
 *     LLM_API_KEY=AIza...                          # clé Google AI Studio
 *     LLM_MODEL=gemini-2.5-flash                   # (optionnel)
 *     # LLM_BASE_URL auto : https://generativelanguage.googleapis.com/v1beta/openai
 *
 *   Option 2 — OpenAI ou tout endpoint compatible :
 *     LLM_PROVIDER=openai
 *     LLM_API_KEY=sk-...
 *     LLM_MODEL=gpt-4o-mini                        # (optionnel)
 *     LLM_BASE_URL=https://api.openai.com/v1       # (optionnel : OpenRouter,
 *                                                  #  Mistral, Ollama…)
 *
 * En cas d'échec réseau/modèle, le service retombe silencieusement sur
 * le moteur intégré : la conversation ne casse jamais.
 */

export interface LlmTurn {
  role: 'user' | 'assistant';
  content: string;
}

const PROVIDERS: Record<string, { baseUrl: string; defaultModel: string }> = {
  gemini: {
    // Endpoint officiel de compatibilité OpenAI de Google (free tier AI Studio).
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

  get available(): boolean {
    return !!this.providerCfg && !!process.env.LLM_API_KEY;
  }

  get provider(): string {
    if (!this.available || !this.providerCfg) return 'builtin-nlu';
    return `llm:${process.env.LLM_MODEL || this.providerCfg.defaultModel}`;
  }

  /** Construit le prompt système avec le contexte bancaire live du client. */
  private systemPrompt(userName: string, context: string): string {
    return [
      "Tu es Shield, l'assistant bancaire virtuel de la banque Shield (application FINGUARD).",
      'Tu réponds au client de façon claire, concise et bienveillante, en français sauf si le client écrit en anglais.',
      'Contexte live du client (données réelles de son espace) :',
      context,
      `Client : ${userName}.`,
      "Règles : ne jamais inventer de solde ou de transaction ; s'appuyer uniquement sur le contexte fourni.",
      "Pour les questions générales (frais, limites, fonctionnement de la détection de fraude), répondre avec les informations de Shield.",
      'Réponses courtes (2 à 5 phrases), sans markdown.',
    ].join('\n');
  }

  /**
   * Interroge le modèle externe. Retourne `null` si indisponible ou en
   * erreur — l'appelant bascule alors sur le moteur intégré.
   */
  async ask(userId: string, userName: string, message: string, context: string): Promise<string | null> {
    const cfg = this.providerCfg;
    if (!cfg || !process.env.LLM_API_KEY) return null;
    try {
      const history = this.histories.get(userId) || [];
      const model = process.env.LLM_MODEL || cfg.defaultModel;
      const baseUrl = (process.env.LLM_BASE_URL || cfg.baseUrl).replace(/\/+$/, '');
      const body: any = {
        model,
        temperature: 0.4,
        messages: [
          { role: 'system', content: this.systemPrompt(userName, context) },
          ...history.slice(-6),
          { role: 'user', content: message },
        ],
      };
      // Gemini préfère max_output_tokens via `max_completion_tokens` sur la
      // couche de compatibilité OpenAI ; OpenAI accepte max_tokens.
      if ((process.env.LLM_PROVIDER || '').toLowerCase() === 'gemini') {
        body.max_completion_tokens = 400;
      } else {
        body.max_tokens = 400;
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.LLM_API_KEY}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) return null;
      const data: any = await res.json();
      const reply = data?.choices?.[0]?.message?.content?.trim();
      if (!reply) return null;
      history.push({ role: 'user', content: message }, { role: 'assistant', content: reply });
      this.histories.set(userId, history.slice(-8));
      return reply;
    } catch {
      return null; // Repli automatique sur le moteur intégré.
    }
  }
}
