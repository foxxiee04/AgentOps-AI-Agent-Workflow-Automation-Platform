import http from "k6/http";
import { check } from "k6";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.2/index.js";

const API = __ENV.API_URL || "http://host.docker.internal:4000";
const WORKFLOW = __ENV.WORKFLOW_ID || "wf_lead_qualification";

export const options = {
  scenarios: {
    leads: {
      executor: "shared-iterations",
      vus: Number(__ENV.VUS || 20),
      iterations: Number(__ENV.ITERATIONS || 1000),
      maxDuration: "10m"
    }
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{name:trigger}": ["p(95)<500"]
  }
};

const SAMPLE_LEADS = [
  {
    name: "Nguyen Van An",
    email: "an.nguyen@example.com",
    message: "Chào shop, mình muốn tự động hoá chat chăm sóc khách hàng trên Facebook và Zalo. Cần bot trả lời và chốt đơn tự động.",
    budget: "5000000"
  },
  {
    name: "Tran Thi Mai",
    email: "mai.tran@example.com",
    message: "Bên mình đang tìm giải pháp tự động xử lý đơn hàng và gửi thông báo cho khách sau khi thanh toán. Có demo không?",
    budget: "8000000"
  },
  {
    name: "John Carter",
    email: "john.carter@example.com",
    message: "We need to automate our chat support and order processing. Looking for an AI workflow to qualify and route inbound leads. Ready to buy.",
    company: "Carter Commerce",
    budget: "3000"
  },
  {
    name: "Le Minh",
    email: "minh.le@example.com",
    message: "Chỉ đang tìm hiểu xem sản phẩm như thế nào, chưa có nhu cầu cụ thể.",
    budget: "0"
  },
  {
    name: "Sara Lee",
    email: "sara.lee@example.com",
    message: "Just looking around at the moment, not ready to purchase yet. Curious how it works.",
    budget: "0"
  },
  {
    name: "spam",
    email: "spam@cheap-pills.example",
    message: "BUY CHEAP PILLS NOW! Best prices on the internet, click here for a special discount!!!",
    budget: "0"
  }
];

export function setup() {
  const res = http.post(
    `${API}/auth/login`,
    JSON.stringify({
      email: "k6-" + Date.now() + "@agentops.local",
      password: "k6-load-pass-123"
    }),
    { headers: { "Content-Type": "application/json" } }
  );

  check(res, {
    "login 201": (r) => r.status === 201
  });

  return { token: res.json("accessToken") };
}

export default function (data) {
  const lead = SAMPLE_LEADS[__ITER % SAMPLE_LEADS.length];

  const input = {
    ...lead,
    email: `lead${__VU}-${__ITER}@example.com`,
    source: "load_test"
  };

  const res = http.post(
    `${API}/workflows/${WORKFLOW}/run`,
    JSON.stringify({ triggerType: "webhook", input }),
    {
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${data.token}`
      },
      tags: { name: "trigger" }
    }
  );

  check(res, {
    "201": (r) => r.status === 201
  });
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: " ", enableColors: false }),
    "/out/summary.json": JSON.stringify(data, null, 2)
  };
}
