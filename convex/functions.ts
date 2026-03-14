import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// TASKS
export const getTasks = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("tasks").collect();
  },
});

export const createTask = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(v.literal("todo"), v.literal("in_progress"), v.literal("done")),
    assignee: v.union(v.literal("me"), v.literal("you")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("tasks", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateTaskStatus = mutation({
  args: {
    id: v.id("tasks"),
    status: v.union(v.literal("todo"), v.literal("in_progress"), v.literal("done")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status, updatedAt: Date.now() });
  },
});

export const deleteTask = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// CONTENT PIPELINE
export const getContent = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("content").collect();
  },
});

export const createContent = mutation({
  args: {
    title: v.string(),
    stage: v.optional(
      v.union(
        v.literal("idea"),
        v.literal("script"),
        v.literal("thumbnail"),
        v.literal("filming"),
        v.literal("editing"),
        v.literal("published")
      )
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("content", {
      title: args.title,
      stage: args.stage || "idea",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateContent = mutation({
  args: {
    id: v.id("content"),
    stage: v.optional(
      v.union(
        v.literal("idea"),
        v.literal("script"),
        v.literal("thumbnail"),
        v.literal("filming"),
        v.literal("editing"),
        v.literal("published")
      )
    ),
    script: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, { ...updates, updatedAt: Date.now() });
  },
});

export const deleteContent = mutation({
  args: { id: v.id("content") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// CALENDAR
export const getEvents = query({
  args: { date: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.date) {
      return await ctx.db.query("events").filter((q) => q.eq(q.field("date"), args.date)).collect();
    }
    return await ctx.db.query("events").collect();
  },
});

export const createEvent = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    date: v.string(),
    time: v.optional(v.string()),
    type: v.union(v.literal("task"), v.literal("cron"), v.literal("meeting"), v.literal("reminder")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("events", {
      ...args,
      completed: false,
      createdAt: Date.now(),
    });
  },
});

export const toggleEventComplete = mutation({
  args: { id: v.id("events") },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.id);
    if (event) {
      await ctx.db.patch(args.id, { completed: !event.completed });
    }
  },
});

// MEMORIES
export const getMemories = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const memories = await ctx.db.query("memories").collect();
    if (args.search) {
      const query = args.search.toLowerCase();
      return memories.filter(
        (m) =>
          m.title.toLowerCase().includes(query) ||
          m.content.toLowerCase().includes(query)
      );
    }
    return memories;
  },
});

export const createMemory = mutation({
  args: {
    title: v.string(),
    content: v.string(),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("memories", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

// TEAM / AGENTS
export const getAgents = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("agents").collect();
  },
});

export const createAgent = mutation({
  args: {
    name: v.string(),
    role: v.string(),
    status: v.optional(v.union(v.literal("idle"), v.literal("working"), v.literal("offline"))),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("agents", {
      ...args,
      status: args.status || "idle",
    });
  },
});

export const updateAgentStatus = mutation({
  args: {
    id: v.id("agents"),
    status: v.union(v.literal("idle"), v.literal("working"), v.literal("offline")),
    currentTask: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

// ACTIVITY
export const getActivity = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("activity").collect();
  },
});

export const logActivity = mutation({
  args: {
    agentId: v.optional(v.id("agents")),
    description: v.string(),
    status: v.union(v.literal("working"), v.literal("idle")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("activity", {
      ...args,
      startedAt: Date.now(),
    });
  },
});
