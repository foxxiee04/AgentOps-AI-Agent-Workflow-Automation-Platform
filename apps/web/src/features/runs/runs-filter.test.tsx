import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OpenBuilderLink,
  RunsFilter,
  RunsPageHeading,
  RunsRow,
  RunsTableBody,
  buildRunsFilterUrl
} from "./runs-filter";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/runs",
  useSearchParams: () => new URLSearchParams("lang=vi&page=2&status=RUNNING")
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildRunsFilterUrl", () => {
  it("builds the right URL keeping lang and resetting page", () => {
    const searchParams = new URLSearchParams("lang=vi&page=2&status=RUNNING");
    expect(buildRunsFilterUrl("FAILED", searchParams)).toBe("/runs?lang=vi&status=FAILED");
  });

  it("handles object input", () => {
    expect(buildRunsFilterUrl({ status: "COMPLETED", lang: "en", page: 3 })).toBe("/runs?lang=en&status=COMPLETED");
  });

  it("ALL removes status", () => {
    expect(buildRunsFilterUrl("ALL", { lang: "vi", page: 2 })).toBe("/runs?lang=vi");
  });
});

describe("RunsFilter", () => {
  it("renders all status options", () => {
    const html = renderToStaticMarkup(<RunsFilter locale="vi" status="ALL" />);
    expect(html).toContain('value="RUNNING"');
    expect(html).toContain('value="ALL"');
  });
});

describe("runs motion surface", () => {
  it("renders the page title inside a mask heading", () => {
    const html = renderToStaticMarkup(<RunsPageHeading>Lượt chạy</RunsPageHeading>);
    expect(html).toMatch(/^<h1[^>]*>/);
    expect(html).toContain("Lượt chạy");
    expect(html).toContain("overflow-hidden");
  });

  it("renders the builder link with a decorative eye icon", () => {
    const html = renderToStaticMarkup(<OpenBuilderLink href="/workflows/wf/builder">Mở builder</OpenBuilderLink>);
    expect(html).toContain('href="/workflows/wf/builder"');
    expect(html).toContain("Mở builder");
    expect(html).toContain('aria-hidden="true"');
  });

  it("renders the cross-faded table body and its staggered rows", () => {
    const html = renderToStaticMarkup(
      <table>
        <RunsTableBody transitionKey="1-ALL">
          <RunsRow index={0} className="border-b">
            <td>run_1</td>
          </RunsRow>
        </RunsTableBody>
      </table>
    );

    expect(html).toContain("<tbody");
    expect(html).toContain("run_1");
    expect(html).toContain("border-b");
  });
});
