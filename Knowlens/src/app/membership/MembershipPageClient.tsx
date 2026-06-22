"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  BadgeCheck,
  Check,
  ChevronDown,
  CreditCard,
  LoaderCircle,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  saveCheckoutReturnNotice,
  syncCreditRecordsFromServer,
  type BillingCycle,
} from "@/lib/billing";
import { PromoCountdownBanner } from "@/components/billing/PromoCountdownBanner";
import { useSession } from "next-auth/react";
import { findBillingPlan, type BillingPlanId } from "@/lib/billing-plans";
import { useLocale } from "@/components/i18n/LocaleProvider";

type Plan = {
  id: BillingPlanId;
  name: string;
  subtitle: string;
  monthlyPrice: number;
  yearlyPrice: number;
  yearlyEquivalent: number;
  monthlyCredits: number;
  usage: string;
  pricePrefix?: string;
  creditUnitLabel?: string;
  yearlyOnly?: boolean;
  recommended?: boolean;
  features: string[];
  supportedTextModels: string[];
  supportedImageModels: string[];
};

const SHARED_TEXT_MODELS = [
  "GPT-image2",
  "GPT-5.5",
  "Gemini 3.5",
  "Claude 4.7",
];
const SHARED_IMAGE_MODELS: string[] = [];

const plans: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    subtitle: "Create clean infographics and simple slides without watermark.",
    monthlyPrice: 14.9,
    yearlyPrice: 124.9,
    yearlyEquivalent: 10.43,
    monthlyCredits: 1200,
    usage: "6 credits/image during promo, up to ~200 images/month.",
    features: [
      "1,200 monthly credits",
      "No watermark",
      "Standard infographic generation",
      "Basic PPT generation",
      "Standard image export",
      "Basic visual styles",
      "Standard queue",
      "Image2 visuals with optimized credit usage",
    ],
    supportedTextModels: SHARED_TEXT_MODELS,
    supportedImageModels: SHARED_IMAGE_MODELS,
  },
  {
    id: "pro",
    name: "Creator",
    subtitle: "Best for creators turning articles, videos, and ideas into visual content.",
    monthlyPrice: 29,
    yearlyPrice: 242,
    yearlyEquivalent: 20.17,
    monthlyCredits: 3000,
    usage: "6 credits/image during promo, up to ~500 images/month.",
    recommended: true,
    features: [
      "3,000 monthly credits",
      "No watermark",
      "HD infographic export",
      "More visual styles",
      "Visual PPT generation",
      "YouTube thumbnail and poster generation",
      "Video storyboard generation",
      "Faster generation queue",
      "Longer content input",
      "Commercial usage",
      "Image2 visuals with optimized credit usage",
    ],
    supportedTextModels: SHARED_TEXT_MODELS,
    supportedImageModels: SHARED_IMAGE_MODELS,
  },
  {
    id: "scale",
    name: "Pro",
    subtitle: "For high-volume creators producing HD visuals, presentations, and video-ready content regularly.",
    monthlyPrice: 59,
    yearlyPrice: 489.9,
    yearlyEquivalent: 40.83,
    monthlyCredits: 7500,
    usage: "6 credits/image during promo, up to ~1,250 images/month.",
    features: [
      "7,500 monthly credits",
      "No watermark",
      "Premium HD export",
      "Long infographic generation",
      "Full visual PPT generation",
      "Video storyboard generation",
      "Priority rendering",
      "Batch generation",
      "Commercial usage",
      "Image2 visuals with optimized credit usage",
    ],
    supportedTextModels: SHARED_TEXT_MODELS,
    supportedImageModels: SHARED_IMAGE_MODELS,
  },
  {
    id: "insurance",
    name: "Insurance Annual",
    subtitle: "Best for insurance poster generation, private-domain marketing, and year-round customer outreach.",
    monthlyPrice: 199,
    yearlyPrice: 199,
    yearlyEquivalent: 199,
    monthlyCredits: 6000,
    usage: "Includes 6,000 credits and up to 1,000 insurance image generations and downloads.",
    pricePrefix: "¥",
    creditUnitLabel: "credits / year",
    yearlyOnly: true,
    features: [
      "Unlock all insurance poster templates",
      "Generate matching insurance posters in one click",
      "Designed for private-domain marketing and long-term outreach",
      "One-year insurance membership access",
    ],
    supportedTextModels: ["GPT-image2"],
    supportedImageModels: [],
  },
];

const faqItems = [
  {
    q: "Why is yearly billing better value?",
    a: "Yearly billing includes a default 30% discount versus monthly pricing for the same plan.",
  },
  {
    q: "How are credits used?",
    a: "A standard visual output costs 20 credits normally, or 6 credits during the limited-time offer. A standard visual output can be a poster, PPT slide, or storyboard frame.",
  },
  {
    q: "Which payment methods are supported?",
    a: "Subscriptions are processed securely through Stripe, including cards and Stripe-supported payment methods.",
  },
  {
    q: "When does access update after payment?",
    a: "Plan access is applied immediately after successful payment, including credits and feature permissions.",
  },
  {
    q: "Do credits reset every month?",
    a: "Yes. Credits are granted monthly by plan, including users who choose yearly billing.",
  },
  {
    q: "Can I upgrade or downgrade anytime?",
    a: "Yes. Upgrades are typically immediate with prorated adjustments. Downgrades apply at the next billing cycle.",
  },
  {
    q: "Are exports watermarked?",
    a: "Free users include watermark, standard queue, limited styles, and limited export quality. Paid plans remove watermark.",
  },
  {
    q: "How does team collaboration work?",
    a: "Current public plans focus on individual creators: Starter, Creator, and Pro.",
  },
  {
    q: "What happens if I run out of credits?",
    a: "High-cost actions are blocked before execution. You can top up or upgrade and then continue.",
  },
];

const planZh: Record<BillingPlanId, { name: string; subtitle: string; usage: string; features: string[] }> = {
  starter: {
    name: "入门版",
    subtitle: "适合轻量生成清晰信息图和简单幻灯片，无水印输出。",
    usage: "活动期每张图 6 积分，每月约可生成 200 张。",
    features: [
      "每月 1,200 积分",
      "无水印输出",
      "标准信息图生成",
      "基础 PPT 生成",
      "标准图片导出",
      "基础视觉风格",
      "标准生成队列",
      "使用 Image2 模型，积分消耗更优惠",
    ],
  },
  pro: {
    name: "创作者版",
    subtitle: "适合把文章、视频和想法持续做成视觉内容的创作者。",
    usage: "活动期每张图 6 积分，每月约可生成 500 张。",
    features: [
      "每月 3,000 积分",
      "无水印输出",
      "高清信息图导出",
      "更多视觉风格",
      "视觉 PPT 生成",
      "YouTube 封面和海报生成",
      "视频分镜生成",
      "更快生成队列",
      "支持更长内容输入",
      "可商用",
      "使用 Image2 模型，积分消耗更优惠",
    ],
  },
  scale: {
    name: "专业版",
    subtitle: "适合高频生成高清视觉、演示文稿和视频分镜的团队或个人。",
    usage: "活动期每张图 6 积分，每月约可生成 1,250 张。",
    features: [
      "每月 7,500 积分",
      "无水印输出",
      "高级高清导出",
      "长信息图生成",
      "完整视觉 PPT 生成",
      "视频分镜生成",
      "优先渲染",
      "批量生成",
      "可商用",
      "使用 Image2 模型，积分消耗更优惠",
    ],
  },
  insurance: {
    name: "保险包年会员",
    subtitle: "适合保险海报生成、朋友圈展业和全年客户触达。",
    usage: "含 6,000 积分，1,000 次生图和下载。",
    features: [
      "解锁全部保险海报模板",
      "一键生成保险同款海报",
      "适合私域营销与长期展业",
      "会员权益有效期 1 年",
    ],
  },
};

const faqZh: Record<string, { q: string; a: string }> = {
  "Why is yearly billing better value?": {
    q: "为什么年付更划算？",
    a: "年付相当于同套餐月付价格的 7 折，适合长期持续使用。",
  },
  "How are credits used?": {
    q: "积分怎么消耗？",
    a: "标准视觉输出原价 20 积分，限时活动期为 6 积分。一次输出可以是海报、PPT 页面或视频分镜画面。",
  },
  "Which payment methods are supported?": {
    q: "支持哪些支付方式？",
    a: "订阅通过 Stripe 安全处理，支持银行卡以及 Stripe 可用的支付方式。",
  },
  "When does access update after payment?": {
    q: "付款后多久生效？",
    a: "付款成功后会立即开通套餐权益，并同步对应积分。",
  },
  "Do credits reset every month?": {
    q: "积分每月会重置吗？",
    a: "会。积分按套餐每月发放，年付用户也会按月获得当月积分。",
  },
  "Can I upgrade or downgrade anytime?": {
    q: "可以随时升级或降级吗？",
    a: "可以。升级通常会立即生效并按比例调整，降级会在下一个计费周期生效。",
  },
  "Are exports watermarked?": {
    q: "导出内容有水印吗？",
    a: "免费用户会有水印、队列和导出质量限制。付费套餐会移除水印。",
  },
  "How does team collaboration work?": {
    q: "支持团队协作吗？",
    a: "当前公开套餐主要面向个人创作者，包含入门版、创作者版和专业版。",
  },
  "What happens if I run out of credits?": {
    q: "积分用完后怎么办？",
    a: "高成本操作会在执行前拦截。你可以充值或升级套餐后继续生成。",
  },
};

function formatUsd(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

const PENDING_CHECKOUT_KEY = "knowlens-pending-checkout-v1";
const CHECKOUT_REQUEST_TIMEOUT_MS = 25_000;
const MEMBERSHIP_SOURCE_KEY = "knowlens:membership-source";
const MEMBERSHIP_PREFERRED_PLAN_KEY = "knowlens:membership-preferred-plan";
const MEMBERSHIP_PREFERRED_CYCLE_KEY = "knowlens:membership-preferred-cycle";
const PAYMENT_CTA_CLASS =
  "border border-transparent bg-zinc-900 text-white shadow-[0_8px_20px_rgba(15,23,42,0.18)] hover:bg-zinc-700 hover:shadow-[0_10px_24px_rgba(15,23,42,0.20)] active:translate-y-px active:shadow-[0_6px_16px_rgba(15,23,42,0.16)]";
const SECONDARY_PAYMENT_CTA_CLASS =
  "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100";

type PendingCheckout = {
  planId: string;
  cycle: BillingCycle | "one_time";
  startedAt: string;
  sessionId?: string;
  source?: string;
  purchaseType?: "subscription" | "credit_topup";
  credits?: number;
};

type TelemetryEventInput = {
  category: string;
  action: string;
  status?: "ok" | "error" | "info";
  source?: string;
  code?: string;
  message?: string;
  details?: unknown;
};

function readMembershipSource() {
  if (typeof window === "undefined") {
    return "unknown";
  }
  try {
    const source = window.sessionStorage.getItem(MEMBERSHIP_SOURCE_KEY)?.trim();
    return source || "unknown";
  } catch {
    return "unknown";
  }
}

function readPendingCheckout() {
  if (typeof window === "undefined") {
    return null as PendingCheckout | null;
  }
  const raw = window.sessionStorage.getItem(PENDING_CHECKOUT_KEY);
  if (!raw) {
    return null as PendingCheckout | null;
  }
  try {
    return JSON.parse(raw) as PendingCheckout;
  } catch {
    return null as PendingCheckout | null;
  }
}

function savePendingCheckout(input: PendingCheckout) {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify(input));
}

function clearPendingCheckout() {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
}

function readPreferredMembershipPlan() {
  if (typeof window === "undefined") {
    return null as BillingPlanId | null;
  }
  try {
    const value = window.sessionStorage.getItem(MEMBERSHIP_PREFERRED_PLAN_KEY)?.trim() as BillingPlanId | undefined;
    return value || null;
  } catch {
    return null as BillingPlanId | null;
  }
}

function readPreferredMembershipCycle() {
  if (typeof window === "undefined") {
    return null as BillingCycle | null;
  }
  try {
    const value = window.sessionStorage.getItem(MEMBERSHIP_PREFERRED_CYCLE_KEY)?.trim();
    return value === "monthly" || value === "yearly" ? value : null;
  } catch {
    return null as BillingCycle | null;
  }
}

function readInitialMembershipState() {
  const membershipSource = readMembershipSource();
  const preferredPlanId = readPreferredMembershipPlan();
  const preferredCycle = readPreferredMembershipCycle();
  const isInsuranceFlow =
    preferredPlanId === "insurance" || membershipSource.toLowerCase().includes("insurance");
  return {
    membershipSource,
    preferredPlanId,
    billingCycle: preferredCycle || (isInsuranceFlow ? "yearly" : "monthly"),
  };
}

function formatPlanPriceValue(value: number, prefix = "$") {
  return `${prefix}${formatUsd(value)}`;
}

export default function MembershipPage() {
  const router = useRouter();
  const { locale, t } = useLocale();
  const { data: session, status: sessionStatus } = useSession();
  const [initialMembershipState] = useState(readInitialMembershipState);
  const [membershipSource] = useState(initialMembershipState.membershipSource);
  const [preferredPlanId] = useState<BillingPlanId | null>(initialMembershipState.preferredPlanId);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(initialMembershipState.billingCycle);
  const [toast, setToast] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState(0);
  const [payingPlanId, setPayingPlanId] = useState<BillingPlanId | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [pendingFinalizeSessionId, setPendingFinalizeSessionId] = useState<string | null>(() => {
    const pending = readPendingCheckout();
    return pending?.sessionId ?? null;
  });
  const [pendingCheckoutMeta, setPendingCheckoutMeta] = useState<PendingCheckout | null>(() => readPendingCheckout());
  const processedSessionRef = useRef<string | null>(null);
  const membershipExposureLoggedRef = useRef(false);
  const currentEmail = (session?.user?.email ?? "").trim().toLowerCase();
  const [, setRefreshVersion] = useState(0);
  const [returnPath] = useState(() => {
    if (typeof window === "undefined") {
      return "/";
    }
    try {
      const storedPath = window.sessionStorage.getItem("membership:return-path");
      if (storedPath && storedPath !== "/membership") {
        return storedPath;
      }
    } catch {
      return "/";
    }
    return "/";
  });

  const resolveMembershipSource = useCallback(() => {
    return membershipSource || "unknown";
  }, [membershipSource]);
  const isInsuranceMembershipFlow =
    preferredPlanId === "insurance" || membershipSource.toLowerCase().includes("insurance");

  const trackTelemetry = useCallback(async (event: TelemetryEventInput) => {
    try {
      await fetch("/api/telemetry/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });
    } catch {
      // best-effort telemetry only
    }
  }, []);

  useEffect(() => {
    if (membershipExposureLoggedRef.current || typeof window === "undefined" || sessionStatus === "loading") {
      return;
    }
    membershipExposureLoggedRef.current = true;
    const params = new URLSearchParams(window.location.search);
    void trackTelemetry({
      category: "billing",
      action: "membership_page_exposed",
      status: "info",
      source: resolveMembershipSource(),
      details: {
        path: window.location.pathname,
        checkoutStatus: params.get("checkout"),
        hasSessionId: Boolean(params.get("session_id")),
        authenticated: sessionStatus === "authenticated",
        returnPath,
      },
    });
  }, [resolveMembershipSource, returnPath, sessionStatus, trackTelemetry]);

  const finalizeCheckoutSession = useCallback(
    async (sessionId: string) => {
      setFinalizing(true);
      try {
        const response = await fetch("/api/billing/finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const data = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          duplicate?: boolean;
          reason?: string;
          error?: string;
          message?: string;
          cycle?: BillingCycle;
          checkoutMode?: string;
          checkoutSource?: string;
          credited?: boolean;
          purchaseType?: string;
          credits?: number;
          plan?: {
            id?: string;
            name?: string;
          };
        };

        if (response.ok && data.ok) {
          const eventSource = data.checkoutSource || resolveMembershipSource();
          const isCreditTopup = data.purchaseType === "credit_topup";
          const creditTopupLabel = typeof data.credits === "number" && data.credits > 0
            ? `${data.credits.toLocaleString("zh-CN")} credits`
            : "credits";
          void trackTelemetry({
            category: "billing",
            action: "checkout_return_success",
            status: "ok",
            source: eventSource,
            message: data.duplicate
              ? "Checkout return verified as duplicate."
              : "Checkout return verified successfully.",
            details: {
              sessionId,
              duplicate: Boolean(data.duplicate),
              credited: Boolean(data.credited),
              cycle: data.cycle,
              checkoutMode: data.checkoutMode,
              purchaseType: data.purchaseType ?? null,
              credits: data.credits ?? null,
              planId: data.plan?.id ?? null,
              planName: data.plan?.name ?? null,
              returnPath,
            },
          });
          if (currentEmail) {
            await syncCreditRecordsFromServer(currentEmail).catch(() => undefined);
          }
          clearPendingCheckout();
          setPendingCheckoutMeta(null);
          setPendingFinalizeSessionId(null);
          setRefreshVersion((prev) => prev + 1);
          saveCheckoutReturnNotice({
            status: "success",
            message: isCreditTopup
              ? data.duplicate
                ? "Credit top-up was already verified. Credits were not added twice."
                : `Top-up successful. ${creditTopupLabel} are ready to use.`
              : data.duplicate
                ? "Membership is active and your credits are ready to use."
                : "Membership activated successfully. Your credits are ready to use.",
            returnPath,
            source: eventSource,
            createdAt: new Date().toISOString(),
          });
          setToast(
            isCreditTopup
              ? data.duplicate
                ? "Payment already verified earlier. Credits were not added twice."
                : `Payment verified. ${creditTopupLabel} added.`
              : data.duplicate
                ? "Payment already verified earlier. Credits were not added twice."
                : "Payment verified. Membership and credits are now active.",
          );
          router.replace(returnPath);
          return;
        }

        if (data.reason === "canceled_or_incomplete") {
          void trackTelemetry({
            category: "billing",
            action: "checkout_return_canceled",
            status: "info",
            source: data.checkoutSource || resolveMembershipSource(),
            message: "Checkout was canceled or left incomplete.",
            details: {
              sessionId,
              reason: data.reason,
              returnPath,
            },
          });
          clearPendingCheckout();
          setPendingCheckoutMeta(null);
          setPendingFinalizeSessionId(null);
          setToast("Checkout was canceled or not completed. No charge and no credits were added.");
          router.replace(returnPath);
          return;
        }

        if (data.reason === "payment_failed_or_unpaid") {
          void trackTelemetry({
            category: "billing",
            action: "checkout_return_failed",
            status: "error",
            source: data.checkoutSource || resolveMembershipSource(),
            code: data.reason,
            message: "Checkout returned without a paid payment status.",
            details: {
              sessionId,
              reason: data.reason,
              returnPath,
            },
          });
          clearPendingCheckout();
          setPendingCheckoutMeta(null);
          setPendingFinalizeSessionId(null);
          setToast("Payment failed. No credits were added. Please try another payment method.");
          router.replace(returnPath);
          return;
        }

        throw new Error(data.error || data.message || "Payment verification failed.");
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : "Network interrupted while verifying payment. No credits were added.";
        setPendingFinalizeSessionId(sessionId);
        void trackTelemetry({
          category: "billing",
          action: "checkout_return_verification_failed",
          status: "error",
          source: resolveMembershipSource(),
          message,
          details: {
            sessionId,
            returnPath,
          },
        });
        setToast(`${message} You can retry verification.`);
      } finally {
        setFinalizing(false);
      }
    },
    [currentEmail, resolveMembershipSource, returnPath, router, trackTelemetry],
  );

  useEffect(() => {
    if (typeof window === "undefined" || finalizing) {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const checkoutStatus = params.get("checkout");
    const sessionId = params.get("session_id");

    if (checkoutStatus === "cancel") {
      const pendingSource = readPendingCheckout()?.source;
      void trackTelemetry({
        category: "billing",
        action: "checkout_return_canceled",
        status: "info",
        source: pendingSource || resolveMembershipSource(),
        message: "Checkout returned with cancel status from Stripe.",
        details: {
          returnPath,
        },
      });
      clearPendingCheckout();
      saveCheckoutReturnNotice({
        status: "error",
        message: "Checkout was canceled. No charge and no credits were added.",
        returnPath,
        source: pendingSource || resolveMembershipSource(),
        createdAt: new Date().toISOString(),
      });
      router.replace(returnPath);
      return;
    }

    if (checkoutStatus !== "success" || !sessionId) {
      return;
    }

    if (processedSessionRef.current === sessionId) {
      return;
    }
    processedSessionRef.current = sessionId;

    const pending = readPendingCheckout();
    if (pending) {
      savePendingCheckout({
        ...pending,
        sessionId,
      });
    }
    void finalizeCheckoutSession(sessionId);
  }, [finalizeCheckoutSession, finalizing, resolveMembershipSource, returnPath, router, trackTelemetry]);

  const plansWithCyclePrice = useMemo(() => {
    return plans.map((plan) => {
      const monthly = plan.monthlyPrice;
      const yearly = plan.yearlyPrice;
      const effectiveCycle = plan.yearlyOnly ? "yearly" : billingCycle;
      const cyclePrice = effectiveCycle === "monthly" ? monthly : yearly;
      const cycleUnit = effectiveCycle === "monthly" ? t("/mo", "/月") : t("/yr", "/年");
      const monthlyEquivalent = billingCycle === "yearly" ? plan.yearlyEquivalent : monthly;
      return {
        ...plan,
        effectiveCycle,
        cyclePrice,
        cycleUnit,
        yearly,
        monthlyEquivalent,
      };
    });
  }, [billingCycle, t]);
  const visiblePlans = useMemo(() => {
    return isInsuranceMembershipFlow
      ? plansWithCyclePrice.filter((plan) => plan.id === "insurance")
      : plansWithCyclePrice.filter((plan) => plan.id !== "insurance");
  }, [isInsuranceMembershipFlow, plansWithCyclePrice]);
  const mobileStickyPlan = isInsuranceMembershipFlow ? visiblePlans[0] : null;

  async function handlePay(plan: Plan) {
    const isPaying = Boolean(payingPlanId);
    if (isPaying || finalizing) {
      return;
    }
    setPayingPlanId(plan.id);
    const effectiveCycle: BillingCycle = plan.yearlyOnly ? "yearly" : billingCycle;
    if (sessionStatus === "loading") {
      setToast("Checking your account. Please try again in a second.");
      setPayingPlanId(null);
      return;
    }
    const eventSource = resolveMembershipSource();
    void trackTelemetry({
      category: "billing",
      action: "pay_button_clicked",
      status: "info",
      source: eventSource,
      details: {
        planId: plan.id,
        cycle: effectiveCycle,
        authenticated: Boolean(currentEmail),
        path: "/membership",
      },
    });
    if (!currentEmail) {
      const pendingCheckout = {
        planId: plan.id,
        cycle: effectiveCycle,
        startedAt: new Date().toISOString(),
        source: eventSource,
      };
      savePendingCheckout(pendingCheckout);
      setPendingCheckoutMeta(pendingCheckout);
      void trackTelemetry({
        category: "billing",
        action: "membership_auth_redirect_started",
        status: "info",
        source: eventSource,
        details: {
          planId: plan.id,
          cycle: effectiveCycle,
          callbackUrl: "/membership",
        },
      });
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("membership:return-path", "/membership");
      }
      setToast("Sign in to continue checkout.");
      setPayingPlanId(null);
      router.push(`/auth?callbackUrl=${encodeURIComponent("/membership")}`);
      return;
    }
    if (!findBillingPlan(plan.id)) {
      setToast("Plan config is invalid. Please refresh and retry.");
      setPayingPlanId(null);
      return;
    }
    router.prefetch(returnPath);
    try {
      savePendingCheckout({
        planId: plan.id,
        cycle: effectiveCycle,
        startedAt: new Date().toISOString(),
        source: eventSource,
      });
      setPendingCheckoutMeta({
        planId: plan.id,
        cycle: effectiveCycle,
        startedAt: new Date().toISOString(),
        source: eventSource,
      });
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), CHECKOUT_REQUEST_TIMEOUT_MS);
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          cycle: effectiveCycle,
          source: membershipSource,
        }),
        signal: controller.signal,
      }).finally(() => {
        window.clearTimeout(timeoutId);
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        checkoutUrl?: string;
        directCheckoutUrl?: string;
        fallback?: boolean;
        error?: string;
        sessionId?: string | null;
      };
      if (!response.ok || !data.ok || !data.checkoutUrl) {
        throw new Error(data.error || "Unable to create checkout session.");
      }
      if (data.sessionId) {
        const nextPendingCheckout = {
          planId: plan.id,
          cycle: effectiveCycle,
          startedAt: new Date().toISOString(),
          sessionId: data.sessionId,
          source: eventSource,
        } satisfies PendingCheckout;
        savePendingCheckout(nextPendingCheckout);
        setPendingCheckoutMeta(nextPendingCheckout);
      }
      if (data.fallback) {
        setToast("Using one-time checkout fallback to maximize payment success.");
      }
      void trackTelemetry({
        category: "billing",
        action: "checkout_redirect_started",
        status: "ok",
        source: eventSource,
        details: {
          planId: plan.id,
          cycle: effectiveCycle,
          fallback: Boolean(data.fallback),
          sessionId: data.sessionId ?? null,
          path: "/membership",
        },
      });
      const directCheckoutUrl = (data.directCheckoutUrl || "").trim();
      const redirectCheckoutUrl = data.checkoutUrl.trim();
      const preferredCheckoutUrl = directCheckoutUrl || redirectCheckoutUrl;
      window.setTimeout(() => {
        if (document.visibilityState === "visible") {
          window.location.replace(redirectCheckoutUrl);
        }
      }, 2500);
      window.location.assign(preferredCheckoutUrl);
      return;
    } catch (error) {
      clearPendingCheckout();
      setPendingCheckoutMeta(null);
      const message =
        error instanceof DOMException && error.name === "AbortError"
          ? "Checkout is taking too long. Please try again."
          : error instanceof Error
            ? error.message
            : "Checkout failed.";
      const normalized = message.toLowerCase();
      if (
        normalized.includes("stripe") &&
        (normalized.includes("key") || normalized.includes("configured"))
      ) {
        setToast("Stripe checkout is unavailable. Please verify server env STRIPE_SECRET_KEY.");
      } else {
        setToast(message);
      }
      void trackTelemetry({
        category: "billing",
        action: "checkout_redirect_failed",
        status: "error",
        source: eventSource,
        message,
        details: {
          planId: plan.id,
          cycle: effectiveCycle,
          path: "/membership",
        },
      });
      setPayingPlanId(null);
    } finally {
      // Keep loading state while browser navigates to Stripe.
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f7f9]">
      <div className="fixed inset-0 bg-zinc-900/30 backdrop-blur-[2px]" />
      <div className="relative z-10 mx-auto flex min-h-screen w-full items-end justify-center p-0 sm:items-center sm:p-5">
        <div className="w-full max-w-6xl overflow-hidden rounded-t-3xl border border-zinc-200 bg-white shadow-2xl sm:rounded-3xl">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
            <p className="text-sm font-medium text-zinc-500">
              {isInsuranceMembershipFlow ? t("Insurance Membership", "保险会员") : "Membership"}
            </p>
            <button
              type="button"
              onClick={() => router.push(returnPath)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              aria-label="Close membership modal"
            >
              <X size={16} />
            </button>
          </div>

          <div className="max-h-[88dvh] overflow-y-auto px-3 pb-28 pt-4 sm:max-h-[86vh] sm:px-6 sm:pb-8 sm:pt-5 lg:px-8">
            <PromoCountdownBanner />

            <section className="mt-5 flex justify-center">
              {isInsuranceMembershipFlow ? (
                <div className="inline-flex w-full max-w-[360px] items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800">
                  {t("Insurance annual membership only", "保险包年会员，固定 1 年有效期")}
                </div>
              ) : (
                <div className="inline-flex w-full max-w-[360px] rounded-full border border-zinc-200 bg-zinc-100 p-1">
                  <button
                    type="button"
                    onClick={() => setBillingCycle("monthly")}
                    className={`flex-1 rounded-full px-3 py-2 text-xs font-medium transition sm:px-4 sm:text-sm ${
                      billingCycle === "monthly"
                        ? "bg-zinc-900 text-white"
                        : "text-zinc-600 hover:text-zinc-900"
                    }`}
                  >
                    {t("Monthly", "月付")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle("yearly")}
                    className={`flex-1 rounded-full px-3 py-2 text-xs font-medium transition sm:px-4 sm:text-sm ${
                      billingCycle === "yearly"
                        ? "bg-zinc-900 text-white"
                        : "text-zinc-600 hover:text-zinc-900"
                    }`}
                  >
                    {t("Annual (Save 30%)", "年付（省 30%）")}
                  </button>
                </div>
              )}
            </section>

            <section className="mt-6 grid gap-3 sm:gap-4 lg:grid-cols-3">
          {visiblePlans.map((plan) => (
            <article
              key={plan.id}
              className={`relative flex h-full flex-col rounded-2xl border bg-white p-4 shadow-sm sm:p-5 ${
                plan.recommended
                  ? "border-zinc-900 ring-1 ring-zinc-900/15"
                  : "border-zinc-200"
              }`}
            >
              {plan.recommended ? (
                <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                  <BadgeCheck size={12} />
                  {t("Most Popular", "最受欢迎")}
                </span>
              ) : null}

              <h2 className="text-lg font-semibold text-zinc-900">{locale === "zh" ? planZh[plan.id].name : plan.name}</h2>
              <p className="mt-1 text-xs leading-5 text-zinc-500">{locale === "zh" ? planZh[plan.id].subtitle : plan.subtitle}</p>
              <p className="mt-1 text-sm text-zinc-500">
                {plan.monthlyCredits.toLocaleString(locale === "zh" ? "zh-CN" : "en-US")}{" "}
                {plan.id === "insurance"
                  ? t("credits / year", "积分 / 年")
                  : t(plan.creditUnitLabel || "credits / month", "积分 / 月")}
              </p>

              <div className="mt-4">
                <p className="text-3xl font-semibold leading-none text-zinc-900">
                  {formatPlanPriceValue(plan.cyclePrice, plan.pricePrefix || "$")}
                  <span className="ml-1 text-base font-medium text-zinc-500">
                    {plan.cycleUnit}
                  </span>
                </p>
                {billingCycle === "yearly" && !plan.yearlyOnly ? (
                  <p className="mt-1 text-xs text-zinc-500">
                    {t("Equivalent to", "折合")} {formatPlanPriceValue(plan.monthlyEquivalent, plan.pricePrefix || "$")}
                    {t("/mo", "/月")}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => handlePay(plan)}
                disabled={Boolean(payingPlanId) || finalizing}
                className={`mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition ${
                  plan.recommended ? PAYMENT_CTA_CLASS : SECONDARY_PAYMENT_CTA_CLASS
                } ${
                  payingPlanId || finalizing ? "cursor-not-allowed opacity-70" : ""
                }`}
              >
                {payingPlanId === plan.id ? <LoaderCircle size={15} className="animate-spin" /> : <Zap size={15} />}
                {payingPlanId === plan.id
                  ? t("Opening Checkout...", "正在打开支付页...")
                  : finalizing
                    ? t("Verifying Payment...", "正在确认支付...")
                    : t("Subscribe with Stripe", "通过 Stripe 订阅")}
              </button>

              <p className="mt-2 text-xs text-zinc-500">{locale === "zh" ? planZh[plan.id].usage : plan.usage}</p>

              <ul className="mt-4 space-y-2 text-sm text-zinc-700">
                <li className="border-b border-zinc-200 pb-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-900">
                    {t("Model Access", "可用模型")}
                  </p>
                  <div className="mt-2 space-y-1">
                    {plan.supportedTextModels.map((model) => {
                      const hasPromo = model.toLowerCase().includes("gpt-image2");
                      return (
                        <p
                          key={`${plan.id}-text-model-${model}`}
                          className="flex items-center gap-2 text-[12px] leading-5 text-zinc-700"
                        >
                          <Check size={12} className="shrink-0 text-zinc-900" />
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span>{model}</span>
                            {hasPromo ? (
                              <span className="inline-flex items-center rounded-full border border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900 shadow-sm shadow-amber-100/80">
                                {t("Limited-time 70% off", "限时 7 折")}
                              </span>
                            ) : null}
                          </span>
                        </p>
                      );
                    })}
                  </div>
                  {plan.supportedImageModels.length ? (
                    <div className="mt-2 space-y-1">
                      {plan.supportedImageModels.map((model) => (
                        <p
                          key={`${plan.id}-image-model-${model}`}
                          className="flex items-center gap-2 text-[12px] leading-5 text-zinc-700"
                        >
                          <Check size={12} className="shrink-0 text-zinc-900" />
                          <span>{model}</span>
                        </p>
                      ))}
                    </div>
                  ) : null}
                </li>
                {(locale === "zh" ? planZh[plan.id].features : plan.features).map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check size={14} className="mt-0.5 text-zinc-900" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
            </section>
            {!isInsuranceMembershipFlow ? (
              <p className="mt-3 text-xs leading-5 text-amber-800">
                {t("* GPT-image2 limited-time 70% off offer. Availability windows may change.", "* GPT-image2 限时 7 折活动，活动时间可能调整。")}
              </p>
            ) : null}

            <section className="mt-6 rounded-2xl border border-zinc-200 bg-white px-4 py-4 shadow-sm sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-zinc-900">{t("Trusted Billing & Security", "支付与账户安全")}</h3>
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] text-zinc-600">
              Stripe Checkout
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5">
              <p className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-900">
                <ShieldCheck size={14} />
                {t("Encrypted Payments", "加密支付")}
              </p>
              <p className="mt-1 text-xs leading-5 text-zinc-600">
                {t("Secure Stripe checkout with industry-standard protection.", "通过 Stripe 安全结账，采用行业标准保护。")}
              </p>
            </article>
            <article className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5">
              <p className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-900">
                <CreditCard size={14} />
                {t("Full Subscription Control", "订阅可控")}
              </p>
              <p className="mt-1 text-xs leading-5 text-zinc-600">
                {t("Auto-renew is enabled, and you can cancel anytime.", "订阅会自动续费，也可以随时取消。")}
              </p>
            </article>
            <article className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5">
              <p className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-900">
                <BadgeCheck size={14} />
                {t("Invoice Ready", "支持账单记录")}
              </p>
              <p className="mt-1 text-xs leading-5 text-zinc-600">
                {t("Billing records and invoice support for teams and businesses.", "保留支付记录，方便团队和企业管理。")}
              </p>
            </article>
            <article className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5">
              <p className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-900">
                <Zap size={14} />
                {t("Start Small, Scale Fast", "从小规模开始")}
              </p>
              <p className="mt-1 text-xs leading-5 text-zinc-600">
                {t("Begin with a lower plan and upgrade as your output grows.", "可以先用低档套餐，内容需求增加后再升级。")}
              </p>
            </article>
          </div>
            </section>

            <section className="mt-6 rounded-2xl border border-zinc-200 bg-white px-4 py-5 shadow-sm sm:px-5 sm:py-6">
          <h3 className="text-lg font-semibold text-zinc-900">{t("Frequently Asked Questions", "常见问题")}</h3>
          <div className="mt-4 divide-y divide-zinc-200">
            {faqItems.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={item.q} className="py-3">
                  <button
                    type="button"
                    onClick={() => setOpenFaq((prev) => (prev === idx ? -1 : idx))}
                    data-plain-interaction="true"
                    className="flex w-full items-center justify-between gap-3 text-left transition hover:text-zinc-950"
                  >
                    <p className="text-sm font-medium text-zinc-900">{locale === "zh" ? faqZh[item.q]?.q ?? item.q : item.q}</p>
                    <ChevronDown
                      size={16}
                      className={`shrink-0 text-zinc-500 transition ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isOpen ? (
                    <p className="mt-2 pr-6 text-sm leading-6 text-zinc-600">{locale === "zh" ? faqZh[item.q]?.a ?? item.a : item.a}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
            </section>
          </div>
          {mobileStickyPlan ? (
            <div className="border-t border-zinc-200 bg-white px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:hidden">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-zinc-500">{locale === "zh" ? planZh[mobileStickyPlan.id].name : mobileStickyPlan.name}</p>
                  <p className="text-lg font-semibold leading-none text-zinc-950">
                    {formatPlanPriceValue(mobileStickyPlan.cyclePrice, mobileStickyPlan.pricePrefix || "$")}
                    <span className="ml-1 text-xs font-medium text-zinc-500">{mobileStickyPlan.cycleUnit}</span>
                  </p>
                </div>
                <p className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                  {mobileStickyPlan.monthlyCredits.toLocaleString(locale === "zh" ? "zh-CN" : "en-US")} {t("credits", "积分")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handlePay(mobileStickyPlan)}
                disabled={Boolean(payingPlanId) || finalizing}
                className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold shadow-[0_10px_24px_rgba(15,23,42,0.18)] transition ${PAYMENT_CTA_CLASS} ${
                  payingPlanId || finalizing ? "cursor-not-allowed opacity-70" : ""
                }`}
              >
                {payingPlanId === mobileStickyPlan.id || finalizing ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : (
                  <Zap size={16} />
                )}
                {payingPlanId === mobileStickyPlan.id
                  ? t("Opening Checkout...", "正在打开支付页...")
                  : finalizing
                    ? t("Verifying Payment...", "正在确认支付...")
                    : t("Subscribe with Stripe", "通过 Stripe 订阅")}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {pendingFinalizeSessionId ? (
        <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-1rem)] max-w-[560px] -translate-x-1/2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-lg sm:bottom-20 sm:w-[min(92vw,560px)]">
          <p className="font-medium">{t("Payment verification is pending", "支付状态待确认")}</p>
          <p className="mt-1 text-xs leading-5 text-amber-800">
            {pendingCheckoutMeta
              ? pendingCheckoutMeta.purchaseType === "credit_topup" || pendingCheckoutMeta.cycle === "one_time"
                ? t(
                    `Credit top-up ${pendingCheckoutMeta.planId} was started, but verification did not complete yet.`,
                    `已开始积分充值${pendingCheckoutMeta.credits ? `（${pendingCheckoutMeta.credits.toLocaleString("zh-CN")} 积分）` : ""}，但支付验证尚未完成。`,
                  )
                : t(
                    `Plan ${pendingCheckoutMeta.planId} (${pendingCheckoutMeta.cycle}) was started, but verification did not complete yet.`,
                    `已开始订阅 ${planZh[pendingCheckoutMeta.planId as BillingPlanId]?.name ?? pendingCheckoutMeta.planId}（${pendingCheckoutMeta.cycle === "yearly" ? "年付" : "月付"}），但支付验证尚未完成。`,
                  )
              : t("A checkout session returned, but verification did not complete yet.", "已从支付页返回，但支付验证尚未完成。")}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void finalizeCheckoutSession(pendingFinalizeSessionId)}
              disabled={finalizing}
              className={`inline-flex h-8 items-center rounded-full px-3 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${PAYMENT_CTA_CLASS}`}
            >
              {finalizing ? t("Verifying...", "正在验证...") : t("Retry verification", "重新验证")}
            </button>
            <button
              type="button"
              onClick={() => {
                clearPendingCheckout();
                setPendingCheckoutMeta(null);
                setPendingFinalizeSessionId(null);
              }}
              className="inline-flex h-8 items-center rounded-lg border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
            >
              {t("Dismiss", "关闭")}
            </button>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed left-1/2 top-3 z-50 w-[calc(100%-1.5rem)] max-w-[560px] -translate-x-1/2 rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg sm:top-6 sm:w-auto">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
