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