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
    badge: "AI workflow hướng sự kiện",
    headline: "Nền tảng tự động hóa workflow bằng AI Agent",
    subheadline:
      "Thiết kế, chạy và giám sát quy trình AI với workflow builder, backend NestJS, Kafka workers, PostgreSQL, Redis và hạ tầng sẵn sàng triển khai AWS/Kubernetes.",
    primaryCta: "Mở bảng điều khiển",
    secondaryCta: "Xem workflow mẫu",
    workflowPreviewLabel: "Workflow runtime",
    workflowPreviewStatus: "Pipeline đang chạy",
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
    ],
    moss: {
      heroEyebrow: "Workflow automation",
      heroItalic: "AI Agent",
      nodes: [
        { type: "Trigger", title: "Lead qua API / webhook", meta: "12:04:31 · lead_2841" },
        { type: "AI Agent", title: "Chấm điểm intent", meta: "openai · draft email" },
        { type: "Human", title: "Người duyệt email", meta: "approvals · 1 đang chờ" },
        { type: "Task", title: "Tạo task cho sales", meta: "completed · 0.8s" }
      ],
      scoreLabel: "Intent score",
      runningLabel: "Đang chạy",
      marquee: ["Kafka", "Postgres", "OpenAI", "Redis", "Webhook", "Approval", "Sales task"],
      howEyebrow: "Cách hoạt động",
      howTitle: "Từ lead đến task sales, ba bước",
      steps: [
        {
          title: "Lead đi vào hệ thống",
          body: "Lead mới vào qua API hoặc webhook. AgentOps lưu event vào Kafka và mở một run được theo dõi từng bước."
        },
        {
          title: "AI chấm điểm và viết email",
          body: "AI Agent đọc dữ liệu lead, chấm điểm intent trên thang 100 và viết nháp email follow-up. Output được validate bằng JSON Schema."
        },
        {
          title: "Người duyệt, task được tạo",
          body: "Email chỉ được gửi sau khi con người duyệt. Run tiếp tục tạo task cho sales và lưu lại toàn bộ lịch sử."
        }
      ],
      bentoEyebrow: "Vận hành",
      bentoTitle: "Lớp điều hành cho AI Agent",
      bento: [
        {
          tag: "Run timeline",
          title: "Theo dõi run từng bước",
          body: "Mỗi run có timeline step-by-step: node nào đã chạy, AI trả ra gì, đang chờ duyệt ở đâu."
        },
        {
          tag: "Human approval",
          title: "Con người chốt trước khi gửi",
          body: "Email do AI viết nằm trong hàng duyệt; duyệt hoặc từ chối ngay trong workspace."
        },
        {
          tag: "AI scoring",
          title: "Output có cấu trúc",
          body: "Điểm intent, phân loại và tóm tắt được validate bằng JSON Schema trước khi chuyển sang bước sau."
        },
        {
          tag: "Observability",
          title: "Metrics, logs, traces",
          body: "Prometheus, Grafana và Tempo sẵn sàng cho mọi run, event và token usage."
        },
        {
          tag: "RBAC",
          title: "Phân quyền theo workspace",
          body: "OWNER, ADMIN, MEMBER — quyền riêng cho từng workspace, kèm audit log."
        },
        {
          tag: "CI/CD",
          title: "Triển khai lên AWS EKS",
          body: "Pipeline build → test → deploy Kubernetes, health checks và readiness tích hợp sẵn."
        }
      ],
      previewEyebrow: "Bên trong sản phẩm",
      previewTitle: "Bảng điều khiển chạy được ngay ngày mai",
      previewKpis: [
        ["128", "runs hôm nay", "+12%"],
        ["84.2k", "AI tokens", "+4%"],
        ["6", "đang chờ duyệt", "live"],
        ["99.9%", "uptime", "30 ngày"]
      ],
      previewHead: ["Lead", "Điểm", "Phân loại", "Trạng thái"],
      statuses: { completed: "Hoàn tất", running: "Đang chạy", waiting: "Chờ duyệt" },
      ctaEyebrow: "Bắt đầu",
      ctaTitle: "Đưa quy trình AI đầu tiên vào chạy thật",
      ctaBody: "Đăng nhập để chạy workflow mẫu, hoặc tạo tài khoản mới trong một phút.",
      registerCta: "Tạo tài khoản",
      footerNote: "AgentOps — nền tảng tự động hóa workflow bằng AI Agent. Kafka · Postgres · Redis · OpenAI · AWS EKS."
    }
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
    badge: "Event-driven AI workflows",
    headline: "AI Agent workflow automation platform",
    subheadline:
      "Design, run, and monitor AI workflows with a visual builder, NestJS backend, Kafka workers, PostgreSQL, Redis, and AWS/Kubernetes-ready infrastructure.",
    primaryCta: "Open dashboard",
    secondaryCta: "View sample workflow",
    workflowPreviewLabel: "Workflow runtime",
    workflowPreviewStatus: "Pipeline live",
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
    ],
    moss: {
      heroEyebrow: "Workflow automation",
      heroItalic: "workflow",
      nodes: [
        { type: "Trigger", title: "Lead via API / webhook", meta: "12:04:31 · lead_2841" },
        { type: "AI Agent", title: "Score intent", meta: "openai · draft email" },
        { type: "Human", title: "Approve the email", meta: "approvals · 1 waiting" },
        { type: "Task", title: "Create sales task", meta: "completed · 0.8s" }
      ],
      scoreLabel: "Intent score",
      runningLabel: "Running",
      marquee: ["Kafka", "Postgres", "OpenAI", "Redis", "Webhook", "Approval", "Sales task"],
      howEyebrow: "How it works",
      howTitle: "From lead to sales task in three steps",
      steps: [
        {
          title: "A lead arrives",
          body: "New leads enter through the API or a webhook. AgentOps stores the event in Kafka and opens a run that is tracked step by step."
        },
        {
          title: "AI scores and drafts",
          body: "The AI agent reads the lead, scores intent on a 0–100 scale and drafts a follow-up email. Output is validated with JSON Schema."
        },
        {
          title: "A human approves",
          body: "The email is only sent after a human approves it. The run then creates the sales task and stores the full history."
        }
      ],
      bentoEyebrow: "Operations",
      bentoTitle: "The operating layer for AI Agents",
      bento: [
        {
          tag: "Run timeline",
          title: "Every run, step by step",
          body: "Each run has a step timeline: which node ran, what the AI returned, and where it is waiting for approval."
        },
        {
          tag: "Human approval",
          title: "A human decides before sending",
          body: "AI-drafted emails sit in the approval queue; approve or reject right inside the workspace."
        },
        {
          tag: "AI scoring",
          title: "Structured output",
          body: "Intent score, category, and summary are validated with JSON Schema before the next step runs."
        },
        {
          tag: "Observability",
          title: "Metrics, logs, traces",
          body: "Prometheus, Grafana, and Tempo are ready for every run, event, and token usage."
        },
        {
          tag: "RBAC",
          title: "Permissions per workspace",
          body: "OWNER, ADMIN, MEMBER — separate roles for each workspace, with an audit log."
        },
        {
          tag: "CI/CD",
          title: "Deploys to AWS EKS",
          body: "A build → test → deploy Kubernetes pipeline, with health checks and readiness built in."
        }
      ],
      previewEyebrow: "Inside the product",
      previewTitle: "A dashboard you can run tomorrow",
      previewKpis: [
        ["128", "runs today", "+12%"],
        ["84.2k", "AI tokens", "+4%"],
        ["6", "waiting approval", "live"],
        ["99.9%", "uptime", "30 days"]
      ],
      previewHead: ["Lead", "Score", "Category", "Status"],
      statuses: { completed: "Completed", running: "Running", waiting: "Waiting" },
      ctaEyebrow: "Get started",
      ctaTitle: "Put your first AI workflow to work",
      ctaBody: "Sign in to run the sample workflow, or create an account in under a minute.",
      registerCta: "Create account",
      footerNote: "AgentOps — AI Agent workflow automation platform. Kafka · Postgres · Redis · OpenAI · AWS EKS."
    }
  }
} satisfies Record<Locale, unknown>;

export const appCopy = {
  vi: {
    shell: {
      workspace: "Không gian làm việc",
      demoWorkspace: "AgentOps Demo",
      noWorkspace: "Chưa có workspace",
      switchWorkspace: "Chuyển workspace",
      noWorkspacesMessage: "Bạn chưa thuộc không gian làm việc nào. Vui lòng liên hệ quản trị viên.",
      api: "API",
      logout: "Đăng xuất",
      signedIn: "Đã đăng nhập",
      nav: {
        dashboard: "Bảng điều khiển",
        workflows: "Quy trình",
        runs: "Lượt chạy",
        builder: "Builder",
        approvals: "Duyệt email",
        agents: "AI Agents",
        settings: "Cài đặt",
        admin: "Quản trị"
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
      noEvents: "Chưa có domain event trong memory.",
      leads: "Lead đã chấm điểm",
      noLeads: "Chưa có lead nào được chấm điểm. Gửi lead qua webhook hoặc nút Chạy.",
      salesTasks: "Task cho sales",
      noTasks: "Chưa có task. Task được tạo sau khi email cho lead nóng được duyệt và gửi.",
      score: "Điểm",
      category: "Phân loại",
      summary: "Tóm tắt",
      lead: "Lead",
      due: "Hạn",
      more: "còn {n} mục nữa"
    },
    workflows: {
      eyebrow: "Tự động hóa",
      title: "Quy trình",
      newWorkflow: "Workflow mới",
      fallback: "Đang hiển thị workflow fallback vì API request thất bại.",
      nodes: "nodes",
      edges: "edges",
      workspace: "workspace",
      version: "version",
      createFromTemplate: "Tạo từ mẫu lead",
      creating: "Đang tạo",
      createFailed: "Không tạo được workflow",
      empty: "Chưa có workflow nào. Tạo workflow đầu tiên từ mẫu lead.",
      invalidGraph: "Workflow chưa hợp lệ, sửa các lỗi trong builder trước khi publish."
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
    admin: {
      eyebrow: "+ ADMIN",
      title: "Quản trị hệ thống",
      subtitle: "Thống kê toàn nền tảng và quản lý mọi tài khoản.",
      tabs: {
        overview: "Tổng quan",
        accounts: "Tài khoản",
        workspaces: "Workspace",
        audit: "Audit log"
      },
      range: {
        label: "Khoảng thời gian",
        d7: "7 ngày",
        d30: "30 ngày",
        d90: "90 ngày"
      },
      noPermissionTitle: "Không có quyền truy cập",
      noPermissionBody: "Bạn cần quyền quản trị viên nền tảng để mở khu vực này.",
      overview: {
        generatedAt: "Tạo lúc",
        kpis: {
          users: "Người dùng",
          newUsers: "+{n} mới trong kỳ",
          active7d: "Hoạt động 7 ngày",
          workspaces: "Workspace",
          runs: "Lượt chạy",
          successRate: "Tỷ lệ thành công {rate}%",
          tokens: "AI tokens",
          pendingApprovals: "Chờ duyệt",
          pendingDetail: "Yêu cầu đang mở",
          disabledDetail: "{n} tài khoản bị khóa",
          workspaceDetail: "{workflows} workflow · {active} đang hoạt động",
          runsDetail: "{completed} xong · {failed} lỗi",
          tokensDetail: "{calls} lượt gọi AI"
        },
        charts: {
          runsTitle: "Lượt chạy mỗi ngày",
          runsHint: "Tổng và phần thất bại",
          signupsTitle: "Đăng ký mỗi ngày",
          signupsHint: "Tài khoản mới",
          tokensTitle: "AI tokens mỗi ngày",
          tokensHint: "Token tiêu thụ",
          approvalsTitle: "Kết quả duyệt",
          approvalsHint: "Trong khoảng đã chọn",
          leadsTitle: "Phân loại lead",
          leadsHint: "Toàn nền tảng",
          providerTitle: "Đăng ký theo provider",
          providerHint: "Mật khẩu và Google",
          topTitle: "Workspace nổi bật",
          topHint: "Theo số lượt chạy",
          noData: "Chưa có dữ liệu",
          approved: "Đã duyệt",
          rejected: "Từ chối",
          pending: "Chờ duyệt",
          high: "Tiềm năng cao",
          low: "Tiềm năng thấp",
          spam: "Spam",
          password: "Mật khẩu",
          google: "Google",
          columns: {
            name: "Workspace",
            runs: "Lượt chạy",
            members: "Thành viên",
            tokens: "AI tokens"
          }
        },
        exportTitle: "Xuất báo cáo",
        exportBody: "Tải CSV cho khoảng thời gian đang chọn.",
        exportUsers: "Người dùng",
        exportWorkspaces: "Workspace",
        exportRuns: "Lượt chạy",
        exportUsage: "Sử dụng AI"
      },
      accounts: {
        title: "Tài khoản",
        searchPlaceholder: "Tìm theo tên hoặc email",
        filterLabel: "Trạng thái",
        status: {
          all: "Tất cả",
          active: "Đang hoạt động",
          disabled: "Đã khóa",
          admin: "Quản trị"
        },
        columns: {
          user: "Người dùng",
          provider: "Provider",
          role: "Vai trò",
          status: "Trạng thái",
          workspaces: "Workspace",
          created: "Tạo lúc",
          lastLogin: "Đăng nhập cuối",
          actions: "Thao tác"
        },
        roleAdmin: "Admin",
        statusActive: "Hoạt động",
        statusDisabled: "Đã khóa",
        lock: "Khóa",
        unlock: "Mở khóa",
        grantAdmin: "Cấp quyền admin",
        revokeAdmin: "Thu quyền admin",
        selfHint: "Không thể thay đổi tài khoản của chính bạn",
        confirmTitle: "Xác nhận thay đổi",
        confirmBody: "Bạn có chắc muốn áp dụng thay đổi cho {email}?",
        confirm: "Xác nhận",
        cancel: "Hủy",
        detailTitle: "Chi tiết tài khoản",
        memberships: "Workspace tham gia",
        noMemberships: "Tài khoản chưa thuộc workspace nào.",
        joined: "Tham gia",
        close: "Đóng",
        empty: "Không tìm thấy tài khoản phù hợp.",
        loading: "Đang tải tài khoản...",
        prev: "Trước",
        next: "Sau",
        pageInfo: "Trang {page}/{totalPages} · {total} tài khoản",
        actionFailed: "Không cập nhật được tài khoản. Đã khôi phục trạng thái trước đó.",
        errorSelf: "Không thể thay đổi tài khoản của chính bạn.",
        never: "Chưa đăng nhập"
      },
      workspaces: {
        title: "Workspace",
        searchPlaceholder: "Tìm theo tên, slug hoặc chủ sở hữu",
        columns: {
          name: "Workspace",
          slug: "Slug",
          owner: "Chủ sở hữu",
          members: "Thành viên",
          workflows: "Workflow",
          runs: "Lượt chạy",
          tokens: "AI tokens",
          created: "Tạo lúc"
        },
        empty: "Không tìm thấy workspace phù hợp.",
        loading: "Đang tải workspace...",
        prev: "Trước",
        next: "Sau",
        pageInfo: "Trang {page}/{totalPages} · {total} workspace"
      },
      audit: {
        title: "Audit log",
        filterPlaceholder: "Lọc theo tên hành động",
        columns: {
          time: "Thời gian",
          actor: "Người thực hiện",
          action: "Hành động",
          entity: "Đối tượng",
          workspace: "Workspace",
          metadata: "Metadata"
        },
        empty: "Chưa có bản ghi audit phù hợp.",
        loading: "Đang tải audit log...",
        prev: "Trước",
        next: "Sau",
        pageInfo: "Trang {page}/{totalPages} · {total} bản ghi",
        details: "Xem JSON"
      }
    },
    states: {
      loading: "Đang tải dữ liệu...",
      errorTitle: "Không tải được dữ liệu",
      errorBody: "API không phản hồi. Kiểm tra API đang chạy rồi tải lại trang.",
      demoBanner: "Đang hiển thị dữ liệu demo (NEXT_PUBLIC_DEMO_FALLBACK=true) vì API không phản hồi.",
      emptyTitle: "Chưa có dữ liệu",
      retry: "Tải lại"
    },
    approvals: {
      eyebrow: "Kiểm duyệt",
      title: "Email chờ duyệt",
      intro: "Email do AI viết cho lead nóng chỉ được gửi sau khi bạn duyệt.",
      empty: "Không có email nào đang chờ duyệt.",
      lead: "Lead",
      assessment: "Đánh giá AI",
      score: "Điểm",
      category: "Phân loại",
      summary: "Tóm tắt",
      recommended: "Hành động đề xuất",
      email: "Email nháp",
      subject: "Tiêu đề",
      body: "Nội dung",
      comment: "Ghi chú (không bắt buộc)",
      approve: "Duyệt và gửi",
      reject: "Từ chối",
      working: "Đang gửi quyết định...",
      approved: "Đã duyệt. Workflow tiếp tục gửi email và tạo task.",
      rejected: "Đã từ chối. Run đã được hủy.",
      conflict: "Bước này đã được người khác quyết định trước.",
      forbidden: "Bạn cần quyền MEMBER trở lên trong workspace để duyệt.",
      unauthorized: "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.",
      failed: "Không gửi được quyết định. Thử lại sau.",
      openRun: "Xem run",
      requestedAt: "Yêu cầu lúc",
      autoRefresh: "Tự cập nhật mỗi 5 giây"
    },
    timeline: {
      live: "Đang cập nhật trực tiếp (4 giây/lần)",
      finished: "Run đã kết thúc",
      input: "Input (đã che PII)",
      output: "Output",
      tokens: "Token",
      model: "Model",
      duration: "Thời gian",
      error: "Lỗi",
      retries: "Số lần thử lại",
      noData: "Chưa có dữ liệu cho bước này.",
      runError: "Lỗi của run",
      waitingApproval: "Run đang chờ duyệt email.",
      goToApprovals: "Mở màn duyệt",
      statusMessages: {
        PENDING: "Đang chờ worker xử lý.",
        RUNNING: "Đang chạy trong worker.",
        WAITING_APPROVAL: "Đang chờ người duyệt quyết định.",
        COMPLETED: "Hoàn tất.",
        FAILED: "Thất bại.",
        SKIPPED: "Nhánh không được chọn."
      }
    },
    builder: {
      fallback: "fallback",
      design: "Thiết kế",
      run: "Xem trước run",
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
      noWorkspace: "No workspace",
      switchWorkspace: "Switch workspace",
      noWorkspacesMessage: "You do not belong to any workspace yet. Please contact an administrator.",
      api: "API",
      logout: "Logout",
      signedIn: "Signed in",
      nav: {
        dashboard: "Dashboard",
        workflows: "Workflows",
        runs: "Runs",
        builder: "Builder",
        approvals: "Approvals",
        agents: "Agents",
        settings: "Settings",
        admin: "Admin"
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
      leads: "Scored leads",
      noLeads: "No leads scored yet. Send a lead through the webhook or the Run button.",
      salesTasks: "Sales tasks",
      noTasks: "No tasks yet. A task is created after a hot lead's email is approved and sent.",
      score: "Score",
      category: "Category",
      summary: "Summary",
      lead: "Lead",
      due: "Due",
      more: "{n} more",
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
      version: "version",
      createFromTemplate: "Create from lead template",
      creating: "Creating",
      createFailed: "Could not create the workflow",
      empty: "No workflows yet. Create the first one from the lead template.",
      invalidGraph: "The workflow is invalid; fix the builder issues before publishing."
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
    admin: {
      eyebrow: "+ ADMIN",
      title: "Platform admin",
      subtitle: "Whole-platform statistics and account management.",
      tabs: {
        overview: "Overview",
        accounts: "Accounts",
        workspaces: "Workspaces",
        audit: "Audit log"
      },
      range: {
        label: "Time range",
        d7: "7 days",
        d30: "30 days",
        d90: "90 days"
      },
      noPermissionTitle: "No permission",
      noPermissionBody: "You need platform administrator rights to open this area.",
      overview: {
        generatedAt: "Generated",
        kpis: {
          users: "Users",
          newUsers: "+{n} new in range",
          active7d: "Active users 7d",
          workspaces: "Workspaces",
          runs: "Runs",
          successRate: "Success rate {rate}%",
          tokens: "AI tokens",
          pendingApprovals: "Pending approvals",
          pendingDetail: "Open requests",
          disabledDetail: "{n} disabled accounts",
          workspaceDetail: "{workflows} workflows · {active} active",
          runsDetail: "{completed} done · {failed} failed",
          tokensDetail: "{calls} AI calls"
        },
        charts: {
          runsTitle: "Runs per day",
          runsHint: "Total with failed segment",
          signupsTitle: "Signups per day",
          signupsHint: "New accounts",
          tokensTitle: "AI tokens per day",
          tokensHint: "Tokens consumed",
          approvalsTitle: "Approval outcomes",
          approvalsHint: "Within the selected range",
          leadsTitle: "Lead categories",
          leadsHint: "Whole platform",
          providerTitle: "Signups by provider",
          providerHint: "Password and Google",
          topTitle: "Top workspaces",
          topHint: "By run count",
          noData: "No data yet",
          approved: "Approved",
          rejected: "Rejected",
          pending: "Pending",
          high: "High intent",
          low: "Low intent",
          spam: "Spam",
          password: "Password",
          google: "Google",
          columns: {
            name: "Workspace",
            runs: "Runs",
            members: "Members",
            tokens: "AI tokens"
          }
        },
        exportTitle: "Export report",
        exportBody: "Download CSV for the selected time range.",
        exportUsers: "Users",
        exportWorkspaces: "Workspaces",
        exportRuns: "Runs",
        exportUsage: "AI usage"
      },
      accounts: {
        title: "Accounts",
        searchPlaceholder: "Search by name or email",
        filterLabel: "Status",
        status: {
          all: "All",
          active: "Active",
          disabled: "Disabled",
          admin: "Admin"
        },
        columns: {
          user: "User",
          provider: "Provider",
          role: "Role",
          status: "Status",
          workspaces: "Workspaces",
          created: "Created",
          lastLogin: "Last login",
          actions: "Actions"
        },
        roleAdmin: "Admin",
        statusActive: "Active",
        statusDisabled: "Disabled",
        lock: "Lock",
        unlock: "Unlock",
        grantAdmin: "Grant admin",
        revokeAdmin: "Revoke admin",
        selfHint: "You cannot change your own account",
        confirmTitle: "Confirm change",
        confirmBody: "Apply this change to {email}?",
        confirm: "Confirm",
        cancel: "Cancel",
        detailTitle: "Account detail",
        memberships: "Workspace memberships",
        noMemberships: "This account does not belong to any workspace yet.",
        joined: "Joined",
        close: "Close",
        empty: "No matching accounts.",
        loading: "Loading accounts...",
        prev: "Previous",
        next: "Next",
        pageInfo: "Page {page}/{totalPages} · {total} accounts",
        actionFailed: "Could not update the account. The previous state was restored.",
        errorSelf: "You cannot change your own account.",
        never: "Never signed in"
      },
      workspaces: {
        title: "Workspaces",
        searchPlaceholder: "Search by name, slug, or owner",
        columns: {
          name: "Workspace",
          slug: "Slug",
          owner: "Owner",
          members: "Members",
          workflows: "Workflows",
          runs: "Runs",
          tokens: "AI tokens",
          created: "Created"
        },
        empty: "No matching workspaces.",
        loading: "Loading workspaces...",
        prev: "Previous",
        next: "Next",
        pageInfo: "Page {page}/{totalPages} · {total} workspaces"
      },
      audit: {
        title: "Audit log",
        filterPlaceholder: "Filter by action name",
        columns: {
          time: "Time",
          actor: "Actor",
          action: "Action",
          entity: "Entity",
          workspace: "Workspace",
          metadata: "Metadata"
        },
        empty: "No matching audit entries.",
        loading: "Loading audit log...",
        prev: "Previous",
        next: "Next",
        pageInfo: "Page {page}/{totalPages} · {total} entries",
        details: "View JSON"
      }
    },
    states: {
      loading: "Loading data...",
      errorTitle: "Could not load data",
      errorBody: "The API did not respond. Check that the API is running, then reload the page.",
      demoBanner: "Showing demo data (NEXT_PUBLIC_DEMO_FALLBACK=true) because the API did not respond.",
      emptyTitle: "Nothing here yet",
      retry: "Reload"
    },
    approvals: {
      eyebrow: "Review",
      title: "Emails waiting for approval",
      intro: "AI-drafted emails for hot leads are only sent after you approve them.",
      empty: "No emails are waiting for approval.",
      lead: "Lead",
      assessment: "AI assessment",
      score: "Score",
      category: "Category",
      summary: "Summary",
      recommended: "Recommended action",
      email: "Draft email",
      subject: "Subject",
      body: "Body",
      comment: "Comment (optional)",
      approve: "Approve and send",
      reject: "Reject",
      working: "Sending decision...",
      approved: "Approved. The workflow sends the email and creates the sales task.",
      rejected: "Rejected. The run was cancelled.",
      conflict: "Someone already decided this step.",
      forbidden: "You need the MEMBER role or higher in this workspace to approve.",
      unauthorized: "Your session expired. Log in again.",
      failed: "Could not send the decision. Try again.",
      openRun: "Open run",
      requestedAt: "Requested",
      autoRefresh: "Refreshes every 5 seconds"
    },
    timeline: {
      live: "Live updates every 4 seconds",
      finished: "Run finished",
      input: "Input (PII masked)",
      output: "Output",
      tokens: "Tokens",
      model: "Model",
      duration: "Duration",
      error: "Error",
      retries: "Retries",
      noData: "No data recorded for this step yet.",
      runError: "Run error",
      waitingApproval: "This run is waiting for an email approval.",
      goToApprovals: "Open approvals",
      statusMessages: {
        PENDING: "Waiting for a worker.",
        RUNNING: "Running in a worker.",
        WAITING_APPROVAL: "Waiting for a reviewer to approve or reject.",
        COMPLETED: "Completed.",
        FAILED: "Failed.",
        SKIPPED: "Branch not taken."
      }
    },
    builder: {
      fallback: "fallback",
      design: "Design",
      run: "Run preview",
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
