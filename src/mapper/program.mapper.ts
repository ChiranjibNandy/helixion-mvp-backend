import { IProgram } from "../interfaces/program.interface.js";

// the programme datas that shown in employee side 
export const programResponseMapper = (programs: IProgram[]) => {
   return programs.map((program) => {
      const start = program.startDate;
      const end = program.endDate;

      let duration: number | null = null;

      if (start && end) {
         const diff = end.getTime() - start.getTime();
         duration = Math.ceil(diff / (1000 * 60 * 60 * 24));
      }

      return {
         title: program.title,
         venue: program.venue,
         start_date: program.startDate,
         end_date: program.endDate,
         duration,
      };
   });
};