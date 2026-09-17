import { Injectable } from '@nestjs/common';

/**
 * Adaptateur LLM externe de l'Assistant Shield ("LLM-ready").
 *
 * Par défaut, aucune clé n'est configurée : l'assistant utilise le moteur
 * NLU intégré (nlu.ts), 100 % hors-ligne. Pour activer un vrai modèle de
 * langage, définir dans `.env` :
 *
 *   LLM_PROVIDER=openai                 # active l'adaptateur
 *   LLM_API_KEY=sk-...                  # clé API
 *   LLM_MODEL=gpt-4o-mini               # (optionnel)
 *   LLM_BASE_URL=https://api.openai.com/v1   # (optionnel, compatible
 *                                       #  avec tout endpoint OpenAI-like :
 *                                       #  OpenRouter, Mistral, Ollama…)
 *
 * En cas d'échec réseau/modèle, le service retombe silencieusement sur
 * le moteur intégré : la conversation ne casse jamais.
 */

export interface LlmTurn {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable()
export class LlmService {
  private histories = new Map<string, LlmTurn[]>();

  get available(): boolean {
    return process.env.LLM_PROVIDER === 'openai' && !!process.env.LLM_API_KEY;
  }

  get provider(): string {
    return this.available ? `llm:${process.env.LLM_MODEL || 'gpt-4o-mini'}` : 'builtin-nlu';
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
    if (!this.available) return null;
    try {
      const history = this.histories.get(userId) || [];
      const body = {
        model: process.env.LLM_MODEL || 'gpt-4o-mini',
        temperature: 0.4,
        max_tokens: 400,
        messages: [
          { role: 'system', content: this.systemPrompt(userName, context) },
          ...history.slice(-6),
          { role: 'user', content: message },
        ],
      };
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(`${process.env.LLM_BASE_URL || 'https://api.openai.com/v1'}/chat/completions`, {
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
