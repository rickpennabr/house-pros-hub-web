import { REFERRAL_MY_FRIEND, REFERRAL_OTHER } from '@/lib/constants/referral';
import type { ProInviter } from '@/lib/pros/inviter';

interface ProInviteOptionsProps {
  inviters: ProInviter[];
  loading: boolean;
  loadingLabel: string;
  friendLabel: string;
  otherLabel: string;
}

/** Choices for "Who invited you?": My friend, every pro, then Other. */
export function ProInviteOptions({
  inviters,
  loading,
  loadingLabel,
  friendLabel,
  otherLabel,
}: ProInviteOptionsProps) {
  return (
    <>
      <option value={REFERRAL_MY_FRIEND}>{friendLabel}</option>
      {loading && inviters.length === 0 ? <option disabled>{loadingLabel}</option> : null}
      {inviters.map((inviter) => (
        <option key={inviter.id} value={inviter.label}>
          {inviter.label}
        </option>
      ))}
      <option value={REFERRAL_OTHER}>{otherLabel}</option>
    </>
  );
}
