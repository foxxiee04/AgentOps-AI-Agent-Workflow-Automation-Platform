export const locales = ["vi", "en"] as const;
export type Locale = (typeof locales)[number];

export type LocaleSearchParams = Promise<{ lang?: string | string[] } | undefined>;

export function normalizeLocale(input: unknown): Locale {
  const value = Array.isArray(input) ? input[0] : input;
  return value === "en" ? "en" : "vi";
}

export async function resolveLocale(searchParams?: LocaleSearchParams): Promise<Locale> {
  const params = searchParams ? await searchParams : undefined;
  return normalizeLocale(params?.lang);
}

export const landingCopy = {
  vi: {
    localeName: "Tiếng Việt",
    otherLocaleLabel: "English",
    otherLocaleHref: "/en",
    nav: {
      dashboard: "Bảng điều khiển",
      workflows: "Quy trình",
      agents: "AI Agents",
      login: "Đăng nhập"
    },
    badge: "MVP đang chạy local",
    headline: "Nền tảng tự động hóa workflow bằng AI Agent",
    subheadline:
      "Thiết kế, chạy và giám sát quy trình AI với workflow builder, backend NestJS, Kafka workers, PostgreSQL, Redis và hạ tầng sẵn sàng triển khai AWS/Kubernetes.",
    primaryCta: "Mở bảng điều khiển",
    secondaryCta: "Xem workflow mẫu",
    workflowPreviewLabel: "Workflow runtime",
    workflowPreviewStatus: "Đã sẵn sàng local",
    terminalTitle: "Luồng demo lead qualification",
    problemLabel: "Áp dụng vào bài toán",
    problemTitle: "Từ yêu cầu rời rạc thành quy trình có thể đo lường",
    problemBody:
      "AgentOps phù hợp với các quy trình cần AI đọc dữ liệu, ra quyết định có cấu trúc, gọi công cụ bên ngoài và lưu lại lịch sử vận hành để đội sản phẩm, sales hoặc support theo dõi.",
    stackLabel: "Kiến trúc sản phẩm",
    productSection: "Bề mặt sản phẩm",
    stats: [
      ["4", "workers bất đồng bộ"],
      ["13", "Kafka topics"],
      ["5", "node MVP"],
      ["2", "ngôn ngữ UI"]
    ],
    capabilities: [
      ["Workflow builder trực quan", "Trigger, AI Agent, điều kiện, webhook và end node."],
      ["AI output có cấu trúc", "JSON Schema validation trước khi chuyển sang bước tiếp theo."],
      ["Workers tách riêng", "Workflow, AI, tool và notification xử lý các tác vụ chậm/retryable."],
      ["Điều hành SaaS", "Workspace, RBAC, audit, readiness, usage và guardrails cho prompt."],
      ["Sẵn sàng cloud", "Docker, Kubernetes, Terraform, ECR naming và health checks."]
    ],
    useCases: [
      ["Chấm điểm lead", "AI đọc form, tính intent, chọn nhánh và tạo follow-up."],
      ["Support triage", "Phân loại ticket, đề xuất câu trả lời và chuyển đội phụ trách."],
      ["Ops monitoring", "Theo dõi run, event, token usage và readiness hạ tầng."]
    ],
    flowSignals: ["PostgreSQL persisted", "Kafka event", "Worker-ready"],
    terminalLines: [
      "$ agentops run wf_lead_qualification --trigger manual",
      "> publish workflow-triggered to Kafka",
      "> ai-worker score: 87 / high-intent",
      "> condition matched: leadScore > 80",
      "> tool-worker POST /follow-up",
      "> notification-worker queued sales task",
      "[ok] workflow completed"
    ]
  },
  en: {
    localeName: "English",
    otherLocaleLabel: "Tiếng Việt",
    otherLocaleHref: "/vi",
    nav: {
      dashboard: "Dashboard",
      workflows: "Workflows",
      agents: "AI Agents",
      login: "Login"
    },
    badge: "Local MVP online",
    headline: "AI Agent workflow automation platform",
    subheadline:
      "Design, run, and monitor AI workflows with a visual builder, NestJS backend, Kafka workers, PostgreSQL, Redis, and AWS/Kubernetes-ready infrastructure.",
    primaryCta: "Open dashboard",
    secondaryCta: "View sample workflow",
    workflowPreviewLabel: "Workflow runtime",
    workflowPreviewStatus: "Local stack ready",
    terminalTitle: "Lead qualification demo flow",
    problemLabel: "Applied use cases",
    problemTitle: "Turn scattered requests into measurable operations",
    problemBody:
      "AgentOps fits workflows where AI reads data, makes structured decisions, calls external tools, and stores run history so product, sales, or support teams can inspect what happened.",
    stackLabel: "Product architecture",
    productSection: "Product surface",
    stats: [
      ["4", "async workers"],
      ["13", "Kafka topics"],
      ["5", "MVP nodes"],
      ["2", "UI languages"]
    ],
    capabilities: [
      ["Visual workflow builder", "Trigger, AI Agent, condition, webhook, and end nodes."],
      ["Structured AI output", "JSON Schema validation before downstream workflow steps."],
      ["Separated workers", "Workflow, AI, tool, and notification work run outside request/response paths."],
      ["SaaS operations", "Workspace, RBAC, audit, readiness, usage, and prompt guardrails."],
      ["Cloud ready", "Docker, Kubernetes, Terraform, ECR naming, and health checks."]
    ],
    useCases: [
      ["Lead scoring", "AI reads a form, scores intent, branches, and creates follow-up."],
      ["Support triage", "Classify tickets, suggest a response, and route ownership."],
      ["Ops monitoring", "Track runs, events, token usage, and infrastructure readiness."]
    ],
    flowSignals: ["PostgreSQL persisted", "Kafka event", "Worker-ready"],
    terminalLines: [
      "$ agentops run wf_lead_qualification --trigger manual",
      "> publish workflow-triggered to Kafka",
      "> ai-worker score: 87 / high-intent",
      "> condition matched: leadScore > 80",
      "> tool-worker POST /follow-up",
      "> notification-worker queued sales task",
      "[ok] workflow completed"
    ]
  }
} satisfies Record<Locale, unknown>;

export const appCopy = {
  vi: {
    shell: {
      workspace: "Không gian làm việc",
      demoWorkspace: "AgentOps Demo",
      api: "API",
      logout: "Đăng xuất",
      signedIn: "Đã đăng nhập",
      nav: {
        dashboard: "Bảng điều khiển",
        workflows: "Quy trình",
        runs: "Lượt chạy",
        builder: "Builder",
        agents: "AI Agents",
        settings: "Cài đặt"
      }
    },
    common: {
      fallback: "Đang hiển thị dữ liệu fallback vì API chưa phản hồi.",
      openBuilder: "Mở builder",
      publish: "Publish",
      publishing: "Đang publish",
      published: "Đã publish",
      run: "Chạy",
      running: "Đang chạy",
      builder: "Builder",
      details: "Chi tiết"
    },
    auth: {
      loginEyebrow: "Truy cập workspace",
      loginTitle: "Đăng nhập AgentOps",
      registerEyebrow: "Tạo tài khoản",
      registerTitle: "Đăng ký AgentOps",
      name: "Tên",
      email: "Email",
      password: "Mật khẩu",
      submitLogin: "Đăng nhập",
      submitRegister: "Đăng ký",
      submitting: "Đang xử lý",
      google: "Tiếp tục với Google",
      noAccount: "Chưa có tài khoản?",
      hasAccount: "Đã có tài khoản?",
      createAccount: "Tạo tài khoản",
      backToLogin: "Quay lại đăng nhập",
      callbackTitle: "Đang hoàn tất đăng nhập",
      callbackBody: "Đang lưu session và chuyển bạn vào workspace.",
      error: "Không thể đăng nhập. Hãy thử lại."
    },
    dashboard: {
      eyebrow: "Tổng quan",
      title: "Điều hành workflow",
      metrics: {
        active: "Workflow active",
        total: "tổng workflow",
        runs: "Lượt chạy hôm nay",
        runsDetail: "Tạo bởi endpoint chạy workflow",
        tokens: "AI tokens",
        provider: "provider đang chọn",
        failures: "Lỗi",
        failuresDetail: "Workflow run thất bại"
      },
      recentRuns: "Workflow run gần đây",
      noRuns: "Chưa có workflow run. Hãy chạy workflow lead qualification ở màn Quy trình.",
      dependencies: "Trạng thái phụ thuộc",
      providers: "AI providers",
      eventStream: "Event stream gần đây",
      noEvents: "Chưa có domain event trong memory."
    },
    workflows: {
      eyebrow: "Tự động hóa",
      title: "Quy trình",
      newWorkflow: "Workflow mới",
      fallback: "Đang hiển thị workflow fallback vì API request thất bại.",
      nodes: "nodes",
      edges: "edges",
      workspace: "workspace",
      version: "version"
    },
    runs: {
      eyebrow: "Vận hành",
      title: "Lịch sử workflow run",
      detailTitle: "Run timeline",
      fallback: "Đang hiển thị dữ liệu run fallback vì API request thất bại.",
      empty: "Chưa có workflow run. Hãy publish và chạy workflow mẫu trước.",
      workflow: "Workflow",
      status: "Status",
      trigger: "Trigger",
      version: "Version",
      event: "Event",
      createdAt: "Created",
      input: "Input payload",
      steps: "Step timeline",
      completed: "Completed",
      pending: "Pending",
      failed: "Failed",
      node: "Node",
      message: "Message",
      backToRuns: "Quay lại Runs",
      openBuilder: "Mở builder",
      dataSource: "Nguồn dữ liệu"
    },
    agents: {
      eyebrow: "AI runtime",
      title: "AI Agents",
      fallback: "Đang hiển thị dữ liệu AI fallback vì API request thất bại.",
      provider: "Provider",
      providerDetail: "Đường chạy mặc định",
      calls: "AI calls",
      dailyLimit: "giới hạn/ngày",
      tokens: "Tokens",
      providers: "Providers",
      consoleTitle: "Test lead scoring agent",
      inputJson: "Input JSON",
      testAgent: "Test agent",
      testing: "Đang test",
      outputTitle: "Structured output",
      emptyOutput: "Chạy test để xem AI output đã validate schema.",
      valid: "valid",
      invalid: "invalid"
    },
    settings: {
      eyebrow: "Workspace",
      title: "Cài đặt",
      apiBoundary: "API boundary",
      baseUrl: "Base URL",
      dataSource: "Nguồn dữ liệu",
      security: "Lớp bảo mật",
      dependencies: "Phụ thuộc",
      readiness: "Readiness vận hành",
      runtime: "Quyết định runtime"
    },
    builder: {
      fallback: "fallback",
      design: "Thiết kế",
      run: "Run",
      inspector: "Inspector",
      workflow: "Workflow",
      mode: "Mode",
      draftDesign: "Draft design",
      runPreview: "Run preview",
      nodes: "Nodes",
      edges: "Edges",
      validation: "Validation",
      validGraph: "Valid graph",
      issues: "issue(s)",
      kafkaEvent: "Kafka event",
      nodeConfig: "Node config",
      validationIssues: "Validation issues",
      validMessage: "Trigger, end node, edge references và required AI/tool config đều hợp lệ."
    }
  },
  en: {
    shell: {
      workspace: "Workspace",
      demoWorkspace: "AgentOps Demo",
      api: "API",
      logout: "Logout",
      signedIn: "Signed in",
      nav: {
        dashboard: "Dashboard",
        workflows: "Workflows",
        runs: "Runs",
        builder: "Builder",
        agents: "Agents",
        settings: "Settings"
      }
    },
    common: {
      fallback: "Fallback data is visible because the API did not respond.",
      openBuilder: "Open builder",
      publish: "Publish",
      publishing: "Publishing",
      published: "Published",
      run: "Run",
      running: "Running",
      builder: "Builder",
      details: "Details"
    },
    auth: {
      loginEyebrow: "Workspace access",
      loginTitle: "Log in to AgentOps",
      registerEyebrow: "Create account",
      registerTitle: "Register for AgentOps",
      name: "Name",
      email: "Email",
      password: "Password",
      submitLogin: "Log in",
      submitRegister: "Register",
      submitting: "Working",
      google: "Continue with Google",
      noAccount: "No account yet?",
      hasAccount: "Already have an account?",
      createAccount: "Create account",
      backToLogin: "Back to login",
      callbackTitle: "Finishing sign-in",
      callbackBody: "Saving your session and opening the workspace.",
      error: "Could not sign in. Please try again."
    },
    dashboard: {
      eyebrow: "Overview",
      title: "Workflow operations",
      metrics: {
        active: "Active workflows",
        total: "total workflows",
        runs: "Runs today",
        runsDetail: "Created by workflow run endpoint",
        tokens: "AI tokens",
        provider: "provider selected",
        failures: "Failures",
        failuresDetail: "Failed workflow runs"
      },
      recentRuns: "Recent workflow runs",
      noRuns: "No workflow runs yet. Run the lead qualification workflow from the workflows page.",
      dependencies: "Dependency readiness",
      providers: "AI providers",
      eventStream: "Recent event stream",
      noEvents: "No recent domain events in memory."
    },
    workflows: {
      eyebrow: "Automation",
      title: "Workflows",
      newWorkflow: "New workflow",
      fallback: "Showing fallback workflow data because the API request failed.",
      nodes: "nodes",
      edges: "edges",
      workspace: "workspace",
      version: "version"
    },
    runs: {
      eyebrow: "Operations",
      title: "Workflow run history",
      detailTitle: "Run timeline",
      fallback: "Showing fallback run data because the API request failed.",
      empty: "No workflow runs yet. Publish and run the sample workflow first.",
      workflow: "Workflow",
      status: "Status",
      trigger: "Trigger",
      version: "Version",
      event: "Event",
      createdAt: "Created",
      input: "Input payload",
      steps: "Step timeline",
      completed: "Completed",
      pending: "Pending",
      failed: "Failed",
      node: "Node",
      message: "Message",
      backToRuns: "Back to Runs",
      openBuilder: "Open builder",
      dataSource: "Data source"
    },
    agents: {
      eyebrow: "AI runtime",
      title: "Agents",
      fallback: "Showing fallback AI data because the API request failed.",
      provider: "Provider",
      providerDetail: "Default execution path",
      calls: "AI calls",
      dailyLimit: "daily call limit",
      tokens: "Tokens",
      providers: "Providers",
      consoleTitle: "Test lead scoring agent",
      inputJson: "Input JSON",
      testAgent: "Test agent",
      testing: "Testing",
      outputTitle: "Structured output",
      emptyOutput: "Run a test to inspect schema-validated AI output.",
      valid: "valid",
      invalid: "invalid"
    },
    settings: {
      eyebrow: "Workspace",
      title: "Settings",
      apiBoundary: "API boundary",
      baseUrl: "Base URL",
      dataSource: "Data source",
      security: "Security layer",
      dependencies: "Dependencies",
      readiness: "Operational readiness",
      runtime: "Runtime decisions"
    },
    builder: {
      fallback: "fallback",
      design: "Design",
      run: "Run",
      inspector: "Inspector",
      workflow: "Workflow",
      mode: "Mode",
      draftDesign: "Draft design",
      runPreview: "Run preview",
      nodes: "Nodes",
      edges: "Edges",
      validation: "Validation",
      validGraph: "Valid graph",
      issues: "issue(s)",
      kafkaEvent: "Kafka event",
      nodeConfig: "Node config",
      validationIssues: "Validation issues",
      validMessage: "Trigger, end node, edge references, and required AI/tool config are valid."
    }
  }
} satisfies Record<Locale, unknown>;

export type AppCopy = (typeof appCopy)[Locale];
