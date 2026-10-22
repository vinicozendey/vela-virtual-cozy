export type PlanId = 'free' | 'novena' | 'quaresma';
export type CandleStatus = 'pending_review' | 'pending_payment' | 'active' | 'ended' | 'hidden' | 'deleted';
export type Candle = {
  id: string; title: string; intention: string; plan: PlanId; saintId: string | null; theme: string;
  status: CandleStatus; startsAt: number | null; endsAt: number | null; cycleId: string | null;
  prayerCount: number; messageCount?: number; messages: { id: string; name: string; text: string; createdAt: number }[];
  createdAt?: number; editedAt?: number | null; scheduledCycle?: { plan: PlanId; startsAt: number } | null; lastCycleEndedAt?: number | null;
};
export type Order = {
  id: string; candleId: string; type: 'candle' | 'renewal' | 'donation'; plan: PlanId | null;
  amount: number; status: 'creating' | 'pending' | 'paid' | 'expired' | 'failed' | 'refunded' | 'review_required';
  pixCode?: string; qrCode?: string; expiresAt?: number;
};
export type UserProfile = { email: string; dailySummary: boolean; admin: boolean };

