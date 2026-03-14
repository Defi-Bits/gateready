import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Tasks Board
  tasks: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal("todo"),
      v.literal("in_progress"),
      v.literal("done")
    ),
    assignee: v.union(v.literal("me"), v.literal("you")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  // Content Pipeline
  content: defineTable({
    title: v.string(),
    stage: v.union(
      v.literal("idea"),
      v.literal("script"),
      v.literal("thumbnail"),
      v.literal("filming"),
      v.literal("editing"),
      v.literal("published")
    ),
    script: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  // Calendar
  events: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    date: v.string(), // YYYY-MM-DD
    time: v.optional(v.string()),
    type: v.union(
      v.literal("task"),
      v.literal("cron"),
      v.literal("meeting"),
      v.literal("reminder")
    ),
    completed: v.boolean(),
    createdAt: v.number(),
  }),

  // Memory
  memories: defineTable({
    title: v.string(),
    content: v.string(),
    category: v.optional(v.string()),
    createdAt: v.number(),
  }),

  // Team / Agents
  agents: defineTable({
    name: v.string(),
    role: v.string(),
    status: v.union(v.literal("idle"), v.literal("working"), v.literal("offline")),
    currentTask: v.optional(v.string()),
    avatar: v.optional(v.string()),
  }),

  // Office - Agent Activity
  activity: defineTable({
    agentId: v.optional(v.id("agents")),
    description: v.string(),
    status: v.union(v.literal("working"), v.literal("idle")),
    startedAt: v.number(),
  }),
});
