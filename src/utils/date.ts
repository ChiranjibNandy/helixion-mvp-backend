export const getUTCStartOfDay = (): Date => {

   const now = new Date();

   return new Date(
      Date.UTC(
         now.getUTCFullYear(),
         now.getUTCMonth(),
         now.getUTCDate(),
         0,
         0,
         0,
         0
      )
   );
};

export const toDateString = (date: Date | string): string => {
   return new Date(date).toISOString().slice(0, 10);
};

export const todayDateString = (): string => toDateString(new Date());

export const getDateRangeStrings = (start: Date | string, end?: Date | string | null): string[] => {
   const startDate = new Date(toDateString(start));
   const endDate = new Date(toDateString(end ?? start));

   const days: string[] = [];
   for (let d = startDate; d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
      days.push(toDateString(d));
   }
   return days;
};