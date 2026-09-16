import { Injectable } from '@nestjs/common';
import { uuid } from '../common/utils';

export interface ExternalTxResult {
  success: boolean;
  externalReference?: string;
  failureReason?: string;
}

/**
 * Service bancaire/de paiement externe (cahier des charges §31).
 * Simulé pour le prototype : interface prête pour un vrai fournisseur
 * (validation, traitement, référence externe, statut d'échec).
 */
@Injectable()
export class ExternalBankService {
  async process(tx: { reference: string; type: string; amount: number; description?: string }): Promise<ExternalTxResult> {
    // Latence réseau simulée.
    await new Promise((r) => setTimeout(r, 50 + Math.random() * 120));

    // Simulation d'un rejet externe déterministe (pour la démonstration).
    if (tx.description && tx.description.toUpperCase().includes('ECHEC-EXTERNE')) {
      return { success: false, failureReason: 'Rejet par le service bancaire externe.' };
    }
    return { success: true, externalReference: `EXT-${uuid().slice(0, 8).toUpperCase()}` };
  }
}
