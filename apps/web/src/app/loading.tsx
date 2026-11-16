import { LoadingState } from "../components/data-state";

export default function Loading() {
  return (
    <div className="min-h-screen bg-[var(--canvas)] p-5">
      <LoadingState label="Đang tải dữ liệu... / Loading data..." />
    </div>
  );
}
