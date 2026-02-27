import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import {
  readBoulderState,
  writeBoulderState,
  appendSessionId,
  clearBoulderState,
  getPlanProgress,
  getPlanName,
  createBoulderState,
  findPrometheusPlans,
  archivePlan,
  findCompletedPlans,
} from "./storage"
import type { BoulderState } from "./types"
import {
  PROMETHEUS_PLANS_DIR,
  COMPLETED_PLANS_DIR,
  NOTEPAD_BASE_PATH,
  COMPLETED_NOTEPAD_DIR,
} from "./constants"

describe("boulder-state", () => {
  const TEST_DIR = join(tmpdir(), "boulder-state-test-" + Date.now())
  const SISYPHUS_DIR = join(TEST_DIR, ".sisyphus")

  beforeEach(() => {
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true })
    }
    if (!existsSync(SISYPHUS_DIR)) {
      mkdirSync(SISYPHUS_DIR, { recursive: true })
    }
    clearBoulderState(TEST_DIR)
  })

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true })
    }
  })

  describe("readBoulderState", () => {
    test("should return null when no boulder.json exists", () => {
      // given - no boulder.json file
      // when
      const result = readBoulderState(TEST_DIR)
      // then
      expect(result).toBeNull()
    })

    test("should return null for JSON null value", () => {
      //#given - boulder.json containing null
      const boulderFile = join(SISYPHUS_DIR, "boulder.json")
      writeFileSync(boulderFile, "null")

      //#when
      const result = readBoulderState(TEST_DIR)

      //#then
      expect(result).toBeNull()
    })

    test("should return null for JSON primitive value", () => {
      //#given - boulder.json containing a string
      const boulderFile = join(SISYPHUS_DIR, "boulder.json")
      writeFileSync(boulderFile, '"just a string"')

      //#when
      const result = readBoulderState(TEST_DIR)

      //#then
      expect(result).toBeNull()
    })

    test("should default session_ids to [] when missing from JSON", () => {
      //#given - boulder.json without session_ids field
      const boulderFile = join(SISYPHUS_DIR, "boulder.json")
      writeFileSync(boulderFile, JSON.stringify({
        active_plan: "/path/to/plan.md",
        started_at: "2026-01-01T00:00:00Z",
        plan_name: "plan",
      }))

      //#when
      const result = readBoulderState(TEST_DIR)

      //#then
      expect(result).not.toBeNull()
      expect(result!.session_ids).toEqual([])
    })

    test("should default session_ids to [] when not an array", () => {
      //#given - boulder.json with session_ids as a string
      const boulderFile = join(SISYPHUS_DIR, "boulder.json")
      writeFileSync(boulderFile, JSON.stringify({
        active_plan: "/path/to/plan.md",
        started_at: "2026-01-01T00:00:00Z",
        session_ids: "not-an-array",
        plan_name: "plan",
      }))

      //#when
      const result = readBoulderState(TEST_DIR)

      //#then
      expect(result).not.toBeNull()
      expect(result!.session_ids).toEqual([])
    })

    test("should default session_ids to [] for empty object", () => {
      //#given - boulder.json with empty object
      const boulderFile = join(SISYPHUS_DIR, "boulder.json")
      writeFileSync(boulderFile, JSON.stringify({}))

      //#when
      const result = readBoulderState(TEST_DIR)

      //#then
      expect(result).not.toBeNull()
      expect(result!.session_ids).toEqual([])
    })

    test("should read valid boulder state", () => {
      // given - valid boulder.json
      const state: BoulderState = {
        active_plan: "/path/to/plan.md",
        started_at: "2026-01-02T10:00:00Z",
        session_ids: ["session-1", "session-2"],
        plan_name: "my-plan",
      }
      writeBoulderState(TEST_DIR, state)

      // when
      const result = readBoulderState(TEST_DIR)

      // then
      expect(result).not.toBeNull()
      expect(result?.active_plan).toBe("/path/to/plan.md")
      expect(result?.session_ids).toEqual(["session-1", "session-2"])
      expect(result?.plan_name).toBe("my-plan")
    })
  })
  // Archive tests (RED phase)
  describe("archivePlan", () => {
    const planName1 = "archive-basic"

    test("#1 archivePlan basic functionality", () => {
      // #given
      const planDir = join(TEST_DIR, PROMETHEUS_PLANS_DIR)
      if (!existsSync(planDir)) mkdirSync(planDir, { recursive: true })
      const planPath = join(planDir, planName1 + ".md")
      writeFileSync(planPath, "# Plan\n- [x] done")
      const notepadDir = join(TEST_DIR, NOTEPAD_BASE_PATH)
      if (!existsSync(notepadDir)) mkdirSync(notepadDir, { recursive: true })
      const notepadPath = join(notepadDir, planName1 + ".md")
      writeFileSync(notepadPath, "notes")

      // #when
      const result: any = archivePlan(TEST_DIR, planName1)

      // #then
      const archivedPlanPath = join(TEST_DIR, COMPLETED_PLANS_DIR, planName1 + ".md")
      const archivedNotepadPath = join(TEST_DIR, COMPLETED_NOTEPAD_DIR, planName1 + ".md")
      expect(result?.success).toBe(true)
      expect(existsSync(archivedPlanPath)).toBe(true)
      expect(existsSync(planPath)).toBe(false)
      expect(existsSync(archivedNotepadPath)).toBe(true)
    })

    test("#2 archivePlan should auto-rename on name conflict", () => {
      // #given - create an existing file in the completed dir to force a rename
      const planName = "conflict-plan"
      const planDir = join(TEST_DIR, PROMETHEUS_PLANS_DIR)
      if (!existsSync(planDir)) mkdirSync(planDir, { recursive: true })
      const sourcePlan = join(planDir, planName + ".md")
      writeFileSync(sourcePlan, "# Plan for conflict")
      const archivedDir = join(TEST_DIR, COMPLETED_PLANS_DIR)
      if (!existsSync(archivedDir)) mkdirSync(archivedDir, { recursive: true })
      const existing = join(archivedDir, planName + ".md")
      writeFileSync(existing, "existing archived")
      const notepadDir = join(TEST_DIR, NOTEPAD_BASE_PATH)
      if (!existsSync(notepadDir)) mkdirSync(notepadDir, { recursive: true })
      writeFileSync(join(notepadDir, planName + ".md"), "notes")

      // #when
      const result: any = archivePlan(TEST_DIR, planName)

      // #then
      const secondArchived = join(TEST_DIR, COMPLETED_PLANS_DIR, planName + "-2.md")
      expect(result?.success).toBe(true)
      expect(existsSync(secondArchived)).toBe(true)
      expect(existsSync(sourcePlan)).toBe(false)
    })

    test("#3 archivePlan skips notepad when not present (silently)", () => {
      // #given
      const planName = "no-notepad"
      const planDir = join(TEST_DIR, PROMETHEUS_PLANS_DIR)
      if (!existsSync(planDir)) mkdirSync(planDir, { recursive: true })
      const sourcePlan = join(planDir, planName + ".md")
      writeFileSync(sourcePlan, "# Plan without notepad")
      const notepadPath = join(TEST_DIR, NOTEPAD_BASE_PATH, planName + ".md")
      if (existsSync(notepadPath)) rmSync(notepadPath, { recursive: true, force: true })

      // #when
      const result: any = archivePlan(TEST_DIR, planName)

      // #then
      const archivedPlanPath = join(TEST_DIR, COMPLETED_PLANS_DIR, planName + ".md")
      const archivedNotepadPath = join(TEST_DIR, COMPLETED_NOTEPAD_DIR, planName + ".md")
      expect(result?.success).toBe(true)
      expect(existsSync(archivedPlanPath)).toBe(true)
      expect(existsSync(archivedNotepadPath)).toBe(false)
    })

    test("#4 archivePlan rollback on failure", () => {
      // #given
      const planName = "archive-fail-rollback"
      const planDir = join(TEST_DIR, PROMETHEUS_PLANS_DIR)
      if (!existsSync(planDir)) mkdirSync(planDir, { recursive: true })
      const sourcePlan = join(planDir, planName + ".md")
      writeFileSync(sourcePlan, "# Plan that will fail")
      const archivedDir = join(TEST_DIR, COMPLETED_PLANS_DIR)
      if (!existsSync(archivedDir)) mkdirSync(archivedDir, { recursive: true })
      try {
        require("fs").chmodSync(archivedDir, 0o555)
      } catch {
        // ignore
      }

      // #when
      const result: any = archivePlan(TEST_DIR, planName)

      // #then
      expect(existsSync(sourcePlan)).toBe(true)
      expect(result?.success).toBe(false)
      try {
        require("fs").chmodSync(archivedDir, 0o700)
      } catch {
        // ignore
      }
    })

    test("#5 archivePlan idempotence: second call on same plan should fail gracefully", () => {
      // #given
      const planName = "idempotent-archive"
      const planDir = join(TEST_DIR, PROMETHEUS_PLANS_DIR)
      if (!existsSync(planDir)) mkdirSync(planDir, { recursive: true })
      const sourcePlan = join(planDir, planName + ".md")
      writeFileSync(sourcePlan, "# Plan for idempotent test")

      // #when
      const first = archivePlan(TEST_DIR, planName)
      const second = archivePlan(TEST_DIR, planName)

      // #then
      expect(first?.success).toBe(true)
      expect(second?.success).toBe(false)
    })

    test("#6 archivePlan handles plan names with spaces", () => {
      // #given - plan name with spaces
      const planName = "my plan name"
      const planDir = join(TEST_DIR, PROMETHEUS_PLANS_DIR)
      if (!existsSync(planDir)) mkdirSync(planDir, { recursive: true })
      const sourcePlan = join(planDir, planName + ".md")
      writeFileSync(sourcePlan, "# Plan with spaces in name")

      // #when
      const result: any = archivePlan(TEST_DIR, planName)

      // #then
      const archivedPlanPath = join(TEST_DIR, COMPLETED_PLANS_DIR, planName + ".md")
      expect(result?.success).toBe(true)
      expect(existsSync(archivedPlanPath)).toBe(true)
      expect(existsSync(sourcePlan)).toBe(false)
    })

    test("#7 archivePlan handles Unicode plan names", () => {
      // #given - plan name with Chinese characters
      const planName = "测试计划"
      const planDir = join(TEST_DIR, PROMETHEUS_PLANS_DIR)
      if (!existsSync(planDir)) mkdirSync(planDir, { recursive: true })
      const sourcePlan = join(planDir, planName + ".md")
      writeFileSync(sourcePlan, "# Unicode 测试")
      const notepadDir = join(TEST_DIR, NOTEPAD_BASE_PATH)
      if (!existsSync(notepadDir)) mkdirSync(notepadDir, { recursive: true })
      writeFileSync(join(notepadDir, planName + ".md"), "笔记")

      // #when
      const result: any = archivePlan(TEST_DIR, planName)

      // #then
      const archivedPlanPath = join(TEST_DIR, COMPLETED_PLANS_DIR, planName + ".md")
      const archivedNotepadPath = join(TEST_DIR, COMPLETED_NOTEPAD_DIR, planName + ".md")
      expect(result?.success).toBe(true)
      expect(existsSync(archivedPlanPath)).toBe(true)
      expect(existsSync(archivedNotepadPath)).toBe(true)
    })

    test("#8 archivePlan fails gracefully when plans directory is empty", () => {
      // #given - empty plans directory (plan does not exist)
      const planDir = join(TEST_DIR, PROMETHEUS_PLANS_DIR)
      if (!existsSync(planDir)) mkdirSync(planDir, { recursive: true })
      // No plans created

      // #when
      const result: any = archivePlan(TEST_DIR, "non-existent-plan")

      // #then
      expect(result?.success).toBe(false)
      expect(result?.error).toContain("Source plan not found")
    })

    test("#9 archivePlan handles multiple sequential archives", () => {
      // #given - multiple plans to archive
      const planNames = ["plan-alpha", "plan-beta", "plan-gamma"]
      const planDir = join(TEST_DIR, PROMETHEUS_PLANS_DIR)
      if (!existsSync(planDir)) mkdirSync(planDir, { recursive: true })

      planNames.forEach((name) => {
        writeFileSync(join(planDir, name + ".md"), `# ${name}`)
      })

      // #when - archive all plans
      const results = planNames.map((name) => archivePlan(TEST_DIR, name))

      // #then - all should succeed
      results.forEach((result: any) => {
        expect(result?.success).toBe(true)
      })

      // All plans should be in completed directory
      planNames.forEach((name) => {
        const archivedPath = join(TEST_DIR, COMPLETED_PLANS_DIR, name + ".md")
        expect(existsSync(archivedPath)).toBe(true)
      })

      // Original plans should be gone
      planNames.forEach((name) => {
        const originalPath = join(planDir, name + ".md")
        expect(existsSync(originalPath)).toBe(false)
      })
    })
  })

  describe("writeBoulderState", () => {
    test("should write state and create .sisyphus directory if needed", () => {
      // given - state to write
      const state: BoulderState = {
        active_plan: "/test/plan.md",
        started_at: "2026-01-02T12:00:00Z",
        session_ids: ["ses-123"],
        plan_name: "test-plan",
      }

      // when
      const success = writeBoulderState(TEST_DIR, state)
      const readBack = readBoulderState(TEST_DIR)

      // then
      expect(success).toBe(true)
      expect(readBack).not.toBeNull()
      expect(readBack?.active_plan).toBe("/test/plan.md")
    })
  })

  describe("appendSessionId", () => {
    test("should append new session id to existing state", () => {
      // given - existing state with one session
      const state: BoulderState = {
        active_plan: "/plan.md",
        started_at: "2026-01-02T10:00:00Z",
        session_ids: ["session-1"],
        plan_name: "plan",
      }
      writeBoulderState(TEST_DIR, state)

      // when
      const result = appendSessionId(TEST_DIR, "session-2")

      // then
      expect(result).not.toBeNull()
      expect(result?.session_ids).toEqual(["session-1", "session-2"])
    })

    test("should not duplicate existing session id", () => {
      // given - state with session-1 already
      const state: BoulderState = {
        active_plan: "/plan.md",
        started_at: "2026-01-02T10:00:00Z",
        session_ids: ["session-1"],
        plan_name: "plan",
      }
      writeBoulderState(TEST_DIR, state)

      // when
      appendSessionId(TEST_DIR, "session-1")
      const result = readBoulderState(TEST_DIR)

      // then
      expect(result?.session_ids).toEqual(["session-1"])
    })

    test("should return null when no state exists", () => {
      // given - no boulder.json
      // when
      const result = appendSessionId(TEST_DIR, "new-session")
      // then
      expect(result).toBeNull()
    })

    test("should not crash when boulder.json has no session_ids field", () => {
      //#given - boulder.json without session_ids
      const boulderFile = join(SISYPHUS_DIR, "boulder.json")
      writeFileSync(boulderFile, JSON.stringify({
        active_plan: "/plan.md",
        started_at: "2026-01-01T00:00:00Z",
        plan_name: "plan",
      }))

      //#when
      const result = appendSessionId(TEST_DIR, "ses-new")

      //#then - should not crash and should contain the new session
      expect(result).not.toBeNull()
      expect(result!.session_ids).toContain("ses-new")
    })
  })

  describe("clearBoulderState", () => {
    test("should remove boulder.json", () => {
      // given - existing state
      const state: BoulderState = {
        active_plan: "/plan.md",
        started_at: "2026-01-02T10:00:00Z",
        session_ids: ["session-1"],
        plan_name: "plan",
      }
      writeBoulderState(TEST_DIR, state)

      // when
      const success = clearBoulderState(TEST_DIR)
      const result = readBoulderState(TEST_DIR)

      // then
      expect(success).toBe(true)
      expect(result).toBeNull()
    })

    test("should succeed even when no file exists", () => {
      // given - no boulder.json
      // when
      const success = clearBoulderState(TEST_DIR)
      // then
      expect(success).toBe(true)
    })
  })

  describe("getPlanProgress", () => {
    test("should count completed and uncompleted checkboxes", () => {
      // given - plan file with checkboxes
      const planPath = join(TEST_DIR, "test-plan.md")
      writeFileSync(planPath, `# Plan
- [ ] Task 1
- [x] Task 2  
- [ ] Task 3
- [X] Task 4
`)

      // when
      const progress = getPlanProgress(planPath)

      // then
      expect(progress.total).toBe(4)
      expect(progress.completed).toBe(2)
      expect(progress.isComplete).toBe(false)
    })

    test("should return isComplete true when all checked", () => {
      // given - all tasks completed
      const planPath = join(TEST_DIR, "complete-plan.md")
      writeFileSync(planPath, `# Plan
- [x] Task 1
- [X] Task 2
`)

      // when
      const progress = getPlanProgress(planPath)

      // then
      expect(progress.total).toBe(2)
      expect(progress.completed).toBe(2)
      expect(progress.isComplete).toBe(true)
    })

    test("should return isComplete true for empty plan", () => {
      // given - plan with no checkboxes
      const planPath = join(TEST_DIR, "empty-plan.md")
      writeFileSync(planPath, "# Plan\nNo tasks here")

      // when
      const progress = getPlanProgress(planPath)

      // then
      expect(progress.total).toBe(0)
      expect(progress.isComplete).toBe(true)
    })

    test("should handle non-existent file", () => {
      // given - non-existent file
      // when
      const progress = getPlanProgress("/non/existent/file.md")
      // then
      expect(progress.total).toBe(0)
      expect(progress.isComplete).toBe(true)
    })
  })

  describe("getPlanName", () => {
    test("should extract plan name from path", () => {
      // given
      const path = "/home/user/.sisyphus/plans/project/my-feature.md"
      // when
      const name = getPlanName(path)
      // then
      expect(name).toBe("my-feature")
    })
  })

  describe("createBoulderState", () => {
    test("should create state with correct fields", () => {
      // given
      const planPath = "/path/to/auth-refactor.md"
      const sessionId = "ses-abc123"

      // when
      const state = createBoulderState(planPath, sessionId)

      // then
      expect(state.active_plan).toBe(planPath)
      expect(state.session_ids).toEqual([sessionId])
      expect(state.plan_name).toBe("auth-refactor")
      expect(state.started_at).toBeDefined()
    })

    test("should include agent field when provided", () => {
      //#given - plan path, session id, and agent type
      const planPath = "/path/to/feature.md"
      const sessionId = "ses-xyz789"
      const agent = "atlas"

      //#when - createBoulderState is called with agent
      const state = createBoulderState(planPath, sessionId, agent)

      //#then - state should include the agent field
      expect(state.agent).toBe("atlas")
      expect(state.active_plan).toBe(planPath)
      expect(state.session_ids).toEqual([sessionId])
      expect(state.plan_name).toBe("feature")
    })

    test("should allow agent to be undefined", () => {
      //#given - plan path and session id without agent
      const planPath = "/path/to/legacy.md"
      const sessionId = "ses-legacy"

      //#when - createBoulderState is called without agent
      const state = createBoulderState(planPath, sessionId)

      //#then - state should not have agent field (backward compatible)
      expect(state.agent).toBeUndefined()
    })
  })
})
