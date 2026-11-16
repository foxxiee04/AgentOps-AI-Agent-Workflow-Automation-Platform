import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CountUp } from "./count-up";
import { LiveCursor } from "./live-cursor";
import { MaskHeading } from "./mask-heading";
import { MotionProvider } from "./motion-provider";
import { Reveal, Stagger, StaggerItem } from "./reveal";
import { StatusFlash } from "./status-flash";
import { useIconHover } from "./use-icon-hover";

describe("motion primitives", () => {
  it("CountUp renders the exact final value", () => {
    expect(renderToStaticMarkup(<CountUp value={1284} />)).toContain(">1284<");
  });

  it("CountUp renders the value through the supplied formatter", () => {
    const html = renderToStaticMarkup(<CountUp value={87} format={(value) => `${Math.round(value)}%`} />);
    expect(html).toContain("87%");
  });

  it("MaskHeading renders an h1 with the title text inside the mask", () => {
    const html = renderToStaticMarkup(<MaskHeading>Bảng điều khiển</MaskHeading>);

    expect(html).toMatch(/^<h1[^>]*>/);
    expect(html).toContain("Bảng điều khiển");
    expect(html).toContain("overflow-hidden");
  });

  it("Reveal renders its children inside the motion wrapper", () => {
    const html = renderToStaticMarkup(
      <MotionProvider>
        <Reveal>
          <p>panel content</p>
        </Reveal>
      </MotionProvider>
    );

    expect(html).toContain("panel content");
  });

  it("Stagger renders every StaggerItem child", () => {
    const html = renderToStaticMarkup(
      <Stagger>
        <StaggerItem key="a">first row</StaggerItem>
        <StaggerItem key="b">second row</StaggerItem>
      </Stagger>
    );

    expect(html).toContain("first row");
    expect(html).toContain("second row");
  });

  it("LiveCursor renders the block cursor", () => {
    expect(renderToStaticMarkup(<LiveCursor />)).toContain("▍");
  });

  it("StatusFlash renders its status tag", () => {
    expect(renderToStaticMarkup(<StatusFlash status="COMPLETED">COMPLETED</StatusFlash>)).toContain("COMPLETED");
  });

  it("useIconHover is a hook function", () => {
    expect(useIconHover).toBeTypeOf("function");
  });
});
