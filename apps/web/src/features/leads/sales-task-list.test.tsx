import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { appCopy } from "../../lib/i18n";
import { updateSalesTask } from "./sales-task-list";
import { SalesTaskList } from "./sales-task-list";

const en = appCopy.en;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SalesTaskList", () => {
  it("shows overdue tag only for open past-due tasks", () => {
    const now = new Date("2026-10-20T00:00:00Z").getTime();
    const tasks = [
      { id: "t1", title: "Open past due", body: "follow up", status: "OPEN", dueAt: "2026-10-18T08:00:00Z", overdue: true, createdAt: "2026-10-18T08:00:00Z" },
      { id: "t2", title: "Open future", body: "follow up", status: "OPEN", dueAt: "2026-10-25T08:00:00Z", overdue: false, createdAt: "2026-10-18T08:00:00Z" },
      { id: "t3", title: "Done past due", body: "follow up", status: "DONE", dueAt: "2026-10-18T08:00:00Z", overdue: false, createdAt: "2026-10-18T08:00:00Z" }
    ];
    const html = renderToStaticMarkup(<SalesTaskList tasks={tasks as never} labels={en.dashboard} locale="en" />);
    expect(html).toContain("Open past due");
    expect(html).toContain("overdue");
    // future open should not show overdue tag? The word may still appear? Only one overdue task => one "overdue"
    expect(html.match(/overdue/g)?.length).toBe(1);
    expect(html).toContain('aria-label="mark done"');
    expect(html).toContain('aria-label="mark open"');
  });

  it("calls PATCH with DONE and returns updated task", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "t1", status: "DONE", overdue: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    const result = await updateSalesTask("t1", "DONE");
    expect(result.status).toBe("DONE");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/dashboard/sales-tasks/t1"),
      expect.objectContaining({ method: "PATCH", credentials: "include", body: JSON.stringify({ status: "DONE" }) })
    );
  });
});