import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  workItems: defineTable({
    title: v.string(),
    status: v.union(v.literal("open"), v.literal("done")),
    owner: v.string(),
  }).index("by_owner", ["owner"]),
});
