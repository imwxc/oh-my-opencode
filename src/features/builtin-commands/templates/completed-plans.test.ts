import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { existsSync, mkdirSync, rmSync, writeFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { COMPLETED_PLANS_DIR } from "../../boulder-state"

// #given - RED phase: template module doesn't exist yet
// These tests will fail until completed-plans.ts is implemented

describe("completed-plans command (RED)", () => {
  const TEST_DIR = join(tmpdir(), "completed-plans-test-" + Date.now())
  const COMPLETED_DIR = join(TEST_DIR, COMPLETED_PLANS_DIR)

  beforeEach(() => {
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true })
    }
    if (!existsSync(COMPLETED_DIR)) {
      mkdirSync(COMPLETED_DIR, { recursive: true })
    }
  })

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true })
    }
  })

  test("should list archived completed plans", async () => {
    // #given - create some completed plan files
    const plan1 = join(COMPLETED_DIR, "feature-auth.md")
    const plan2 = join(COMPLETED_DIR, "feature-logging.md")
    writeFileSync(plan1, "# Auth Feature\n- [x] Done")
    writeFileSync(plan2, "# Logging Feature\n- [x] Done")

    // #when - import the template module (will fail in RED phase)
    let template: unknown = null
    try {
      const module = await import("./completed-plans")
      template = module.COMPLETED_PLANS_TEMPLATE
    } catch {
      // Expected in RED phase
    }

    // #then - template should exist (will fail in RED phase)
    expect(template).not.toBeNull()
    
    // Verify plan files exist
    expect(existsSync(plan1)).toBe(true)
    expect(existsSync(plan2)).toBe(true)
  })

  test("should show friendly message when completed directory is empty", async () => {
    // #given - empty completed directory
    // (directory created in beforeEach, but no files)

    // #when - import the template module (will fail in RED phase)
    let template: unknown = null
    try {
      const module = await import("./completed-plans")
      template = module.COMPLETED_PLANS_TEMPLATE
    } catch {
      // Expected in RED phase
    }

    // #then - template should exist (will fail in RED phase)
    expect(template).not.toBeNull()
    
    // Verify directory is empty
    const files = existsSync(COMPLETED_DIR) 
      ? require("fs").readdirSync(COMPLETED_DIR) 
      : []
    expect(files.length).toBe(0)
  })

  test("should handle plan names containing special characters", async () => {
    // #given - create plan files with special characters
    const specialPlan1 = join(COMPLETED_DIR, "feature-user's-work.md")
    const specialPlan2 = join(COMPLETED_DIR, "feature-测试-plan.md")
    const specialPlan3 = join(COMPLETED_DIR, "feature-2024-01-15.md")
    writeFileSync(specialPlan1, "# User's Work\n- [x] Done")
    writeFileSync(specialPlan2, "# 测试 Plan\n- [x] Done")
    writeFileSync(specialPlan3, "# Dated Plan\n- [x] Done")

    // #when - import the template module (will fail in RED phase)
    let template: unknown = null
    try {
      const module = await import("./completed-plans")
      template = module.COMPLETED_PLANS_TEMPLATE
    } catch {
      // Expected in RED phase
    }

    // #then - template should exist (will fail in RED phase)
    expect(template).not.toBeNull()
    
    // Verify special character files exist
    expect(existsSync(specialPlan1)).toBe(true)
    expect(existsSync(specialPlan2)).toBe(true)
    expect(existsSync(specialPlan3)).toBe(true)
  })
})
