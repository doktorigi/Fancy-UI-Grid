export interface Policy {
  id: number;
  company: string;
  program: string;
  state: string;
  policyNo: string;
  policyEff: string;
  premium: number;
  selected?: boolean;
}

export interface ResultPolicy extends Policy {
  currentPremium: number;
  newPremium: number;
  difference: number;
  raterVersion?: string;
  premiumHistory?: number[]; // trailing 12 months, sparkline demo
  premiumDeltas?: number[]; // month-over-month sign, win/loss sparkline demo
}
