import { Router, type Request } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { Regular } from "../models/Regular.js";
import {
  dateSchema,
  normalizeShift,
  patterns,
  shiftSchema,
  type Shift,
} from "../services/shift-patterns.js";

const router: Router = Router();
const fields = z.object({
  name: z.string().trim().min(1).max(120),
  venue: z.string().trim().min(1).max(200),
  venueType: z.enum(["cafe", "restaurant", "grocery", "other"]).optional(),
  role: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(4000).optional(),
  status: z.enum(["watching", "approached", "paused"]).optional(),
});
function userId(req: Request) {
  const user = (req as Request & { user?: { id?: string; _id?: string } }).user;
  return String(user?.id ?? user?._id ?? "");
}
function today(req: Request) {
  return dateSchema.parse(
    req.query.today ?? new Date().toISOString().slice(0, 10),
  );
}
function dto(doc: any, date: string) {
  const {
    uuid,
    name,
    venue,
    venueType,
    role,
    notes,
    status,
    shifts,
    createdAt,
    updatedAt,
  } = doc;
  return {
    uuid,
    name,
    venue,
    venueType,
    role,
    notes,
    status,
    shifts,
    createdAt,
    updatedAt,
    ...patterns(shifts as Shift[], date),
  };
}
router.use(requireAuth);
router.use((req, res, next) => {
  if (
    (req.params.uuid &&
      !z.string().uuid().safeParse(req.params.uuid).success) ||
    (req.query.today !== undefined &&
      !dateSchema.safeParse(req.query.today).success)
  )
    return res.status(400).json({ error: "Invalid id or date" });
  next();
});
router.get("/", async (req, res, next) => {
  try {
    const docs = await Regular.find({ userId: userId(req) })
      .sort({ updatedAt: -1 })
      .lean();
    res.json({ regulars: docs.map((d) => dto(d, today(req))) });
  } catch (e) {
    next(e);
  }
});
router.post("/", async (req, res, next) => {
  const body = fields
    .extend({ shift: shiftSchema.optional() })
    .safeParse(req.body);
  if (!body.success)
    return res.status(400).json({ error: "Invalid details or shift" });
  try {
    const { shift, ...rest } = body.data;
    const doc = await Regular.create({
      ...rest,
      uuid: randomUUID(),
      userId: userId(req),
      shifts: shift ? [{ id: randomUUID(), ...normalizeShift(shift) }] : [],
    });
    res.status(201).json(dto(doc.toObject(), today(req)));
  } catch (e) {
    next(e);
  }
});
// Every read and write is scoped to the authenticated owner.
router.use("/:uuid", async (req, res, next) => {
  if (!z.string().uuid().safeParse(req.params.uuid).success)
    return res.status(400).json({ error: "Invalid id" });
  try {
    const doc = await Regular.findOne({
      uuid: req.params.uuid,
      userId: userId(req),
    });
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.locals.regular = doc;
    next();
  } catch (e) {
    next(e);
  }
});
router.get("/:uuid", (req, res) =>
  res.json(dto(res.locals.regular.toObject(), today(req))),
);
router.patch("/:uuid", async (req, res, next) => {
  const body = fields.partial().safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid details" });
  try {
    const doc = res.locals.regular;
    doc.set(body.data);
    await doc.save();
    res.json(dto(doc.toObject(), today(req)));
  } catch (e) {
    next(e);
  }
});
router.delete("/:uuid", async (req, res, next) => {
  if (req.query.confirm !== "CONFIRM")
    return res.status(409).json({ error: "Type CONFIRM to delete" });
  try {
    await Regular.deleteOne({ uuid: req.params.uuid, userId: userId(req) });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
router.post("/:uuid/shifts", saveShift);
router.patch("/:uuid/shifts/:shiftId", saveShift);
async function saveShift(
  req: Request,
  res: import("express").Response,
  next: import("express").NextFunction,
) {
  const body = shiftSchema.safeParse(req.body);
  if (!body.success)
    return res
      .status(400)
      .json({ error: "Invalid shift: check date, weekday and times" });
  const doc = res.locals.regular;
  const index = req.params.shiftId
    ? doc.shifts.findIndex((s: Shift) => s.id === req.params.shiftId)
    : -1;
  if (req.params.shiftId && index < 0)
    return res.status(404).json({ error: "Shift not found" });
  const shift = {
    ...normalizeShift(body.data),
    id: req.params.shiftId ?? randomUUID(),
  };
  const duplicate = doc.shifts.find(
    (s: Shift) =>
      s.id !== shift.id &&
      s.kind === "sighting" &&
      shift.kind === "sighting" &&
      s.occurredOn === shift.occurredOn,
  );
  if (duplicate)
    return res
      .status(409)
      .json({ error: "Already logged on this date", shift: duplicate });
  if (index < 0 && doc.shifts.length >= 500)
    return res.status(400).json({ error: "Maximum 500 shifts" });
  try {
    if (index < 0) doc.shifts.push(shift);
    else doc.shifts.set(index, shift);
    await doc.save();
    res.status(index < 0 ? 201 : 200).json(dto(doc.toObject(), today(req)));
  } catch (e) {
    next(e);
  }
}
router.delete("/:uuid/shifts/:shiftId", async (req, res, next) => {
  const doc = res.locals.regular;
  if (!doc.shifts.some((s: Shift) => s.id === req.params.shiftId))
    return res.status(404).json({ error: "Shift not found" });
  try {
    doc.shifts = doc.shifts.filter((s: Shift) => s.id !== req.params.shiftId);
    await doc.save();
    res.json(dto(doc.toObject(), today(req)));
  } catch (e) {
    next(e);
  }
});
router.use(
  (
    err: any,
    _req: Request,
    res: import("express").Response,
    _next: import("express").NextFunction,
  ) => {
    if (err?.name === "VersionError")
      return res
        .status(409)
        .json({ error: "Updated elsewhere. Reload and try again." });
    console.error("Regular tracker request failed", err?.name);
    res.status(500).json({ error: "Could not save tracker changes" });
  },
);
export default router;
