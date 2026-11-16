import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../lib/api";
import {
  DeleteWorkflowControl,
  RunWorkflowButton,
  RunWorkflowControl,
  WorkflowCard,
  WorkflowStatusLine,
  deleteClickAction,
  deleteConfirmMs,
  formatWorkflowError,
  shortRunId,
  type DeleteButtonPhase
} from "./workflow-actions";
import { runWorkflow } from "./workflow-client";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() })
}));

const runId = "run_ff074f14abcd";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RunWorkflowControl", () => {
  it("renders only the button so it can stay a child of the button row", () => {
    const html = renderToStaticMarkup(
      <RunWorkflowControl
        runLabel="Chạy"
        runningLabel="Đang chạy"
        state={{ status: "success", runId }}
        onRun={() => undefined}
      />
    );

    expect(html).toContain(">Chạy</button>");
    expect(html).not.toContain("Đang chạy");
    expect(html).not.toContain("✓");
    expect(html).not.toContain("</p>");
  });

  it("shows API failures inline instead of throwing", () => {
    const message = "Workflow has no published version. Publish it before running.";
    const error = formatWorkflowError(new ApiError(409, message), "fallback");

    expect(error).toBe(message);

    const html = renderToStaticMarkup(
      <WorkflowStatusLine locale="en" message={{ tone: "error", text: error }} />
    );

    expect(html).toContain("role=\"alert\"");
    expect(html).toContain("⚠");
    expect(html).toContain(message);
  });

  it("appends API field details for invalid lead input", () => {
    expect(formatWorkflowError(new ApiError(400, "Invalid lead input", { email: "email must be an email" }), "fallback")).toBe(
      "Invalid lead input (email: email must be an email)"
    );
  });

  it("surfaces the 409 WORKFLOW_NOT_PUBLISHED body message from the run endpoint", async () => {
    const message = "Workflow has no published version. Publish it before running.";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ code: "WORKFLOW_NOT_PUBLISHED", message }), {
        status: 409,
        headers: { "Content-Type": "application/json" }
      })
    );

    await expect(runWorkflow("wf_draft", {})).rejects.toMatchObject({ status: 409, message });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/workflows/wf_draft/run"),
      expect.objectContaining({ method: "POST", credentials: "include" })
    );
  });
});

describe("WorkflowStatusLine", () => {
  it("renders the run link and keeps the run id short", () => {
    const html = renderToStaticMarkup(
      <WorkflowStatusLine locale="vi" message={{ tone: "success", text: "Đã tạo run", runId }} />
    );

    expect(html).toContain("✓");
    expect(html).toContain("Đã tạo run");
    expect(html).toContain(shortRunId(runId));
    expect(html).toContain(`href="/runs/${runId}?lang=vi"`);
    expect(html).toContain("Xem run");
  });
});

describe("RunWorkflowButton", () => {
  it("disables the run button and explains why when the workflow has no published version", () => {
    const html = renderToStaticMarkup(
      <RunWorkflowButton workflowId="wf_draft" status="DRAFT" locale="en" />
    );

    expect(html).toContain(">Run</button>");
    expect(html).toContain("disabled=\"\"");
    expect(html).toContain("Publish before running");
  });

  it("keeps the run button enabled once the workflow has a published version", () => {
    const html = renderToStaticMarkup(
      <RunWorkflowButton workflowId="wf_live" status="ACTIVE" currentVersionId="wfv_1" locale="en" />
    );

    expect(html).toContain(">Run</button>");
    expect(html).not.toContain("disabled=\"\"");
    expect(html).not.toContain("Publish before running");
  });
});

describe("WorkflowCard", () => {
  it("keeps the action buttons in one row and renders the status line below the card content", () => {
    const html = renderToStaticMarkup(
      <WorkflowCard workflowId="wf_draft" status="DRAFT" locale="en">
        <p>Lead qualification</p>
      </WorkflowCard>
    );

    const rowStart = html.indexOf('class="flex flex-wrap items-center gap-2 lg:flex-nowrap"');
    const statusStart = html.indexOf('<p role="status"');

    expect(rowStart).toBeGreaterThan(-1);
    expect(html).toContain(">Run</button>");
    expect(html).toContain(">Publish</button>");
    expect(html).toContain(">Delete</span>");
    // The status line is rendered after the whole button row, never inside it.
    expect(statusStart).toBeGreaterThan(html.indexOf(">Run</button>"));
    expect(statusStart).toBeGreaterThan(html.indexOf(">Delete</span>"));
    expect(statusStart).toBeLessThan(html.indexOf("</article>"));
    expect(html).toContain('class="mt-2 font-mono text-xs');
    expect(html).toContain("Publish before running");
  });

  it("renders no status line for a published workflow that has not run yet", () => {
    const html = renderToStaticMarkup(
      <WorkflowCard workflowId="wf_live" status="ACTIVE" currentVersionId="wfv_1" locale="en">
        <p>Lead qualification</p>
      </WorkflowCard>
    );

    const rowStart = html.indexOf('class="flex flex-wrap items-center gap-2 lg:flex-nowrap"');

    expect(rowStart).toBeGreaterThan(-1);
    expect(html).not.toContain("<p role=");
    expect(html).not.toContain('role="status"');
    expect(html).not.toContain('role="alert"');
    expect(html).toContain("</div></article>");
  });

  it("hides the actions of an archived workflow and shows a muted tag instead", () => {
    const html = renderToStaticMarkup(
      <WorkflowCard workflowId="wf_archived" status="ARCHIVED" locale="en">
        <p>Archived workflow</p>
      </WorkflowCard>
    );

    expect(html).toContain("ARCHIVED");
    expect(html).not.toContain(">Run</button>");
    expect(html).not.toContain(">Publish</button>");
    expect(html).not.toContain(">Delete</button>");
    expect(html).not.toContain("lg:flex-nowrap");
  });
});

describe("delete confirmation", () => {
  it("needs two clicks: the first arms the confirmation, the second deletes", () => {
    let phase: DeleteButtonPhase = "idle";
    expect(deleteClickAction(phase)).toBe("confirm");

    phase = "confirming";
    expect(deleteClickAction(phase)).toBe("delete");
    expect(deleteClickAction("deleting")).toBe("ignore");
    expect(deleteConfirmMs).toBe(4000);
  });

  it("renders the confirm label while armed", () => {
    const labels = { delete: "Xóa", confirmDelete: "Xác nhận xóa?", deleting: "Đang xóa" };
    const html = renderToStaticMarkup(
      <DeleteWorkflowControl phase="confirming" labels={labels} onDelete={() => undefined} />
    );

    expect(html).toContain("Xác nhận xóa?");
    expect(html).not.toContain(">Xóa</button>");
  });
});
