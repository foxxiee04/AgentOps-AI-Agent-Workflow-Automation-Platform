export type LabelValue = string | number | boolean | undefined;
export type Labels = Record<string, LabelValue>;

export const prometheusContentType = "text/plain; version=0.0.4; charset=utf-8";

export class CounterMetric {
  private readonly samples = new Map<string, { labels: Labels; value: number }>();

  constructor(
    private readonly name: string,
    private readonly help: string,
    private readonly labelNames: string[]
  ) {}

  inc(labels: Labels = {}, amount = 1) {
    const normalizedLabels = this.normalizeLabels(labels);
    const key = labelKey(normalizedLabels);
    const sample = this.samples.get(key) ?? { labels: normalizedLabels, value: 0 };
    sample.value += amount;
    this.samples.set(key, sample);
  }

  render() {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} counter`];
    for (const sample of this.samples.values()) {
      lines.push(`${this.name}${formatLabels(sample.labels)} ${sample.value}`);
    }
    return lines.join("\n");
  }

  private normalizeLabels(labels: Labels) {
    return Object.fromEntries(this.labelNames.map((name) => [name, labels[name] ?? "unknown"]));
  }
}

export class GaugeMetric {
  private readonly samples = new Map<string, { labels: Labels; value: number }>();

  constructor(
    private readonly name: string,
    private readonly help: string,
    private readonly labelNames: string[]
  ) {}

  set(labels: Labels = {}, value: number) {
    const normalizedLabels = this.normalizeLabels(labels);
    this.samples.set(labelKey(normalizedLabels), { labels: normalizedLabels, value });
  }

  render() {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} gauge`];
    for (const sample of this.samples.values()) {
      lines.push(`${this.name}${formatLabels(sample.labels)} ${sample.value}`);
    }
    return lines.join("\n");
  }

  private normalizeLabels(labels: Labels) {
    return Object.fromEntries(this.labelNames.map((name) => [name, labels[name] ?? "unknown"]));
  }
}

export class HistogramMetric {
  private readonly samples = new Map<string, { labels: Labels; buckets: number[]; sum: number; count: number }>();

  constructor(
    private readonly name: string,
    private readonly help: string,
    private readonly labelNames: string[],
    private readonly bucketBounds: number[]
  ) {}

  observe(labels: Labels, value: number) {
    const normalizedLabels = this.normalizeLabels(labels);
    const key = labelKey(normalizedLabels);
    const sample =
      this.samples.get(key) ?? {
        labels: normalizedLabels,
        buckets: this.bucketBounds.map(() => 0),
        sum: 0,
        count: 0
      };

    sample.sum += value;
    sample.count += 1;
    this.bucketBounds.forEach((bound, index) => {
      if (value <= bound) {
        sample.buckets[index] += 1;
      }
    });
    this.samples.set(key, sample);
  }

  render() {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} histogram`];
    for (const sample of this.samples.values()) {
      this.bucketBounds.forEach((bound, index) => {
        lines.push(`${this.name}_bucket${formatLabels({ ...sample.labels, le: bound })} ${sample.buckets[index]}`);
      });
      lines.push(`${this.name}_bucket${formatLabels({ ...sample.labels, le: "+Inf" })} ${sample.count}`);
      lines.push(`${this.name}_sum${formatLabels(sample.labels)} ${sample.sum}`);
      lines.push(`${this.name}_count${formatLabels(sample.labels)} ${sample.count}`);
    }
    return lines.join("\n");
  }

  private normalizeLabels(labels: Labels) {
    return Object.fromEntries(this.labelNames.map((name) => [name, labels[name] ?? "unknown"]));
  }
}

export function labelKey(labels: Labels) {
  return Object.entries(labels)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("|");
}

export function formatLabels(labels: Labels) {
  const entries = Object.entries(labels).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    return "";
  }

  return `{${entries.map(([key, value]) => `${key}="${escapeLabelValue(String(value))}"`).join(",")}}`;
}

function escapeLabelValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}
