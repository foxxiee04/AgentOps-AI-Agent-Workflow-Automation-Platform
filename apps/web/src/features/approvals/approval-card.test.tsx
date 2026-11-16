import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HumanApprovalView } from "@agentops/shared";
import { appCopy } from "../../lib/i18n";

vi.mock("../../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/api")>();
  return {
    ...actual,
    decideApproval: vi.fn(async () => ({
      approval: {
        id: "apr_1",
        workspaceId: "ws_demo",
        workflowRunId: "run_1",
        nodeId: "approval-1",
        stepId: "run_1_approval-1",
        status: "APPROVED",
        review: { lead: {}, assessment: {}, email: {} },
        requestedAt: "2026-10-18T08:00:00.000Z"
      },
      eventId: "evt_1"
    }))
  };
});

import { ApiError, decideApproval } from "../../lib/api";
import {
  ApprovalCard,
  ApprovalDraftPanel,
  ApprovalSuccessLine,
  approvalCopy,
  planApprovalDecision,
  submitApprovalDecision,
  type ApprovalDraft
} from "./approval-card";
import {
  APPROVAL_OUTCOME_MS,
  ApprovalOutcomes,
  approvalDecisionErrorMessage,
  approvalDecisionRequest,
  visibleApprovals,
  type RecentApprovalOutcome
} from "./approval-queue";

const en = appCopy.en;

const approval: HumanApprovalView = {
  id: "apr_1",
  workspaceId: "ws_demo",
  workflowRunId: "run_1",
  nodeId: "approval-1",
  stepId: "run_1_approval-1",
  status: "WAITING_APPROVAL",
  review: {
    lead: { name: "Anna", email: "an***@shopabc.vn" },
    assessment: { leadScore: 87, category: "high-intent" },
    email: { subject: "Automating Shop ABC", body: "Hi Anna, thanks for reaching out." }
  },
  requestedAt: "2026-10-18T08:00:00.000Z"
};

const original: ApprovalDraft = { subject: "Automating Shop ABC", body: "Hi Anna, thanks for reaching out." };

beforeEach(() => {
  vi.clearAllMocks();
});

/** The queue turns a click into the API call; the card only decides what is valid. */
function decideThroughApi(decision: "approve" | "reject", comment: string, editedEmail?: ApprovalDraft) {
  return (decided: "approve" | "reject", edited?: ApprovalDraft) => {
    void decideApproval(approval, approvalDecisionRequest(decided, comment, edited));
  };
}

describe("approval decision", () => {
  it("never calls the API when a rejection has no reason", () => {
    const onInvalid = vi.fn();
    const focusNote = vi.fn();

    submitApprovalDecision({
      decision: "reject",
      comment: "   ",
      draft: original,
      original,
      locale: "vi",
      onDecide: decideThroughApi("reject", "   "),
      onInvalid,
      focusNote
    });

    expect(decideApproval).not.toHaveBeenCalled();
    expect(onInvalid).toHaveBeenCalledWith(approvalCopy.vi.rejectReason);
    expect(focusNote).toHaveBeenCalled();
  });

  it("refuses a rejection reason shorter than 3 characters", () => {
    expect(planApprovalDecision({ decision: "reject", comment: "ab", locale: "vi" })).toEqual({
      kind: "invalid",
      message: approvalCopy.vi.rejectReason
    });
    expect(planApprovalDecision({ decision: "reject", comment: "abc", locale: "vi" }).kind).toBe("send");
  });

  it("sends the edited email when the reviewer approves an edited draft", () => {
    const edited: ApprovalDraft = { subject: "Automating Shop ABC - v2", body: "Hi Anna, shall we talk?" };

    submitApprovalDecision({
      decision: "approve",
      comment: "ok",
      draft: edited,
      original,
      locale: "en",
      onDecide: decideThroughApi("approve", "ok"),
      onInvalid: vi.fn()
    });

    expect(decideApproval).toHaveBeenCalledTimes(1);
    expect(decideApproval).toHaveBeenCalledWith(approval, {
      decision: "approve",
      comment: "ok",
      editedEmail: edited
    });
  });

  it("leaves the edited email out when the draft was not changed", () => {
    submitApprovalDecision({
      decision: "approve",
      comment: "",
      draft: original,
      original,
      locale: "en",
      onDecide: decideThroughApi("approve", ""),
      onInvalid: vi.fn()
    });

    expect(decideApproval).toHaveBeenCalledWith(approval, { decision: "approve" });
  });

  it("shows the same reason message when the API answers 400", () => {
    const message = approvalDecisionErrorMessage(new ApiError(400, "rejecting an approval requires a reason"), "reject", en.approvals, approvalCopy.vi);

    expect(message).toBe(approvalCopy.vi.rejectReason);
  });

  it("keeps the conflict message when someone else decided first", () => {
    const message = approvalDecisionErrorMessage(new ApiError(409, "already decided"), "approve", en.approvals, approvalCopy.vi);

    expect(message).toBe(en.approvals.conflict);
  });
});

describe("approval draft panel", () => {
  it("shows the draft read-only with an edit toggle", () => {
    const html = renderToStaticMarkup(
      <ApprovalDraftPanel
        approval={approval}
        labels={en.approvals}
        locale="en"
        editing={false}
        draft={original}
        edited={false}
        onToggle={() => undefined}
        onChange={() => undefined}
        onUndo={() => undefined}
      />
    );

    expect(html).toContain(approvalCopy.en.edit);
    expect(html).toContain("Automating Shop ABC");
    expect(html).toContain("Hi Anna, thanks for reaching out.");
    expect(html).not.toContain("<textarea");
  });

  it("turns subject and body into fields prefilled with the draft and marks the edit", () => {
    const html = renderToStaticMarkup(
      <ApprovalDraftPanel
        approval={approval}
        labels={en.approvals}
        locale="en"
        editing={true}
        draft={{ ...original, subject: "Edited subject" }}
        edited
        onToggle={() => undefined}
        onChange={() => undefined}
        onUndo={() => undefined}
      />
    );

    expect(html).toContain("Edited subject");
    expect(html).toContain("Hi Anna, thanks for reaching out.");
    expect(html).toContain(approvalCopy.en.undo);
    expect(html).toContain(`● ${approvalCopy.en.edited}`);
  });

  it("says Close instead of Edit while the draft is open", () => {
    const closed = renderToStaticMarkup(
      <ApprovalDraftPanel
        approval={approval}
        labels={appCopy.vi.approvals}
        locale="vi"
        editing={false}
        draft={original}
        edited={false}
        onToggle={() => undefined}
        onChange={() => undefined}
        onUndo={() => undefined}
      />
    );
    const open = renderToStaticMarkup(
      <ApprovalDraftPanel
        approval={approval}
        labels={appCopy.vi.approvals}
        locale="vi"
        editing
        draft={original}
        edited={false}
        onToggle={() => undefined}
        onChange={() => undefined}
        onUndo={() => undefined}
      />
    );

    expect(closed).toContain(approvalCopy.vi.edit);
    expect(closed).not.toContain(approvalCopy.vi.close);
    expect(open).toContain(approvalCopy.vi.close);
    expect(open).not.toContain(">Sửa<");
    expect(open).toContain(approvalCopy.vi.undo);
  });
});

describe("approval card", () => {
  it("labels the note as a reason and keeps both decision buttons", () => {
    const html = renderToStaticMarkup(
      <ApprovalCard
        approval={approval}
        labels={en.approvals}
        locale="en"
        comment=""
        state={{ status: "idle" }}
        onCommentChange={() => undefined}
        onDecide={() => undefined}
      />
    );

    expect(html).toContain(approvalCopy.en.note);
    expect(html).toContain(approvalCopy.en.edit);
    expect(html).toContain(en.approvals.approve);
    expect(html).toContain(en.approvals.reject);
    expect(html).toContain(`for="comment-apr_1"`);
  });

  it("uses the Vietnamese reason label", () => {
    const html = renderToStaticMarkup(
      <ApprovalCard
        approval={approval}
        labels={appCopy.vi.approvals}
        locale="vi"
        comment=""
        state={{ status: "idle" }}
        onCommentChange={() => undefined}
        onDecide={() => undefined}
      />
    );

    expect(html).toContain(approvalCopy.vi.note);
    expect(html).toContain(approvalCopy.vi.edit);
  });
});

describe("approval outcome line", () => {
  const outcome: RecentApprovalOutcome = { approvalId: "apr_1", runId: "run_1", kind: "approved", at: 1 };

  it("replaces the card with one line that links to the run", () => {
    const html = renderToStaticMarkup(<ApprovalSuccessLine message={approvalCopy.vi.approved} runId="run_1" locale="vi" />);

    expect(html).toContain("✓ Đã duyệt và gửi email");
    expect(html).toContain("Xem run →");
    expect(html).toContain('href="/runs/run_1?lang=vi"');
  });

  it("says that a rejection still creates a sales task", () => {
    const html = renderToStaticMarkup(<ApprovalSuccessLine message={approvalCopy.vi.rejected} runId="run_1" locale="vi" />);

    expect(html).toContain("✓ Đã từ chối · vẫn tạo task cho sales");
    expect(html).toContain('href="/runs/run_1?lang=vi"');
  });

  it("keeps the outcome line after the approval is gone from the server list", () => {
    const html = renderToStaticMarkup(<ApprovalOutcomes outcomes={[outcome]} locale="vi" />);

    expect(visibleApprovals([], [outcome])).toEqual([]);
    expect(html).toContain(approvalCopy.vi.recentlyDecided);
    expect(html).toContain("✓ Đã duyệt và gửi email");
    expect(html).toContain("Xem run →");
  });

  it("hides a decided card even when a stale refetch still lists it", () => {
    expect(visibleApprovals([approval], [outcome])).toEqual([]);
    expect(visibleApprovals([approval], [])).toEqual([approval]);
    expect(visibleApprovals([approval], [], { apr_1: { ...approval, status: "APPROVED" } })[0].status).toBe("APPROVED");
  });

  it("keeps each outcome for six seconds", () => {
    expect(APPROVAL_OUTCOME_MS).toBe(6_000);
  });
});
