import { PROGRAM_SAVED_STATUS } from '../constants/enum.js';
import { IProgram } from '../interfaces/program.interface.js';
import Program from '../models/program.model.js'
import { GetPublishedProgramsParams } from '../types/program.js';
import programModel from '../models/program.model.js';
import { getUTCStartOfDay } from '../utils/date.js';
import { toObjectId } from '../utils/mongo.js';

/** Reusable filter for owner-scoped program queries */
const buildOwnerFilter = (id: string, providerId: string) => ({
  _id: id,
  createdBy: providerId,
});

// Retrieve all active programs
export const getAvailableProgramsRepo = async () => {
  return await Program.find({ status: PROGRAM_SAVED_STATUS.PUBLISHED });
};

export interface ProgramFilterParams {
  page:      number;
  limit:     number;
  search?:   string;   
  venue?:    string;   
  fromDate?: string;   
  toDate?:   string;  
}

// paginated + filter program list for the employee browse view
export const getAvailableProgramsPaginatedRepo = async (params: ProgramFilterParams) => {
  const { page, limit, search, venue, fromDate, toDate } = params;
  const skip   = (page - 1) * limit;
  const filter: any = { status: PROGRAM_SAVED_STATUS.PUBLISHED };

  if (search)   filter.title = { $regex: search, $options: "i" };
  if (venue)    filter.venue = { $regex: venue,  $options: "i" };

  if (fromDate || toDate) {
    filter.startDate = {};
    if (fromDate) filter.startDate.$gte = new Date(fromDate);
    if (toDate)   filter.startDate.$lte = new Date(toDate);
  }

  const [programs, total] = await Promise.all([
    Program.find(filter)
      .populate("createdBy", "name email")
      .sort({ startDate: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Program.countDocuments(filter),
  ]);

  return {
    programs,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

//create program

export const createProgramRepo = async (data: IProgram) => {
  return await Program.create(data);
};


export const programBulkInsert = async (data: any[]) => {
  return await Program.insertMany(data);
};

export const getLastBatchId = async () => {
  return await Program.findOne({
    batchId: { $ne: null },
  }).sort({ createdAt: -1 });
};

//get all published program Repo

export const getPublishedProgramsRepo = async ({
  trainingProviderId,
  page,
  limit,
}: GetPublishedProgramsParams) => {
  const skip = (page - 1) * limit;

  const filter = {
    createdBy: trainingProviderId,
    status: PROGRAM_SAVED_STATUS.PUBLISHED,
  };

  const [programs, total] = await Promise.all([
    Program.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Program.countDocuments(filter),
  ]);

  return {
    programs,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}


export const getDraftProgramsRepo = async (
  providerId: string,
  skip: number,
  limit: number,
  search?: string
) => {
  const query: any = {
    createdBy: providerId,
    status: PROGRAM_SAVED_STATUS.DRAFT,
  };

  if (search) {
    query.title = { $regex: search, $options: "i" };
  }

  const [programs, total] = await Promise.all([
    Program.find(query).sort({ updatedAt: -1 }).skip(skip).limit(limit),
    Program.countDocuments(query),
  ]);

  return { programs, total };
};

export const getProgramByIdRepo = async (id: string, providerId: string) => {
  return await Program.findOne(buildOwnerFilter(id, providerId));
};

export const updateProgramRepo = async (id: string, providerId: string, data: Partial<IProgram>) => {
  return await Program.findOneAndUpdate(
    buildOwnerFilter(id, providerId),
    { $set: data },
    { returnDocument: 'after', runValidators: true }
  );
};

export const deleteProgramRepo = async (id: string, providerId: string) => {
  return await Program.findOneAndDelete(buildOwnerFilter(id, providerId));
};

//Live program count

export const getLiveProgramsCount = async (
  trainingProviderId: string
) => {

  return await Program.countDocuments({
    createdBy: toObjectId(trainingProviderId),
    status: PROGRAM_SAVED_STATUS.PUBLISHED
  });
};

// Draft Program count
export const getDraftProgramsCount = async (
  trainingProviderId: string
) => {

  return await Program.countDocuments({
    createdBy: toObjectId(trainingProviderId),
    status: PROGRAM_SAVED_STATUS.DRAFT
  });
};

// AVERAGE FILL RATE

export const getAverageFillRate = async (
  trainingProviderId: string
) => {

  const result = await Program.aggregate([

    {
      $match: {
        createdBy: toObjectId(trainingProviderId),
        status: PROGRAM_SAVED_STATUS.PUBLISHED
      }
    },

    {
      $lookup: {
        from: "enrollments",
        localField: "_id",
        foreignField: "programId",
        as: "enrollments"
      }
    },

    {
      $addFields: {

        enrolledCount: {
          $size: "$enrollments"
        },

        fillRate: {
          $cond: [
            { $gt: ["$maxParticipants", 0] },

            {
              $multiply: [
                {
                  $divide: [
                    { $size: "$enrollments" },
                    "$maxParticipants"
                  ]
                },
                100
              ]
            },

            0
          ]
        }
      }
    },

    {
      $group: {
        _id: null,

        averageFillRate: {
          $avg: "$fillRate"
        }
      }
    }
  ]);

  return Math.round(
    result[0]?.averageFillRate || 0
  );
};

// TOP PROGRAMS that display in training provider dashboard
export const getTopPrograms = async (
  trainingProviderId: string
) => {

  return await Program.aggregate([

    {
      $match: {
        createdBy: toObjectId(trainingProviderId),
        status: PROGRAM_SAVED_STATUS.PUBLISHED
      }
    },

    {
      $lookup: {
        from: "enrollments",
        localField: "_id",
        foreignField: "programId",
        as: "enrollments"
      }
    },

    {
      $addFields: {

        enrolledCount: {
          $size: "$enrollments"
        },

        fillRate: {
          $cond: [
            { $gt: ["$maxParticipants", 0] },

            {
              $multiply: [
                {
                  $divide: [
                    { $size: "$enrollments" },
                    "$maxParticipants"
                  ]
                },
                100
              ]
            },

            0
          ]
        }
      }
    },

    {
      $project: {
        title: 1,
        startDate: 1,
        enrolledCount: 1,
        maxParticipants: 1,

        fillRate: {
          $round: ["$fillRate", 0]
        }
      }
    },

    {
      $sort: {
        enrolledCount: -1
      }
    },

    {
      $limit: 5
    }
  ]);
};


//published program activity
export const getPublishedActivities = async (
  trainingProviderId: string
) => {

  const todayStart = getUTCStartOfDay()

  const programs = await Program.find({

    createdBy: trainingProviderId,
    status: PROGRAM_SAVED_STATUS.PUBLISHED,

    updatedAt: {
      $gte: todayStart
    }
  })
    .sort({ updatedAt: -1 })
    .limit(5);

  return programs.map((program) => ({
    type: "published",
    message: `Published: ${ program.title }`,
    time: program.updatedAt
  }));
};

//Draft activity
export const getDraftActivities = async (
  trainingProviderId: string
) => {

  const todayStart =  getUTCStartOfDay()

  const programs = await Program.find({

    createdBy: trainingProviderId,
    status: PROGRAM_SAVED_STATUS.DRAFT,
    updatedAt: {
      $gte: todayStart
    }
  })
    .sort({ updatedAt: -1 })
    .limit(5);

  return programs.map((program) => ({
    type: "draft",
    message: `Draft saved: ${ program.title }`,
    time: program.updatedAt
  }));
};

//Bulk upload activity

export const getBulkUploadActivities = async (
  trainingProviderId: string
) => {

  const todayStart =  getUTCStartOfDay()

  const result = await Program.aggregate([

    {
      $match: {

        createdBy: trainingProviderId,
        batchId: {
          $exists: true,
          $ne: null
        },

        createdAt: {
          $gte: todayStart
        }
      }
    },

    {
      $group: {
        _id: "$batchId",

        count: {
          $sum: 1
        },

        createdAt: {
          $max: "$createdAt"
        }
      }
    }
  ]);

  return result.map((item) => ({
    type: "bulk_upload",
    message:
      `Bulk upload: ${ item.count } programs uploaded`,
    time: item.createdAt
  }));
};

//return program byId
export const findProgramById = async (id: string) => {
  return await programModel.findById(id);
};

export const getEmployeeProgramByIdRepo = async (id: string) => {
   return await programModel.findOne({
      _id: toObjectId(id),
      status: PROGRAM_SAVED_STATUS.PUBLISHED
   });
};

export const getEmployeeProgramsListRepo = async ({
   page,
   limit,
   search,
   venue,
   fromDate,
   toDate
}: {
   page: number;
   limit: number;
   search?: string;
   venue?: string;
   fromDate?: string;
   toDate?: string;
}) => {
   const skip = (page - 1) * limit;
   const filter: any = {
      status: PROGRAM_SAVED_STATUS.PUBLISHED
   };

   if (search) {
      filter.title = { $regex: search, $options: "i" };
   }
   if (venue) {
      filter.venue = { $regex: venue, $options: "i" };
   }
   if (fromDate || toDate) {
      filter.startDate = {};
      if (fromDate) {
         filter.startDate.$gte = new Date(fromDate);
      }
      if (toDate) {
         filter.startDate.$lte = new Date(toDate);
      }
   }

   const [programs, total] = await Promise.all([
      programModel.find(filter)
         .sort({ startDate: 1 })
         .skip(skip)
         .limit(limit)
         .lean(),
      programModel.countDocuments(filter)
   ]);

   return {
      programs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
   };
};






