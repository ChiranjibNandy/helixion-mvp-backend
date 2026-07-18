import mongoose from "mongoose";
import enrollmentModel from "../models/enrollment.model.js";
import { toObjectId } from "../utils/mongo.js";
import { IEnrollment } from "../interfaces/enrollment.interface.js";
import { Types } from "mongoose";
import { ENROLLMENT_STATUS, APPROVAL_STATUS, ENROLLMENT_STAGE, REIMBURSEMENT_STATUS, TP_NOT_YET_VISIBLE_STAGES, MANAGER_CHAIN_STATUS, TOUR_STATUS } from "../constants/enum.js";
import { IUser } from "../interfaces/user.interface.js";
import { escapeRegex } from "../utils/escapeRegex.js";

export const checkExistingEnrollmentRepo = async (
  userId: mongoose.Types.ObjectId,
  programId: mongoose.Types.ObjectId
) => {
  return await enrollmentModel.findOne({
    userId,
    programId,
    "statusSummary.enrollmentStatus": { $in: [ENROLLMENT_STATUS.ACTIVE, ENROLLMENT_STATUS.PENDING, ENROLLMENT_STATUS.SUBMITTED] },
  });
};

export const getEnrollmentCountForProgramRepo = async (
  programId: mongoose.Types.ObjectId
) => {
  return await enrollmentModel.countDocuments({
    programId,
    "statusSummary.enrollmentStatus": ENROLLMENT_STATUS.ACTIVE,
  });
};

export const getEnrollmentByIdAndUserRepo = async (
  enrollmentId: string,
  userId: string
) => {
  return await enrollmentModel.findOne({
    _id: new mongoose.Types.ObjectId(enrollmentId),
    userId: new mongoose.Types.ObjectId(userId),
  });
};

export const getActiveEnrollmentsRepo = async (userId: string) => {
  return await enrollmentModel.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        "statusSummary.enrollmentStatus": ENROLLMENT_STATUS.ACTIVE,
      },
    },
    {
      $lookup: {
        from: "programs",
        localField: "programId",
        foreignField: "_id",
        as: "programDetails",
      },
    },
    {
      $addFields: {
        programDetails: { $arrayElemAt: ["$programDetails", 0] },
      },
    },
    { $sort: { createdAt: -1 } },
  ]);
};

// Only surfaces participants whose enrollment has cleared CTD (Training
// Dept senior) approval — see TP_NOT_YET_VISIBLE_STAGES (ticket 0032).
export const getProgramParticipantsRepo = async (programId: string) => {
  return await enrollmentModel
    .find({
      programId:    new mongoose.Types.ObjectId(programId),
      currentStage: { $nin: TP_NOT_YET_VISIBLE_STAGES },
    })
    .populate({ path: "employeeId", select: "_id name email employeeCode" });
};

// Same visibility gate as getProgramParticipantsRepo — a participant not
// yet past CTD approval isn't "enrolled" from the Training Provider's
// point of view, so attendance can't be taken for them yet either.
export const validateParticipantsEnrollmentRepo = async (
  programId: string,
  participantIds: string[]
) => {
  return await enrollmentModel
    .find({
      programId:    new mongoose.Types.ObjectId(programId),
      employeeId:   { $in: participantIds.map((id) => new mongoose.Types.ObjectId(id)) },
      currentStage: { $nin: TP_NOT_YET_VISIBLE_STAGES },
    })
    .select("employeeId");
};

export const getTotalEnrollments = async (trainingProviderId: string) => {
  const result = await enrollmentModel.aggregate([
    {
      $lookup: {
        from: "programs",
        let: { programId: "$programId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$_id", "$$programId"] },
                  { $eq: ["$createdBy", new mongoose.Types.ObjectId(trainingProviderId)] },
                ],
              },
            },
          },
        ],
        as: "program",
      },
    },
    { $match: { "program.0": { $exists: true } } },
    { $count: "total" },
  ]);

  return result[0]?.total || 0;
};

export const getTodayEnrollmentCount = async (trainingProviderId: string) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const result = await enrollmentModel.aggregate([
    { $match: { createdAt: { $gte: todayStart } } },
    {
      $lookup: {
        from: "programs",
        let: { programId: "$programId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$_id", "$$programId"] },
                  { $eq: ["$createdBy", new mongoose.Types.ObjectId(trainingProviderId)] },
                ],
              },
            },
          },
        ],
        as: "program",
      },
    },
    { $match: { "program.0": { $exists: true } } },
    { $count: "count" },
  ]);

  return result[0]?.count || 0;
};

export const getEnrollmentActivities = async (trainingProviderId: string) => {
  const count = await getTodayEnrollmentCount(trainingProviderId);
  if (!count) return [];

  return [
    {
      type: "enrollment",
      message: `${ count } new enrollments received today`,
      time: new Date(),
    },
  ];
};

export const createEnrollmentRepo = async (data: Partial<IEnrollment>) => {
  return await enrollmentModel.create(data);
};

export const getEmployeeEnrollmentsRepo = async (userId: string) => {
  return await enrollmentModel.aggregate([
    {
      $match: {
        $or: [
          { employeeId: toObjectId(userId) },
          { userId: toObjectId(userId) }
        ]
      }
    },
    {
      $lookup: {
        from: "programs",
        localField: "programId",
        foreignField: "_id",
        as: "programDetails"
      }
    },
    {
      $addFields: {
        programDetails: {
          $arrayElemAt: ["$programDetails", 0]
        },
        programId: {
          $arrayElemAt: ["$programDetails", 0]
        }
      }
    },
    {
      $sort: {
        createdAt: -1
      }
    }
  ]);
};

export const getEnrollmentDetailsRepo = async (id: string, userId: string) => {
  const results = await enrollmentModel.aggregate([
    {
      $match: {
        _id: toObjectId(id),
        $or: [
          { employeeId: toObjectId(userId) },
          { userId: toObjectId(userId) }
        ]
      }
    },
    {
      $lookup: {
        from: "programs",
        localField: "programId",
        foreignField: "_id",
        as: "programDetails"
      }
    },
    {
      $addFields: {
        programDetails: {
          $arrayElemAt: ["$programDetails", 0]
        },
        programId: {
          $arrayElemAt: ["$programDetails", 0]
        }
      }
    }
  ]);
  return results[0] || null;
};


export const findExistingEnrollmentRepo = async (userId: string, programId: string) => {
  return await enrollmentModel.findOne({
    $or: [
      { employeeId: toObjectId(userId) },
      { userId: toObjectId(userId) }
    ],
    programId: toObjectId(programId),
    "statusSummary.enrollmentStatus": { $in: [ENROLLMENT_STATUS.ACTIVE, ENROLLMENT_STATUS.PENDING] }
  });
};

export const findEnrollmentByEmployeeIds = async (employeeIds: Types.ObjectId[]) => {
  return enrollmentModel.find({
    employeeId: { $in: employeeIds },
  })
    .populate("employeeId", "username email")
    .populate("programId", "name")
    .sort({ createdAt: -1 });
}

// ─── Manager approval queue ───────────────────────────────────────────────────

export const getPendingEnrollmentsForManagerRepo = async (
  userId: string,
  orgId: string,
  options: { level?: number } = {}
) => {
  // Was previously filtering on "statusSummary.enrollmentStatus" — a
  // top-level document field, not a property of managerChain array items
  // (which only ever have {userId, level, status}). That made this
  // $elemMatch impossible to satisfy, so this query always returned zero
  // results. The correct per-entry field is `status` against
  // MANAGER_CHAIN_STATUS, matching the pattern used in
  // takeManagerActionService's own query.
  const chainFilter: Record<string, unknown> = {
    userId: toObjectId(userId),
    status: MANAGER_CHAIN_STATUS.PENDING,
  };

  if (options.level !== undefined) {
    chainFilter.level = options.level;
  }

  return await enrollmentModel
    .find({
      orgId: toObjectId(orgId),
      managerChain: { $elemMatch: chainFilter },
    })
    .populate("employeeId", "name email employeeCode placeOfPosting")
    .populate("programId", "title startDate endDate city venueName")
    .sort({ createdAt: -1 });
};

// ─── Manager dashboard ─────────────────────────────────────────────────────────
// A manager is also an employee (they can enroll in trainings themselves), so
// these mirror employee.repository.ts's summary shape but keyed on the
// current employeeId/currentStage schema — NOT the legacy userId/status/
// approvalStatus fields employee.repository.ts's own dashboard queries still
// use, which don't exist on the current Enrollment schema at all.

export const getManagerOwnDashboardSummaryRepo = async (managerId: string) => {
   const objectId = toObjectId(managerId);
   const [completed, enrolled, pendingApprovals] = await Promise.all([
      enrollmentModel.countDocuments({ employeeId: objectId, currentStage: ENROLLMENT_STAGE.COMPLETED }),
      enrollmentModel.countDocuments({
         employeeId:   objectId,
         currentStage: { $nin: [ENROLLMENT_STAGE.REJECTED, ENROLLMENT_STAGE.COMPLETED] },
      }),
      enrollmentModel.countDocuments({ employeeId: objectId, currentStage: ENROLLMENT_STAGE.MANAGER_REVIEW }),
   ]);

   return { programsCompleted: completed, programsEnrolled: enrolled, pendingApprovals };
};

// Total enrollments across the manager's team (anyone with this manager
// anywhere in their managerChain), all-time — not just currently pending.
export const getManagerTeamEnrollmentCountRepo = async (managerId: string) => {
   return await enrollmentModel.countDocuments({ "managerChain.userId": toObjectId(managerId) });
};

// Distribution of this manager's own chain-entry decisions across their
// team's enrollments: approved / pending (their turn, not yet acted) /
// dismissed (rejected) / null (waiting — not yet their turn in the chain).
export const getManagerApprovalStatsRepo = async (managerId: string) => {
   const objectId = toObjectId(managerId);
   const stats = await enrollmentModel.aggregate([
      { $match: { "managerChain.userId": objectId } },
      { $unwind: "$managerChain" },
      { $match: { "managerChain.userId": objectId } },
      { $group: { _id: "$managerChain.status", count: { $sum: 1 } } },
   ]);

   const result: Record<"approved" | "pending" | "dismissed" | "null", number> = {
      approved: 0, pending: 0, dismissed: 0, null: 0,
   };

   stats.forEach((item) => {
      if (item._id === MANAGER_CHAIN_STATUS.APPROVED) result.approved = item.count;
      else if (item._id === MANAGER_CHAIN_STATUS.PENDING) result.pending = item.count;
      else if (item._id === MANAGER_CHAIN_STATUS.REJECTED) result.dismissed = item.count;
      else if (item._id === MANAGER_CHAIN_STATUS.WAITING) result.null = item.count;
   });

   return result;
};

// ─── Training dept / OSD queues ───────────────────────────────────────────────

export const getPendingEnrollmentsForStageRepo = async (
  orgId: string,
  stage: string
) => {
  return await enrollmentModel
    .find({
      orgId: toObjectId(orgId),
      currentStage: stage,
    })
    .populate("employeeId", "name email employeeCode placeOfPosting")
    .populate("programId", "title startDate endDate city venueName")
    .sort({ createdAt: -1 });
};

export const getEnrollmentByUserIdInManagerChain = async (
  user: IUser,
  page: number,
  limit: number,
  search: string
) => {
  const skip = (page - 1) * limit;

  // Scoped to enrollments where this manager actually sits in the
  // managerChain — previously this only filtered by orgId, so every manager
  // saw every enrollment in the company regardless of whether it was theirs
  // to approve. Not narrowed to "pending" only: the page also needs to show
  // enrollments this manager has already acted on (for the status column),
  // so `approve` (computed in the service layer) tells the frontend when
  // Approve/Reject should actually be enabled for the caller.
  const pipeline: any[] = [
    {
      $match: {
        orgId: user.orgId,
        managerChain: {
          $elemMatch: { userId: user._id },
        },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "employeeId",
        foreignField: "_id",
        as: "employeeId",
      },
    },
    {
      $unwind: "$employeeId",
    },
    // The Enrollment document has no `programSnapshot` field — that key only
    // ever existed as a one-time response DTO returned by enrollInProgramService
    // at creation time, never persisted. Program details must be joined here.
    {
      $lookup: {
        from: "programs",
        localField: "programId",
        foreignField: "_id",
        as: "programId",
      },
    },
    {
      $unwind: "$programId",
    },
  ];

  if (search?.trim()) {
    const escapedSearch = escapeRegex(search.trim());

    pipeline.push({
      $match: {
        $or: [
          {
            "employeeId.name": {
              $regex: escapedSearch,
              $options: "i",
            },
          },
          {
            "programId.title": {
              $regex: escapedSearch,
              $options: "i",
            },
          },
        ],
      },
    });
  }

  // Total Count
  const totalResult = await enrollmentModel.aggregate([
    ...pipeline,
    {
      $count: "total",
    },
  ]);

  const total = totalResult[0]?.total || 0;

  // Data
  const enrollments = await enrollmentModel.aggregate([
    ...pipeline,
    {
      $sort: {
        createdAt: -1,
      },
    },
    {
      $skip: skip,
    },
    {
      $limit: limit,
    },
  ]);

  return {
    enrollments,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// ─── Reimbursement manager queue ───────────────────────────────────────────────

export const getPendingReimbursementsForManagerRepo = async (
  managerId: string,
  orgId: string
) => {
  return await enrollmentModel
    .find({
      orgId: toObjectId(orgId),
      currentStage: ENROLLMENT_STAGE.REIMBURSEMENT_MANAGER_REVIEW,
      "managerApproval.assignedApproverId": toObjectId(managerId),
    })
    .populate("employeeId", "name email employeeCode placeOfPosting")
    .populate("programId", "title startDate endDate city venueName")
    .sort({ createdAt: -1 });
};

export const takeReimbursementManagerActionRepo = async (
  enrollmentId: string,
  orgId: string,
  managerId: string,
  updateSet: Record<string, unknown>,
  timelineEntry: Record<string, unknown>
) => {
  return await enrollmentModel.findOneAndUpdate(
    {
      _id: toObjectId(enrollmentId),
      orgId: toObjectId(orgId),
      currentStage: ENROLLMENT_STAGE.REIMBURSEMENT_MANAGER_REVIEW,
      "managerApproval.assignedApproverId": toObjectId(managerId),
    },
    { $set: updateSet, $push: { timeline: timelineEntry } },
    { new: true }
  );
};

export const takeReimbursementOsdActionRepo = async (
  enrollmentId: string,
  orgId: string,
  updateSet: Record<string, unknown>,
  timelineEntry: Record<string, unknown>
) => {
  return await enrollmentModel.findOneAndUpdate(
    {
      _id: toObjectId(enrollmentId),
      orgId: toObjectId(orgId),
      currentStage: ENROLLMENT_STAGE.REIMBURSEMENT_OSD_REVIEW,
    },
    { $set: updateSet, $push: { timeline: timelineEntry } },
    { new: true }
  );
};

// ─── Reimbursement submission (employee) ───────────────────────────────────────

// Pre-check used only to produce a specific error message (not enabled vs.
// already submitted vs. not found) before the atomic write below.
export const findEnrollmentForReimbursementSubmitRepo = async (
  enrollmentId: string,
  userId: string
) => {
  return await enrollmentModel.findOne({
    _id: toObjectId(enrollmentId),
    $or: [
      { employeeId: toObjectId(userId) },
      { userId: toObjectId(userId) },
    ],
  });
};

export const submitReimbursementRepo = async (
  enrollmentId: string,
  userId: string,
  updateSet: Record<string, unknown>,
  timelineEntry: Record<string, unknown>
) => {
  return await enrollmentModel.findOneAndUpdate(
    {
      _id: toObjectId(enrollmentId),
      $or: [
        { employeeId: toObjectId(userId) },
        { userId: toObjectId(userId) },
      ],
      "reimbursement.enabled": true,
      "reimbursement.status": REIMBURSEMENT_STATUS.NOT_STARTED,
    },
    { $set: updateSet, $push: { timeline: timelineEntry } },
    { new: true }
  );
};

// ─── Notifications (ticket 0033 — derived from timeline, no persistence) ──────

// $or:[{employeeId},{userId}] matches the same legacy-schema fallback used by
// getEmployeeEnrollmentsRepo/getEnrollmentDetailsRepo — enrollments created
// before the employeeId migration only have `userId` populated, and would
// otherwise silently produce zero notifications for their workflow history.
//
// Deliberately NOT capped with .limit(): a resolved enrollment's timeline
// can't produce a NEW notification, but capping by enrollment count (rather
// than by time or by whether a notification was already seen) would exclude
// arbitrary older enrollments whenever an employee has many, not just the
// ones that are actually irrelevant — silently and permanently, since the
// caller has no way to know an enrollment was dropped from consideration.
// Sort is kept (cheap, supported by the employeeId+updatedAt index below) so
// the derived notification list in employee.service.ts sees the most
// recently active enrollments first even before its own 50-item cap.
export const getEmployeeNotificationTimelineRepo = async (employeeId: string) => {
   return await enrollmentModel
      .find({
         $or: [
            { employeeId: toObjectId(employeeId) },
            { userId: toObjectId(employeeId) },
         ],
      })
      .select("timeline programId")
      .populate("programId", "title city")
      .sort({ updatedAt: -1 });
};

// ─── Attendance → Enrollment sync ──────────────────────────────────────────────

export const syncEnrollmentAttendanceRepo = async (
   programId: string,
   employeeId: string,
   excludedStages: ENROLLMENT_STAGE[],
   updateFields: Record<string, unknown>,
   timelineEntry?: Record<string, unknown>
) => {
   return await enrollmentModel.updateOne(
      {
         programId:    toObjectId(programId),
         employeeId:   toObjectId(employeeId),
         currentStage: { $nin: excludedStages },
      },
      timelineEntry
         ? { $set: updateFields, $push: { timeline: timelineEntry } }
         : { $set: updateFields }
   );
};

export const bulkSyncEnrollmentAttendanceRepo = async (
   programId: string,
   employeeIds: string[],
   excludedStages: ENROLLMENT_STAGE[],
   updateFields: Record<string, unknown>,
   timelineEntry?: Record<string, unknown>
) => {
   if (employeeIds.length === 0) return;
   return await enrollmentModel.updateMany(
      {
         programId:    toObjectId(programId),
         employeeId:   { $in: employeeIds.map((id) => toObjectId(id)) },
         currentStage: { $nin: excludedStages },
      },
      timelineEntry
         ? { $set: updateFields, $push: { timeline: timelineEntry } }
         : { $set: updateFields }
   );
};

// updateMany only reports an aggregate matchedCount, not which specific ids
// matched — so a bulk sync can't tell the caller which participants' emails
// are actually warranted. This runs the SAME filter as a plain find (before
// the write) to get the precise eligible subset, so notification dispatch
// only reaches employees whose attendance sync actually took effect, not
// everyone the caller asked to mark.
export const findEligibleAttendanceEmployeeIdsRepo = async (
   programId: string,
   employeeIds: string[],
   excludedStages: ENROLLMENT_STAGE[]
): Promise<string[]> => {
   if (employeeIds.length === 0) return [];
   const docs = await enrollmentModel
      .find({
         programId:    toObjectId(programId),
         employeeId:   { $in: employeeIds.map((id) => toObjectId(id)) },
         currentStage: { $nin: excludedStages },
      })
      .select("employeeId");
   return docs.map((doc) => doc.employeeId.toString());
};

// ─── Employee training history (approvals detail view) ─────────────────────────
// Authorization check for the training-history endpoint: rather than a
// separate direct-report lookup, this piggybacks on the same
// managerChain-membership proof the approvals list itself is scoped by — if
// the manager is anywhere in this enrollment's managerChain, they're
// authorized to view this employee's other training history too.
export const findEnrollmentForManagerRepo = async (
   enrollmentId: string,
   managerId: string,
   orgId: string
) => {
   return await enrollmentModel.findOne({
      _id:          toObjectId(enrollmentId),
      orgId:        toObjectId(orgId),
      managerChain: { $elemMatch: { userId: toObjectId(managerId) } },
   });
};

export const getEmployeeTrainingHistoryRepo = async (
   employeeId: string,
   excludeEnrollmentId: string
) => {
   return await enrollmentModel
      .find({
         employeeId:   toObjectId(employeeId),
         _id:          { $ne: toObjectId(excludeEnrollmentId) },
         currentStage: ENROLLMENT_STAGE.COMPLETED,
      })
      .populate("programId", "title startDate endDate venueName city brochureUrl trainingInstitute")
      .sort({ updatedAt: -1 })
      .limit(10);
};

export const getEnrollmentForStageOsdRepo = async (enrollmentId: string, orgId: string, stage: string) => {
   return await enrollmentModel.findOne({
      _id:          toObjectId(String(enrollmentId)),
      orgId:        toObjectId(orgId),
      currentStage: stage,
   });
};

export const updateEnrollmentForStageOsdRepo = async (enrollmentId: string, orgId: string, stage: string, updateOps: any) => {
   return await enrollmentModel.findOneAndUpdate(
      {
         _id:          toObjectId(String(enrollmentId)),
         orgId:        toObjectId(orgId),
         currentStage: stage,
      },
      updateOps,
      { new: true }
   );
};

export const getEnrollmentForTourOsdActionRepo = async (enrollmentId: string, orgId: string) => {
   return await enrollmentModel.findOne({
      _id:          toObjectId(String(enrollmentId)),
      orgId:        toObjectId(orgId),
      "tour.status": { $in: [TOUR_STATUS.SUBMITTED, TOUR_STATUS.MANAGER_APPROVED] },
   });
};

export const updateEnrollmentForTourOsdActionRepo = async (enrollmentId: string, orgId: string, updateOps: any) => {
   return await enrollmentModel.findOneAndUpdate(
      {
         _id:          toObjectId(String(enrollmentId)),
         orgId:        toObjectId(orgId),
         "tour.status": { $in: [TOUR_STATUS.SUBMITTED, TOUR_STATUS.MANAGER_APPROVED] },
      },
      updateOps,
      { new: true }
   );
};

// ─── Tour approval queues ──────────────────────────────────────────────────────

export const getPendingTourApprovalsForManagerRepo = async (
   managerId: string,
   orgId: string
) => {
   return await enrollmentModel
      .find({
         orgId: toObjectId(orgId),
         currentStage: ENROLLMENT_STAGE.TOUR_MANAGER_REVIEW,
         "managerApproval.assignedApproverId": toObjectId(managerId),
      })
      .populate("employeeId", "name email employeeCode designation department placeOfPosting")
      .populate("programId", "title startDate endDate city venueName")
      .sort({ createdAt: -1 });
};

export const getPendingTourApprovalsForOsdRepo = async (orgId: string) => {
   return await enrollmentModel
      .find({
         orgId: toObjectId(orgId),
         currentStage: ENROLLMENT_STAGE.TOUR_OSD_REVIEW,
      })
      .populate("employeeId", "name email employeeCode designation department placeOfPosting")
      .populate("programId", "title startDate endDate city venueName")
      .sort({ createdAt: -1 });
};
