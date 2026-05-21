"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  ChevronDown,
  CreditCard,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  activateSubscription,
  appendCreditRecord,
  getSubscription,
  type BillingCycle,
  type SubscriptionSnapshot,
} from "@/lib/billing";

type Plan = {
  id: string;
  name: string;
  subtitle: string;
  monthlyPrice: number;
  monthlyCredits: number;
  recommended?: boolean;
  features: string[];
  stripeLinks: {
    monthly?: string;
    yearly?: string;
  };
};

const annualDiscountRate = 0.3;

const plans: Plan[] = [
  {
    id: "starter",
    name: "入门版",
    subtitle: "适合个人创作者起步",
    monthlyPrice: 59,
    monthlyCredits: 800,
    features: [
      "基础内容理解与 10 页大纲生成",
      "标准分镜生成与单次重绘",
      "基础 TTS 配音与视频合成导出",
      "标准导出（含水印）",
      "1 个进行中项目",
      "基础模型可用",
    ],
    stripeLinks: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_STARTER_MONTHLY,
      yearly: process.env.NEXT_PUBLIC_STRIPE_STARTER_YEARLY,
    },
  },
  {
    id: "pro",
    name: "专业版",
    subtitle: "适合稳定更新的内容团队",
    monthlyPrice: 129,
    monthlyCredits: 2400,
    recommended: true,
    features: [
      "高级内容规划与课堂化表达优化",
      "更多分镜重绘历史与版本保留（50 条）",
      "进阶 TTS 音色与情绪控制",
      "优先队列生成与更快导出速度",
      "支持团队共享项目空间（3 人）",
      "导出无水印（1080p）与品牌主题模板",
      "批量生成 10 组分镜草案",
      "高级模型优先可用",
    ],
    stripeLinks: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY,
      yearly: process.env.NEXT_PUBLIC_STRIPE_PRO_YEARLY,
    },
  },
  {
    id: "studio",
    name: "工作室版",
    subtitle: "适合机构与大规模生产",
    monthlyPrice: 299,
    monthlyCredits: 6500,
    features: [
      "大规模批量科普内容生成",
      "无限画布协作与审校流程",
      "多成员角色权限与资产管理",
      "专属导出参数（最高 4K）与品牌模板",
      "专属支持通道（1v1）",
      "团队席位（10 人）与审批流",
      "语音包与画风库统一管理",
      "项目版本回溯与操作日志",
      "API / 自动化工作流接入",
      "最高优先级生成队列",
    ],
    stripeLinks: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_STUDIO_MONTHLY,
      yearly: process.env.NEXT_PUBLIC_STRIPE_STUDIO_YEARLY,
    },
  },
];

const faqItems = [
  {
    q: "包年为什么更划算？",
    a: "包年在同档位总价基础上默认享受 30% 折扣，适合有稳定内容生产需求的创作者与团队。",
  },
  {
    q: "积分怎么消耗？",
    a: "积分会用于内容规划、分镜生成、图片重绘、TTS 合成和视频导出等能力，页面中会在关键步骤提前展示账单。",
  },
  {
    q: "支持哪些支付方式？",
    a: "当前支持 Stripe 安全支付。你可以通过银行卡等 Stripe 支持的支付方式完成订阅。",
  },
  {
    q: "升级后权益什么时候生效？",
    a: "支付成功后会立即生效，积分和能力权限会自动同步到你的账号。",
  },
  {
    q: "积分每月会清零吗？",
    a: "默认按自然月结算，当月未使用积分可部分结转到下个周期，具体结转上限按套餐不同而不同。",
  },
  {
    q: "可以中途升级或降级吗？",
    a: "支持。升级通常立即生效并按剩余周期折算，降级会在当前计费周期结束后生效。",
  },
  {
    q: "导出的视频和 PPT 有水印吗？",
    a: "入门版为标准导出，专业版与工作室版支持无水印导出与更多导出参数。",
  },
  {
    q: "团队成员怎么协作？",
    a: "专业版可共享项目空间，工作室版支持角色权限、审批流、版本回溯与操作日志。",
  },
  {
    q: "如果余额不足会怎样？",
    a: "关键步骤会先展示账单并拦截高消耗操作，你可以选择补充积分或升级套餐后继续。",
  },
];

function formatCny(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

export default function MembershipPage() {
  const router = useRouter();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("yearly");
  const [toast, setToast] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState(0);
  const [subscription, setSubscription] = useState<SubscriptionSnapshot | null>(() =>
    getSubscription(),
  );

  const plansWithCyclePrice = useMemo(() => {
    return plans.map((plan) => {
      const monthly = plan.monthlyPrice;
      const yearly = Math.round(plan.monthlyPrice * 12 * (1 - annualDiscountRate));
      const cyclePrice = billingCycle === "monthly" ? monthly : yearly;
      const cycleUnit = billingCycle === "monthly" ? "/月" : "/年";
      const monthlyEquivalent =
        billingCycle === "yearly" ? Math.round(yearly / 12) : monthly;
      return {
        ...plan,
        cyclePrice,
        cycleUnit,
        yearly,
        monthlyEquivalent,
      };
    });
  }, [billingCycle]);

  function handlePay(plan: Plan) {
    const link = billingCycle === "monthly" ? plan.stripeLinks.monthly : plan.stripeLinks.yearly;
    const nextSub = activateSubscription(plan.id, plan.name, billingCycle);
    const bonusCredits = plan.monthlyCredits;
    appendCreditRecord({
      type: "topup",
      description: `${plan.name} ${billingCycle === "yearly" ? "包年" : "包月"}购买到账`,
      delta: bonusCredits,
    });
    setSubscription(nextSub);
    setToast(`购买成功：已开通${plan.name}，积分已到账`);

    if (!link) {
      setToast("已更新本地会员状态。未配置 Stripe 链接，当前为演示流程。");
      window.setTimeout(() => setToast(null), 2400);
      return;
    }

    window.open(link, "_blank", "noopener,noreferrer");
  }

  return (
    <main className="min-h-screen bg-[#f7f7f8] px-3 pb-16 pt-4 sm:px-6 sm:pt-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-center gap-3 sm:mb-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
          >
            <ArrowLeft size={16} />
            返回
          </button>
        </div>

        <section className="rounded-2xl border border-zinc-200 bg-white px-4 py-6 shadow-sm sm:px-8 sm:py-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-sm font-medium text-zinc-500">Scilens 会员中心</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.push("/membership/subscription")}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-100"
              >
                <CreditCard size={14} />
                订阅状态
              </button>
              <button
                type="button"
                onClick={() => router.push("/membership/credits")}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-100"
              >
                <Zap size={14} />
                积分记录
              </button>
            </div>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
            选择适合你的会员方案
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            按需选择包月或包年，覆盖从内容理解到分镜、配音、导出的完整流程。包年默认享受
            30% 折扣。
          </p>
          {subscription ? (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              当前订阅：{subscription.planName} ·
              {subscription.cycle === "yearly" ? "包年" : "包月"} ·
              {subscription.status === "canceling" ? "将在周期结束后取消" : "生效中"}
            </div>
          ) : null}

          <div className="mt-5 inline-flex w-full rounded-full border border-zinc-200 bg-zinc-100 p-1 sm:w-auto">
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              className={`w-1/2 rounded-full px-4 py-2 text-sm font-medium transition sm:w-auto ${
                billingCycle === "monthly"
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              包月
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("yearly")}
              className={`w-1/2 rounded-full px-4 py-2 text-sm font-medium transition sm:w-auto ${
                billingCycle === "yearly"
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              包年（省 30%）
            </button>
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          {plansWithCyclePrice.map((plan) => (
            <article
              key={plan.id}
              className={`relative flex h-full flex-col rounded-2xl border bg-white p-4 shadow-sm sm:p-5 ${
                plan.recommended
                  ? "border-zinc-900 ring-1 ring-zinc-900/15"
                  : "border-zinc-200"
              }`}
            >
              {plan.recommended ? (
                <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white">
                  <BadgeCheck size={12} />
                  最划算推荐
                </span>
              ) : null}

              <h2 className="text-lg font-semibold text-zinc-900">{plan.name}</h2>
              <p className="mt-1 text-xs text-zinc-500">{plan.subtitle}</p>
              <p className="mt-1 text-sm text-zinc-500">
                每月 {formatCny(plan.monthlyCredits)} 积分
              </p>

              <div className="mt-4">
                <p className="text-3xl font-semibold leading-none text-zinc-900">
                  ¥{formatCny(plan.cyclePrice)}
                  <span className="ml-1 text-base font-medium text-zinc-500">
                    {plan.cycleUnit}
                  </span>
                </p>
                {billingCycle === "yearly" ? (
                  <p className="mt-1 text-xs text-zinc-500">
                    月均约 ¥{formatCny(plan.monthlyEquivalent)} · 原价 ¥
                    {formatCny(plan.monthlyPrice * 12)}
                  </p>
                ) : null}
              </div>

              <ul className="mt-4 space-y-2 text-sm text-zinc-700">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check size={14} className="mt-0.5 text-zinc-900" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => handlePay(plan)}
                className={`mt-6 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition ${
                  plan.recommended
                    ? "bg-zinc-900 text-white hover:bg-zinc-700"
                    : "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100"
                }`}
              >
                <Zap size={15} />
                使用 Stripe 订阅
              </button>

              <p className="mt-2 text-xs text-zinc-500">支持 Stripe 安全支付</p>
            </article>
          ))}
        </section>

        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-600">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck size={15} />
              Stripe 加密支付
            </span>
            <span>自动续费，可随时取消</span>
            <span>发票支持（企业可申请）</span>
            <span>支持试用后再订阅</span>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white px-5 py-6 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-900">常见问题</h3>
          <div className="mt-4 divide-y divide-zinc-200">
            {faqItems.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={item.q} className="py-3">
                  <button
                    type="button"
                    onClick={() => setOpenFaq((prev) => (prev === idx ? -1 : idx))}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <p className="text-sm font-medium text-zinc-900">{item.q}</p>
                    <ChevronDown
                      size={16}
                      className={`shrink-0 text-zinc-500 transition ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isOpen ? (
                    <p className="mt-2 pr-6 text-sm leading-6 text-zinc-600">{item.a}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

      </div>

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </main>
  );
}
