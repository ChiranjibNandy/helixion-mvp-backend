export interface getReleventEnrollRequestDto {
   managerId: string,
   page: number,
   limit: number,
   search: string
}

export interface SubmitTourFormDto {
   stayType?: string;
   placeOfTour?: string;
   frequentFlyerNo?: string;
   modeOfTravel?: string;
   purpose?: string;
   advancePaymentRequired?: number;
   bookingDetails?: any[];
   travelType?: string;
}