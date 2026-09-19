import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { beneficiaries, customers } from '../database/connection';
import { nowIso, uuid } from '../common/utils';

export interface AddBeneficiaryDto {
  name: string;
  accountNumber: string;
  bankLabel?: string;
}

/** Bénéficiaires de virement enregistrés par le client. */
@Injectable()
export class BeneficiariesService {
  private customerOf(userId: string) {
    const customer = customers.first('user_id = ?', [userId]);
    if (!customer) throw new NotFoundException('Profil client introuvable.');
    return customer;
  }

  list(userId: string) {
    const customer = this.customerOf(userId);
    return beneficiaries.all('customer_id = ?', [customer.id], 'created_at DESC');
  }

  add(userId: string, dto: AddBeneficiaryDto) {
    const customer = this.customerOf(userId);
    const accountNumber = (dto.accountNumber || '').trim().toUpperCase();
    if (!accountNumber) throw new NotFoundException('Numéro de compte requis.');
    if (beneficiaries.first('customer_id = ? AND account_number = ?', [customer.id, accountNumber])) {
      throw new ConflictException('Ce bénéficiaire est déjà enregistré.');
    }
    return beneficiaries.insert({
      id: uuid(),
      customerId: customer.id,
      name: dto.name.trim(),
      accountNumber,
      bankLabel: dto.bankLabel?.trim() || 'Shield',
      createdAt: nowIso(),
    });
  }

  remove(userId: string, id: string) {
    const customer = this.customerOf(userId);
    const row = beneficiaries.byId(id);
    if (!row || row.customerId !== customer.id) throw new NotFoundException('Bénéficiaire introuvable.');
    beneficiaries.remove('id = ?', [id]);
    return { deleted: true };
  }
}
