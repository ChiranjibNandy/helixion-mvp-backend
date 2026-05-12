import { IProgram } from "../interfaces/program.interface.js";

// the programme datas that shown in employee side
export const programResponseMapper = (programs: IProgram[]) => {
   return programs.map((program) => {
      const start = program.startDate
         ? new Date(program.startDate)
         : null;

      const end = program.endDate
         ? new Date(program.endDate)
         : null;

      let duration: number | null = null;

      if (start && end) {
         const diff = end.getTime() - start.getTime();

         duration = Math.ceil(diff / (1000 * 60 * 60 * 24));
      }

      return {
         title: program.title,
         venue: program.venue,
         start_date: start,
         end_date: end,
         duration,
      };
   });
};