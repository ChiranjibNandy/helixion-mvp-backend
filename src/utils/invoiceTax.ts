export const GST_RATE_PERCENT = 18;

export interface InvoiceTaxInput {
  subtotalPaise: number;
  discountPercent: number;
  providerStateCode: string;
  buyerStateCode: string;
}

export interface InvoiceTaxBreakdown {
  subtotalPaise: number;
  discountPaise: number;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
}

const percentOf = (amountPaise: number, percent: number) =>
  Math.round((amountPaise * percent) / 100);

export const computeInvoiceTax = (input: InvoiceTaxInput): InvoiceTaxBreakdown => {
  const discountPaise = percentOf(input.subtotalPaise, input.discountPercent);
  const taxablePaise = input.subtotalPaise - discountPaise;
  const taxPaise = percentOf(taxablePaise, GST_RATE_PERCENT);

  const isIntraState = input.providerStateCode === input.buyerStateCode;
  const cgstPaise = isIntraState ? Math.round(taxPaise / 2) : 0;
  const sgstPaise = isIntraState ? taxPaise - cgstPaise : 0;
  const igstPaise = isIntraState ? 0 : taxPaise;

  return {
    subtotalPaise: input.subtotalPaise,
    discountPaise,
    taxablePaise,
    cgstPaise,
    sgstPaise,
    igstPaise,
    totalPaise: taxablePaise + taxPaise,
  };
};
